export class Settings {

    static NAMESPACE = "beavers-crafting";
    static CREATE_ITEM_TITLE = "createItemTitle";
    static DISPLAY_RESULTS = "displayResults";
    static DISPLAY_INGREDIENTS = "displayIngredients";
    static RECIPE_SUBTYPE = "Recipe";
    static ANYOF_SUBTYPE = "AnyOf";

    static init() {
        game.settings.register(this.NAMESPACE, this.CREATE_ITEM_TITLE, {
            name: game.i18n.localize('beaversCrafting.settings.createItemTitle.name'),
            hint: game.i18n.localize('beaversCrafting.settings.createItemTitle.hint'),
            scope: "world",
            config: true,
            default: "Create New Item",
            type: String,
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
    }


    static get(key){
        return game.settings.get(this.NAMESPACE, key);
    };


}