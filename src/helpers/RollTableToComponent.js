import {DefaultComponent} from "../Recipe.js";

export async function rollTableToComponents(component,result) {
    const table = await fromUuid(component.uuid);
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
            if (r.documentCollection !== "Item") {
                ui.notifications.error(game.i18n.localize(`beaversCrafting.crafting-app.errors.tableNotValid`) + r.name);
                result.hasErrors = true;
                result.hasException = true;
                return [];
            }else{
                const item = await fromUuid("Item."+r.documentId);
                if(!item){
                    ui.notifications.error(game.i18n.localize(`beaversCrafting.crafting-app.errors.tableItemNotFound`) + r.name);
                    result.hasErrors = true;
                    result.hasException = true;
                    return [];
                }
                components.push(new DefaultComponent(item, item.uuid, r.documentCollection));
            }
        }
    }
    return components;
}