import {Settings} from "../Settings.js";

export class ActorSheetCraftedInventory{
    app;
    html;
    data;

    constructor(app, html, data) {
        this.app = app;
        this.html = html.jquery ? html : $(html);
        this.data = data;
        void this.init()
    }

    /** the crafted icon behind each crafted item's name; sheets without ".item[data-item-id] .item-name" show none */
    async init() {
        if (Settings.get(Settings.SEPARATE_CRAFTED_ITEMS) === "none") {
            return;
        }
        this.app.actor.items
            .filter(i => !!foundry.utils.getProperty(i, `flags.${Settings.NAMESPACE}.crafted`))
            .forEach(i => {
                this.html.find(`.item[data-item-id=${i.id}] .item-name`)
                    .append('<img title="crafted" class="beavers-fontsize-svg-img" src="modules/beavers-crafting/icons/tools.svg"/>')
            })
    }

}