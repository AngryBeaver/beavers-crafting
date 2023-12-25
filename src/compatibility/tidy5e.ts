import {Settings} from "../Settings.js";
import {ActorSheetTab} from "../apps/ActorSheetTab.js";
import {ActorSheetCraftedInventory} from "../apps/ActorSheetCraftedInventory.js";

Hooks.once('tidy5e-sheet.ready', async (api) => {
    applyCompatibility(api);
    const tabs = game["settings"].get("tidy5e-sheet-kgar", "defaultCharacterSheetTabs");
    if(!tabs.includes("beavers-crafting-tab")){
        tabs.push("beavers-crafting-tab");
    }
    game["settings"].set("tidy5e-sheet-kgar","defaultCharacterSheetTabs",tabs);
});

async function applyCompatibility(api) {
    function createCraftingTab(api) {
        return new api.models.HtmlTab({
            html: '<div class="sheet-body scroll-container"></div>',
            title: 'beaversCrafting.actorSheet.tab',
            tabId: 'beavers-crafting-tab',
            tabContentsClasses: ['beavers-crafting'],
            enabled: (data) => game[Settings.NAMESPACE] && !Settings.isDisabledActor(data.actor),
            onRender: ({ app, data, tabContentsElement, isFullRender }) => {
                for (let tab of app._tabs ?? []) {
                    tab.activate = () => {};
                }
                const html = $(tabContentsElement);
                if (!isFullRender) {
                    if (!Settings.isDisabledActor(app.actor)) {
                        new ActorSheetTab(app, html, data);
                    }
                    new ActorSheetCraftedInventory(app, html, data);
                }
            },
        });
    }

    api.registerCharacterTab(createCraftingTab(api));
    api.registerNpcTab(createCraftingTab(api));
    api.registerVehicleTab(createCraftingTab(api));
}