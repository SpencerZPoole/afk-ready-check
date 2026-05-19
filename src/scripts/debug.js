export function log(msg, ...args) {
    if (!globalThis.CONFIG?.debug?.afkReadyCheck) return;
    console.debug(`afk-ready-check | ${msg}`, ...args);
}
