export class Settings {

    static NAMESPACE = "beavers-crafting";
    static CRAFT_BY_ID = "craftById";
    static CREATE_ITEM_TITLE = "createItemTitle";
    static RECIPE_SOURCE_NAME = "recipeSourceName";

    static init() {
    game.settings.register(this.NAMESPACE, this.RECIPE_SOURCE_NAME, {
        name: game.i18n.localize('beaversCrafting.settings.recipeSourceName.name'),
        hint: game.i18n.localize('beaversCrafting.settings.recipeSourceName.hint'),
        scope: "world",
        config: true,
        default: "Recipe",
        type: String,
    });

        game.settings.register(this.NAMESPACE, this.CRAFT_BY_ID, {
            name: game.i18n.localize('beaversCrafting.settings.craftById.name'),
            hint: game.i18n.localize('beaversCrafting.settings.craftById.hint'),
            scope: "world",
            config: true,
            default: true,
            type: Boolean,
        });

        game.settings.register(this.NAMESPACE, this.CREATE_ITEM_TITLE, {
            name: game.i18n.localize('beaversCrafting.settings.createItemTitle.name'),
            hint: game.i18n.localize('beaversCrafting.settings.createItemTitle.hint'),
            scope: "world",
            config: true,
            default: "Create New Item",
            type: String,
        });
    }


    static get(key){
        return game.settings.get(this.NAMESPACE, key);
    };


}