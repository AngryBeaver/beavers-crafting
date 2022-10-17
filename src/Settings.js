export class Settings {

    static NAMESPACE = "beavers-crafting";
    static CREATE_ITEM_TITLE = "createItemTitle";
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
    }


    static get(key){
        return game.settings.get(this.NAMESPACE, key);
    };


}