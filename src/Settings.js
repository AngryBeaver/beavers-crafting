export class Settings {

    static NAMESPACE = "beavers-crafting";
    static CRAFT_BY_ID = "craftById";

    static init() {
        game.settings.register(this.NAMESPACE, this.CRAFT_BY_ID, {
            name: game.i18n.localize('beaversCrafting.settings.craftById.name'),
            hint: game.i18n.localize('beaversCrafting.settings.craftById.hint'),
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