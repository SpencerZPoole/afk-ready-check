import { preloadTemplates } from '../module/preloadTemplates.js';
import { log } from './debug.js';
import { ReadyCheckHud } from './ready-check.js';

const MODULE_ID = 'afk-ready-check';
const READY_CHECK_SOUND = `modules/${MODULE_ID}/sounds/ready-check.ogg`;
const AFK_READY_CHECK_CHAT_COMMAND = '/readycheck';
const AFK_CHAT_COMMAND = '/afk';
const READY_CHAT_COMMAND = '/ready';

export const SOCKET_NAME = `module.${MODULE_ID}`;
export const ArcSocketEventType = Object.freeze({
    readyCheck: 'ready-check',
    statusReport: 'status-report'
});

export const AfkStatus = Object.freeze({
    ready: 'ready',
    afk: 'afk',
    unknown: 'unknown'
});

const NUMERIC_STATUS_COMPATIBILITY = new Map([
    [0, AfkStatus.ready],
    [1, AfkStatus.afk],
    [2, AfkStatus.unknown]
]);

const STATUS_VIEW = Object.freeze({
    [AfkStatus.ready]: {
        label: 'Ready',
        title: 'Ready',
        iconClass: 'fa-solid fa-circle-check',
        cssClass: 'player-not-afk'
    },
    [AfkStatus.afk]: {
        label: 'AFK',
        title: 'AFK',
        iconClass: 'fa-solid fa-circle-xmark',
        cssClass: 'player-afk'
    },
    [AfkStatus.unknown]: {
        label: 'Waiting',
        title: 'Waiting for ready check response',
        iconClass: 'fa-solid fa-circle-question',
        cssClass: 'player-unknown'
    }
});

let currentCheckId = null;
let readyCheckRespondents = new Set();

Hooks.once('init', async () => {
    log('initializing');
    await preloadTemplates();
});

Hooks.once('ready', () => {
    initializeAllPlayersAfkStatuses();
    initializeHud();
    registerSocketListener();
    registerChatCommands();
    registerHooks();
    exposeDebugApi();
    processAllPlayerStatuses();
    log('ready');
});

function initializeHud() {
    game.readyCheckHud = new ReadyCheckHud({
        getPlayerStatuses: getPlayerStatusRows,
        onStatusReport: reportOwnStatus
    });
}

function registerSocketListener() {
    game.socket.on(SOCKET_NAME, (socketEvent) => {
        log('socket event received', socketEvent);
        switch (socketEvent?.type) {
            case ArcSocketEventType.readyCheck:
                handleReadyCheckSocketEvent(socketEvent);
                break;
            case ArcSocketEventType.statusReport:
                handleStatusReportSocketEvent(socketEvent);
                break;
            default:
                log('unexpected socket event type', socketEvent);
        }
    });
}

function registerChatCommands() {
    Hooks.on('chatMessage', (_chatlog, content) => handleChatCommand(content));

    const ChatLog = ui.chat?.constructor;
    if (!ChatLog?.CHAT_COMMANDS) return;

    ChatLog.CHAT_COMMANDS.arcReadyCheck = {
        rgx: /^\/readycheck\s*$/i,
        fn: () => {
            handleReadyCheckCommand();
            return false;
        }
    };
    ChatLog.CHAT_COMMANDS.arcReady = {
        rgx: /^\/ready\s*$/i,
        fn: () => {
            reportOwnStatus(AfkStatus.ready);
            return false;
        }
    };
    ChatLog.CHAT_COMMANDS.arcAfk = {
        rgx: /^\/afk\s*$/i,
        fn: () => {
            reportOwnStatus(AfkStatus.afk);
            return false;
        }
    };
}

function registerHooks() {
    Hooks.on('updateUser', (user, updateData) => handleUserChanged(user, updateData));
    Hooks.on('createUser', (user) => handleUserChanged(user));
    Hooks.on('deleteUser', (user) => {
        game.playerStatuses?.delete(user.id);
        readyCheckRespondents.delete(user.id);
        processAllPlayerStatuses();
        refreshHudIfRendered();
    });
    Hooks.on('renderPlayers', () => processAllPlayerStatuses());
}

function exposeDebugApi() {
    game.afkReadyCheck = {
        startReadyCheck,
        reportReady: () => reportOwnStatus(AfkStatus.ready),
        reportAfk: () => reportOwnStatus(AfkStatus.afk),
        getStatuses: getPlayerStatusRows,
        refresh: () => {
            synchronizeUsersToStatuses();
            processAllPlayerStatuses();
            refreshHudIfRendered();
        }
    };
}

function handleChatCommand(content) {
    const command = content?.toLowerCase().trim();
    switch (command) {
        case AFK_READY_CHECK_CHAT_COMMAND:
            handleReadyCheckCommand();
            return false;
        case READY_CHAT_COMMAND:
            reportOwnStatus(AfkStatus.ready);
            return false;
        case AFK_CHAT_COMMAND:
            reportOwnStatus(AfkStatus.afk);
            return false;
        default:
            return undefined;
    }
}

function handleReadyCheckCommand() {
    if (!game.user.isGM) {
        ui.notifications.warn('Only the GM can start an AFK ready check.');
        return;
    }
    startReadyCheck();
}

function startReadyCheck() {
    const checkId = createCheckId();
    beginReadyCheck(checkId);
    game.readyCheckHud.start(checkId);
    emitSocketEvent({
        type: ArcSocketEventType.readyCheck,
        checkId,
        userId: game.user.id
    });
    playReadyCheckSound();
}

function handleReadyCheckSocketEvent(socketEvent) {
    if (socketEvent.userId === game.user.id && game.user.isGM) return;
    const checkId = socketEvent.checkId ?? createCheckId();
    beginReadyCheck(checkId);
    if (!game.user.isGM) game.readyCheckHud.start(checkId);
}

function beginReadyCheck(checkId) {
    currentCheckId = checkId;
    readyCheckRespondents = new Set();
    synchronizeUsersToStatuses();
    for (const user of getReadyCheckParticipants()) {
        game.playerStatuses.set(user.id, AfkStatus.unknown);
    }
    processAllPlayerStatuses();
    refreshHudIfRendered();
}

async function reportOwnStatus(status, { checkId = currentCheckId, automatic = false } = {}) {
    const normalizedStatus = normalizeStatus(status);
    if (!normalizedStatus) return;

    applyStatus(game.user.id, normalizedStatus, { checkId });
    emitSocketEvent({
        type: ArcSocketEventType.statusReport,
        checkId,
        userId: game.user.id,
        status: normalizedStatus,
        automatic
    });
}

function handleStatusReportSocketEvent(socketEvent) {
    const status = normalizeStatus(socketEvent.status);
    const userId = socketEvent.userId;
    if (!status || !userId) return;
    if (socketEvent.checkId && currentCheckId && socketEvent.checkId !== currentCheckId) {
        log('ignoring stale status report', socketEvent);
        return;
    }
    applyStatus(userId, status, { checkId: socketEvent.checkId });
}

function applyStatus(userId, status, { checkId = null } = {}) {
    if (!game.playerStatuses) initializeAllPlayersAfkStatuses();
    game.playerStatuses.set(userId, status);
    if (checkId && checkId === currentCheckId) readyCheckRespondents.add(userId);

    processAllPlayerStatuses();
    refreshHudIfRendered();

    if (areReadyCheckParticipantsResolved()) {
        currentCheckId = null;
        readyCheckRespondents = new Set();
        game.readyCheckHud?.shutdown();
    }
}

function handleUserChanged(user, updateData = {}) {
    synchronizeUserToStatus(user, {
        forcePresence: Object.hasOwn(updateData, 'active')
    });
    processAllPlayerStatuses();
    refreshHudIfRendered();
}

function initializeAllPlayersAfkStatuses() {
    game.playerStatuses = new Map();
    synchronizeUsersToStatuses();
}

function synchronizeUsersToStatuses() {
    if (!game.playerStatuses) game.playerStatuses = new Map();
    const knownUserIds = new Set(getDisplayUsers().map((user) => user.id));
    for (const userId of Array.from(game.playerStatuses.keys())) {
        if (!knownUserIds.has(userId)) game.playerStatuses.delete(userId);
    }
    for (const user of getDisplayUsers()) synchronizeUserToStatus(user);
}

function synchronizeUserToStatus(user, { forcePresence = false } = {}) {
    if (!game.playerStatuses) game.playerStatuses = new Map();
    if (!shouldDisplayUser(user)) {
        game.playerStatuses.delete(user.id);
        return;
    }
    if (currentCheckId && isReadyCheckParticipant(user) && !readyCheckRespondents.has(user.id)) {
        game.playerStatuses.set(user.id, AfkStatus.unknown);
        return;
    }
    const existingStatus = game.playerStatuses.get(user.id);
    if (!forcePresence && existingStatus && existingStatus !== AfkStatus.unknown) return;
    game.playerStatuses.set(user.id, getPresenceStatus(user));
}

function processAllPlayerStatuses() {
    const playersElement = getPlayersElement();
    if (!playersElement) return;

    for (const icon of playersElement.querySelectorAll('.arc-status-icon')) icon.remove();

    for (const [userId, status] of game.playerStatuses ?? []) {
        renderPlayerAfkStatus(userId, status);
    }
}

function renderPlayerAfkStatus(userId, status) {
    const playersElement = getPlayersElement();
    const meta = STATUS_VIEW[status];
    if (!playersElement || !meta) return;

    const row = playersElement.querySelector(`li.player[data-user-id="${CSS.escape(userId)}"]`);
    const name = row?.querySelector('.player-name');
    if (!name) return;

    const icon = document.createElement('i');
    icon.className = `arc-status-icon ${meta.iconClass} ${meta.cssClass}`;
    icon.title = meta.title;
    icon.setAttribute('aria-label', meta.title);
    name.append(icon);
}

function getPlayerStatusRows() {
    return Array.from(game.playerStatuses ?? [])
        .map(([userId, status]) => {
            const user = game.users.get(userId);
            if (!user) return null;
            const meta = STATUS_VIEW[status] ?? STATUS_VIEW[AfkStatus.unknown];
            return {
                userId,
                name: user.name,
                status,
                label: meta.label,
                title: meta.title,
                iconClass: meta.iconClass,
                cssClass: meta.cssClass
            };
        })
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
}

function refreshHudIfRendered() {
    game.readyCheckHud?.refreshStatusDisplay();
}

function areReadyCheckParticipantsResolved() {
    if (!currentCheckId) return false;
    const participants = getReadyCheckParticipants();
    return participants.length > 0 && participants.every((user) => {
        const status = game.playerStatuses.get(user.id);
        return status && status !== AfkStatus.unknown;
    });
}

function getReadyCheckParticipants() {
    return getDisplayUsers().filter(isReadyCheckParticipant);
}

function isReadyCheckParticipant(user) {
    return !user.isGM && user.active && shouldDisplayUser(user);
}

function getDisplayUsers() {
    return Array.from(game.users ?? []).filter(shouldDisplayUser);
}

function shouldDisplayUser(user) {
    return user && user.role !== CONST.USER_ROLES.NONE;
}

function getPresenceStatus(user) {
    return user.active ? AfkStatus.ready : AfkStatus.afk;
}

function getPlayersElement() {
    return ui.players?.element ?? document.getElementById('players');
}

function normalizeStatus(status) {
    if (NUMERIC_STATUS_COMPATIBILITY.has(status)) return NUMERIC_STATUS_COMPATIBILITY.get(status);
    if (Object.values(AfkStatus).includes(status)) return status;
    return null;
}

function emitSocketEvent(payload) {
    game.socket.emit(SOCKET_NAME, payload);
}

function createCheckId() {
    return foundry.utils?.randomID?.(16) ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function playReadyCheckSound() {
    try {
        if (globalThis.AudioHelper?.play) {
            AudioHelper.play({ src: READY_CHECK_SOUND, volume: 0.8, loop: false }, true);
            return;
        }
        game.audio?.play?.(READY_CHECK_SOUND, { volume: 0.8, loop: false });
    } catch (err) {
        log('ready check sound failed', err);
    }
}
