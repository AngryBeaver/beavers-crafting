// Foundry v13 moved these globals into namespaces and v15 removes the globals.
// Prefer the namespaced version and fall back to the global on older cores.

export function renderTemplate(path, data) {
    return (foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate)(path, data);
}

export function getTemplate(path) {
    return (foundry.applications?.handlebars?.getTemplate ?? globalThis.getTemplate)(path);
}

export function enrichHTML(content, options) {
    const ux = foundry.applications?.ux;
    const textEditor = ux?.TextEditor?.implementation ?? ux?.TextEditor ?? globalThis.TextEditor;
    return textEditor.enrichHTML(content, options);
}

export function createDragDrop(options) {
    const ux = foundry.applications?.ux;
    const dragDrop = ux?.DragDrop?.implementation ?? ux?.DragDrop ?? globalThis.DragDrop;
    return new dragDrop(options);
}

// ApplicationV2 sheets only know bringToFront, ApplicationV1 before v13 only bringToTop.
export function bringToFront(app) {
    if (app?.bringToFront) return app.bringToFront();
    return app?.bringToTop?.();
}

// v14 replaced the "-=key" / "==key" update syntax with operator values, the legacy keys are removed in v16.
// path may be dotted, the operation applies to its last segment. Returns obj.
export function markDeleted(obj, path) {
    const operators = foundry.data?.operators;
    if (operators?.ForcedDeletion) {
        obj[path] = new operators.ForcedDeletion();
    } else {
        obj[legacyKey(path, "-=")] = null;
    }
    return obj;
}

export function markReplaced(obj, path, value) {
    const operators = foundry.data?.operators;
    if (operators?.ForcedReplacement) {
        obj[path] = operators.ForcedReplacement.create(value);
    } else {
        obj[legacyKey(path, "==")] = value;
    }
    return obj;
}

function legacyKey(path, prefix) {
    const index = path.lastIndexOf(".") + 1;
    return path.slice(0, index) + prefix + path.slice(index);
}
