import {ToolConfig} from "./apps/ToolConfig.js";

export class Settings {

    static NAMESPACE = "beavers-crafting";
    static CREATE_ITEM_TITLE = "createItemTitle";
    static DISPLAY_RESULTS = "displayResults";
    static DISPLAY_INGREDIENTS = "displayIngredients";
    static ADD_HEADER_LINK = "addHeaderLink";
    static TIME_TO_CRAFT = "timeToCraft";
    static USE_TOOL = "useTool";
    static USE_ATTENDANTS = "useAttendants";
    static TOOL_CONFIG_BUTTON= "toolConfigButton";
    static TOOL_CONFIG = "toolConfig;"
    static RECIPE_SUBTYPE = "Recipe";
    static ANYOF_SUBTYPE = "AnyOf";
    static MAJOR_VERSION = "majorVersion";

    static init() {
        game.settings.register(this.NAMESPACE, this.CREATE_ITEM_TITLE, {
            name: game.i18n.localize('beaversCrafting.settings.createItemTitle.name'),
            hint: game.i18n.localize('beaversCrafting.settings.createItemTitle.hint'),
            scope: "world",
            config: true,
            default: "Create New Item",
            requiresReload: true,
            type: String,
        });
        game.settings.register(this.NAMESPACE, this.ADD_HEADER_LINK, {
            name: game.i18n.localize('beaversCrafting.settings.addHeaderLink.name'),
            hint: game.i18n.localize('beaversCrafting.settings.addHeaderLink.hint'),
            scope: "world",
            config: true,
            default: false,
            requiresReload: true,
            type: Boolean,
        });
        game.settings.register(this.NAMESPACE, this.TIME_TO_CRAFT, {
            name: game.i18n.localize('beaversCrafting.settings.timeToCraft.name'),
            hint: game.i18n.localize('beaversCrafting.settings.timeToCraft.hint'),
            scope: "world",
            config: true,
            default: "interaction",
            type: String,
            choices: {
                instantly:game.i18n.localize('beaversCrafting.settings.timeToCraft.choices.instantly'),
                interaction:game.i18n.localize('beaversCrafting.settings.timeToCraft.choices.interaction'),
            }
        });
        game.settings.register(this.NAMESPACE, this.USE_TOOL, {
            name: game.i18n.localize('beaversCrafting.settings.useTool.name'),
            hint: game.i18n.localize('beaversCrafting.settings.useTool.hint'),
            scope: "world",
            config: true,
            default: false,
            requiresReload: true,
            type: Boolean,
        });
        game.settings.register(this.NAMESPACE, this.USE_ATTENDANTS, {
            name: game.i18n.localize('beaversCrafting.settings.useAttendants.name'),
            hint: game.i18n.localize('beaversCrafting.settings.useAttendants.hint'),
            scope: "world",
            config: true,
            default: false,
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
        game.settings.register(this.NAMESPACE, this.TOOL_CONFIG,{
            name: "ToolConfig",
            scope: "world",
            config: false,
            default: defaultToolConfig,
            type: Object
        });
        game.settings.register(this.NAMESPACE, this.MAJOR_VERSION, {
            scope: "world",
            config: false,
            default: 0,
            type: Number,
        });
        game.settings.registerMenu(this.NAMESPACE, this.TOOL_CONFIG_BUTTON, {
            name: game.i18n.localize('beaversCrafting.settings.toolButton.name'),
            label: game.i18n.localize("beaversCrafting.settings.toolButton.label"),
            hint: game.i18n.localize('beaversCrafting.settings.toolButton.hint'),
            scope: "world",
            type: ToolConfig,
            restricted: true
        });
        game.settings.registerMenu(this.NAMESPACE, this.TOOL_CONFIG_BUTTON, {
            name: game.i18n.localize('beaversCrafting.settings.toolButton.name'),
            label: game.i18n.localize("beaversCrafting.settings.toolButton.label"),
            hint: game.i18n.localize('beaversCrafting.settings.toolButton.hint'),
            scope: "world",
            type: ToolConfig,
            restricted: true
        });
    }

    static get(key){
        return game.settings.get(this.NAMESPACE, key);
    };

    static set(key,value){
        game.settings.set(this.NAMESPACE,key,value);
    }

}

const defaultToolConfig = [
        "Compendium.dnd5e.items.8NS6MSOdXtUqD7Ib",
        "Compendium.dnd5e.items.rTbVrNcwApnuTz5E",
        "Compendium.dnd5e.items.fC0lFK8P4RuhpfaU",
        "Compendium.dnd5e.items.YfBwELTgPFHmQdHh",
        "Compendium.dnd5e.items.hM84pZnpCqKfi8XH",
        "Compendium.dnd5e.items.PUMfwyVUbtyxgYbD",
        "Compendium.dnd5e.items.skUih6tBvcBbORzA",
        "Compendium.dnd5e.items.YHCmjsiXxZ9UdUhU",
        "Compendium.dnd5e.items.hJS8yEVkqgJjwfWa",
        "Compendium.dnd5e.items.woWZ1sO5IUVGzo58",
        "Compendium.dnd5e.items.KndVe2insuctjIaj",
        "Compendium.dnd5e.items.0d08g1i5WXnNrCNA",
        "Compendium.dnd5e.items.ap9prThUB2y9lDyj",
        "Compendium.dnd5e.items.xKErqkLo4ASYr5EP",
        "Compendium.dnd5e.items.SztwZhbhZeCqyAes",
        "Compendium.dnd5e.items.Y9S75go1hLMXUD48",
        "Compendium.dnd5e.items.jhjo20QoiD5exf09",
        "Compendium.dnd5e.items.ccm5xlWhx74d6lsK",
        "Compendium.dnd5e.items.ugzwHl8vYaPu2GNd",
        "Compendium.dnd5e.items.i89okN7GFTWHsvPy",
        "Compendium.dnd5e.items.IBhDAr7WkhWPYLVn",
        "Compendium.dnd5e.items.cG3m4YlHfbQlLEOx",
        "Compendium.dnd5e.items.il2GNi8C0DvGLL9P",
        "Compendium.dnd5e.items.V13fjV5oSmvbRdgP",
        "Compendium.dnd5e.items.6rocoBx5jdzG1QQH",
    ];