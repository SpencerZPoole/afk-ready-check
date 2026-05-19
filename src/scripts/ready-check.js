import { READY_CHECK_TEMPLATE } from '../module/preloadTemplates.js';
import { log } from './debug.js';

const AFK_READY_CHECK_TIMEOUT_MS = 60000;
const AFK_READY_CHECK_INTERVAL_MS = 1000;
const COUNTDOWN_SECONDS = AFK_READY_CHECK_TIMEOUT_MS / 1000;

const HandlebarsApplication = foundry.applications.api.HandlebarsApplicationMixin(
    foundry.applications.api.ApplicationV2
);

export class ReadyCheckHud extends HandlebarsApplication {
    static DEFAULT_OPTIONS = {
        id: 'afk-ready-check-hud',
        classes: ['afk-ready-check-window'],
        window: {
            title: 'AFK Ready Check',
            icon: 'fa-solid fa-user-clock',
            minimizable: false,
            resizable: false
        },
        position: {
            width: 360,
            top: 80,
            left: 980
        },
        actions: {
            ready: ReadyCheckHud.onReady,
            afk: ReadyCheckHud.onAfk
        },
        getPlayerStatuses: () => [],
        onStatusReport: async () => {}
    };

    static PARTS = {
        body: {
            template: READY_CHECK_TEMPLATE,
            root: true
        }
    };

    countDownCounter = COUNTDOWN_SECONDS;
    countDownTimerId = null;
    countDownIntervalId = null;
    activeCheckId = null;

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.playerStatuses = this.options.getPlayerStatuses();
        context.countDownCounter = this.countDownCounter;
        context.countdownVisible = this.countDownCounter < COUNTDOWN_SECONDS;
        return context;
    }

    start(checkId) {
        this.activeCheckId = checkId ?? null;
        this.startTimers();
        return this.render({ force: true });
    }

    refreshStatusDisplay() {
        if (!this.rendered) return;
        return this.render({ force: true });
    }

    async shutdown() {
        this.killTimeoutAndInterval();
        if (this.rendered) await this.close();
    }

    startTimers() {
        this.killTimeoutAndInterval();
        this.countDownCounter = COUNTDOWN_SECONDS;
        this.countDownIntervalId = setInterval(() => this.updateCountdown(), AFK_READY_CHECK_INTERVAL_MS);
        this.countDownTimerId = setTimeout(() => this.timeoutAsAfk(), AFK_READY_CHECK_TIMEOUT_MS);
    }

    killTimeoutAndInterval() {
        if (this.countDownIntervalId) clearInterval(this.countDownIntervalId);
        if (this.countDownTimerId) clearTimeout(this.countDownTimerId);
        this.countDownIntervalId = null;
        this.countDownTimerId = null;
        this.countDownCounter = COUNTDOWN_SECONDS;
    }

    updateCountdown() {
        this.countDownCounter = Math.max(0, this.countDownCounter - 1);
        const counter = this.element?.querySelector('[data-countdown]');
        if (!counter) return;
        counter.textContent = String(this.countDownCounter);
        counter.hidden = this.countDownCounter >= COUNTDOWN_SECONDS;
    }

    async timeoutAsAfk() {
        log('countdown elapsed, reporting user as AFK');
        await this.reportStatus('afk', { automatic: true });
        setTimeout(() => this.close(), 1000);
    }

    async reportStatus(status, { automatic = false } = {}) {
        await this.options.onStatusReport(status, {
            checkId: this.activeCheckId,
            automatic
        });
        this.killTimeoutAndInterval();
        return this.refreshStatusDisplay();
    }

    static onReady(event) {
        event.preventDefault();
        return this.reportStatus('ready');
    }

    static onAfk(event) {
        event.preventDefault();
        return this.reportStatus('afk');
    }

    _onClose(options) {
        this.killTimeoutAndInterval();
        super._onClose(options);
    }
}
