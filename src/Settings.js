import {ModuleConfig} from "./apps/ModuleConfig.js";

export class Settings {

    static NAMESPACE = "beavers-crafting";
    static CREATE_ITEM_TITLE = "createItemTitle";
    static DISPLAY_RESULTS = "displayResults";
    static DISPLAY_INGREDIENTS = "displayIngredients";
    static TIME_TO_CRAFT = "timeToCraft";
    static USE_ATTENDANTS = "useAttendants";
    static MODULE_CONFIG_BUTTON = "moduleConfigButton";
    static RECIPE_SUBTYPE = "Recipe";
    static ANYOF_SUBTYPE = "AnyOf";
    static MAJOR_VERSION = "majorVersion";
    static ACTOR_TAB_ID = "beavers-crafting";
    static CURRENCY_EXCHANGE = "currencyExchange"
    static DISABLED_ACTOR = "disabledActor";
    static SEPARATE_CRAFTED_ITEMS = "separateCraftedItems";
    static TAB_NAME = "tabName";
    static TAB_ICON = "tabIcon";
    static CAPTURE_CREATE_ITEM_TITLE = "captureCreateItemTitle";
    static DRAGGABLE_CHAT_RESULT = "draggableChatResult";
    static init() {
        game.settings.register(this.NAMESPACE, this.CREATE_ITEM_TITLE, {
            name: game.i18n.localize('beaversCrafting.settings.createItemTitle.name'),
            hint: game.i18n.localize('beaversCrafting.settings.createItemTitle.hint'),
            scope: "world",
            config: false,
            default: "Create New Item",
            requiresReload: false,
            type: String,
        });
        game.settings.register(this.NAMESPACE,this.CAPTURE_CREATE_ITEM_TITLE,{
            name: game.i18n.localize('beaversCrafting.settings.captureCreateItemTitle.name'),
            hint: game.i18n.localize('beaversCrafting.settings.captureCreateItemTitle.hint'),
            scope: "world",
            config: false,
            default: false,
            requiresReload: false,
            type: Boolean,
        });
        game.settings.registerMenu(this.NAMESPACE, this.MODULE_CONFIG_BUTTON, {
            name: game.i18n.localize('beaversCrafting.settings.moduleButton.name'),
            label: game.i18n.localize("beaversCrafting.settings.moduleButton.label"),
            hint: game.i18n.localize('beaversCrafting.settings.moduleButton.hint'),
            scope: "world",
            type: ModuleConfig,
        });

        game.settings.register(this.NAMESPACE, this.TIME_TO_CRAFT, {
            name: game.i18n.localize('beaversCrafting.settings.timeToCraft.name'),
            hint: game.i18n.localize('beaversCrafting.settings.timeToCraft.hint'),
            scope: "world",
            config: true,
            default: "interaction",
            type: String,
            choices: {
                instantly: game.i18n.localize('beaversCrafting.settings.timeToCraft.choices.instantly'),
                interaction: game.i18n.localize('beaversCrafting.settings.timeToCraft.choices.interaction'),
            }
        });
        game.settings.register(this.NAMESPACE, this.USE_ATTENDANTS, {
            name: game.i18n.localize('beaversCrafting.settings.useAttendants.name'),
            hint: game.i18n.localize('beaversCrafting.settings.useAttendants.hint'),
            scope: "world",
            config: true,
            default: true,
            requiresReload: true,
            type: Boolean,
        });
        game.settings.register(this.NAMESPACE, this.DISPLAY_RESULTS, {
            name: game.i18n.localize('beaversCrafting.settings.displayResults.name'),
            hint: game.i18n.localize('beaversCrafting.settings.displayResults.hint'),
            scope: "world",
            config: true,
            default: true,
            type: Boolean,
        });
        game.settings.register(this.NAMESPACE, this.DISPLAY_INGREDIENTS, {
            name: game.i18n.localize('beaversCrafting.settings.displayIngredients.name'),
            hint: game.i18n.localize('beaversCrafting.settings.displayIngredients.hint'),
            scope: "world",
            config: true,
            default: true,
            type: Boolean,
        });
        game.settings.register(this.NAMESPACE, this.DRAGGABLE_CHAT_RESULT, {
            name: game.i18n.localize('beaversCrafting.settings.draggableChatResult.name'),
            hint: game.i18n.localize('beaversCrafting.settings.draggableChatResult.hint'),
            scope: "world",
            config: true,
            default: false,
            requiresReload: true,
            type: Boolean,
        });
        game.settings.register(this.NAMESPACE, this.CURRENCY_EXCHANGE, {
            name: game.i18n.localize('beaversCrafting.settings.currencyExchange.name'),
            hint: game.i18n.localize('beaversCrafting.settings.currencyExchange.hint'),
            scope: "world",
            config: true,
            default: true,
            type: Boolean,
        });
        game.settings.register(this.NAMESPACE, this.DISABLED_ACTOR, {
            name: game.i18n.localize('beaversCrafting.settings.disabledActor.name'),
            hint: game.i18n.localize('beaversCrafting.settings.disabledActor.hint'),
            scope: "world",
            config: true,
            default: "npc",
            type: String,
        });
        game.settings.register(this.NAMESPACE, this.TAB_NAME, {
            name: game.i18n.localize('beaversCrafting.settings.tabName.name'),
            hint: game.i18n.localize('beaversCrafting.settings.tabName.hint'),
            scope: "world",
            config: true,
            requiresReload: true,
            default: game["i18n"].localize("beaversCrafting.actorSheet.tab"),
            type: String,
        });
        game.settings.register(this.NAMESPACE, this.TAB_ICON, {
            name: game.i18n.localize('beaversCrafting.settings.tabIcon.name'),
            hint: game.i18n.localize('beaversCrafting.settings.tabIcon.hint'),
            scope: "world",
            config: true,
            requiresReload: true,
            default: "fa-scroll",
            type: String,
        });
        game.settings.register(this.NAMESPACE, this.SEPARATE_CRAFTED_ITEMS, {
            name: game.i18n.localize('beaversCrafting.settings.separateItems.name'),
            hint: game.i18n.localize('beaversCrafting.settings.separateItems.hint'),
            scope: "world",
            config: true,
            default: "none",
            type: String,
            requiresReload: true,
            choices: {
                none: "none",
                partial: "partial ",
                full: "full"
            }
        });
        game.settings.register(this.NAMESPACE, this.MAJOR_VERSION, {
            scope: "world",
            config: false,
            default: 400,
            type: Number,
        });
        if (game["system"].id === "dnd5e") {
            game["settings"].register(this.NAMESPACE, "toolConfig;", {
                name: "ToolConfig",
                scope: "world",
                config: false,
                default: [],
                type: Object
            });
        }
    }

    static get(key) {
        return game.settings.get(this.NAMESPACE, key);
    };

    static set(key, value) {
        game.settings.set(this.NAMESPACE, key, value);
    }

    static isDisabledActor(actor) {
        return Settings.get(Settings.DISABLED_ACTOR).split(",").includes(actor.type);
    }

}
