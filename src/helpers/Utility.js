export async function getItem(uuid) {
    const parts = uuid.split(".");
    if (parts[0] === "Compendium") {
        return await game.packs.get(parts[1] + "." + parts[2]).getDocument(parts[3]);
    } else {
        return await fromUuid(uuid);
    }
}

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