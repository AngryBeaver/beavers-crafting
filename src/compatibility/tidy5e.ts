import {Settings} from "../Settings.js";
import {ActorSheetTab} from "../apps/ActorSheetTab.js";
import {ActorSheetCraftedInventory} from "../apps/ActorSheetCraftedInventory.js";

Hooks.once('tidy5e-sheet.ready', async (api) => {
    applyCompatibility(api);
    const tabs = game["settings"].get("tidy5e-sheet", "defaultCharacterSheetTabs");
    if (!tabs.includes("beavers-crafting-tab")) {
        tabs.push("beavers-crafting-tab");
        game["settings"].set("tidy5e-sheet", "defaultCharacterSheetTabs", tabs);
    }
});

async function applyCompatibility(api) {
    function createCraftingTab(api, html) {
        return new api.models.HtmlTab({
            html: html,
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

    const classicHtml = '<div class="sheet-body scroll-container"><section class="tab-body"></section></div>';
	const classicLayout = { layout: 'classic' };
	api.registerCharacterTab(createCraftingTab(api, classicHtml), classicLayout);
	api.registerNpcTab(createCraftingTab(api, classicHtml), classicLayout);
	api.registerVehicleTab(createCraftingTab(api, classicHtml), classicLayout);
	
	const quadroneHtml = '<section class="tab-body"></section>';
	const quadroneLayout = { layout: 'quadrone' };
	api.registerCharacterTab(createCraftingTab(api, quadroneHtml), quadroneLayout);
	api.registerNpcTab(createCraftingTab(api, quadroneHtml), quadroneLayout);
	api.registerVehicleTab(createCraftingTab(api, quadroneHtml), quadroneLayout);
}