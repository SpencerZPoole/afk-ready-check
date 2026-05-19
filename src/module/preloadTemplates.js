export const READY_CHECK_TEMPLATE = 'modules/afk-ready-check/templates/ready-check.hbs';

export async function preloadTemplates() {
    const templates = [READY_CHECK_TEMPLATE];
    const loader = foundry.applications?.handlebars?.loadTemplates ?? globalThis.loadTemplates;
    return loader(templates);
}
