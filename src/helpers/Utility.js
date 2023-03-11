export function getDataFrom(e) {
    try {
        return JSON.parse(e.dataTransfer.getData('text/plain'));
    } catch (err) {
        return false;
    }
}

export function sanitizeUuid(uuid) {
    return uuid.replace(/\./g, '-')
}