import {Component} from "../Recipe.js";

export async function rollTableToComponents(component, result) {
    const table = await getItem(component.uuid);
    let components = [];
    if (!table) {
        ui.notifications.error(game.i18n.localize(`beaversCrafting.crafting-app.errors.tableNotFound`) + component.name);
        result.hasErrors = true;
        result.hasException = true;
        return [];
    }
    for (let x = 0; x < component.quantity; x++) {
        const object = await table.roll();
        for (const r of object.results) {
            let uuid = r.documentCollection + "." + r.documentId;
            if (r.documentCollection !== "Item") {
                const parts = r.documentCollection.split(".");
                if (parts.length < 2) {
                    ui.notifications.error(game.i18n.localize(`beaversCrafting.crafting-app.errors.tableNotValid`) + r.name);
                    result.hasErrors = true;
                    result.hasException = true;
                    return [];
                }
                uuid = "Compendium." + uuid;
            }
            const item = await getItem(uuid)
            if (!item) {
                ui.notifications.error(game.i18n.localize(`beaversCrafting.crafting-app.errors.tableItemNotFound`) + r.name);
                result.hasErrors = true;
                result.hasException = true;
                return [];
            }
            components.push(new Component(item, item.uuid, r.documentCollection));
        }
    }
    return components;
}

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