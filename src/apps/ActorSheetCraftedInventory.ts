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

    async init() {
        //TODO make this system independent !
        this.app.actor.items
            .forEach(i=>{
                if(Settings.get(Settings.SEPARATE_CRAFTED_ITEMS) !== "none" && !!foundry.utils.getProperty(i,`flags.${Settings.NAMESPACE}.crafted`)){
                    this.html.find(`.item[data-item-id=${i.id}] .item-name`)
                        .append('<img title="crafted" class="beavers-fontsize-svg-img" src="modules/beavers-crafting/icons/tools.svg"/>')
                }
            })
    }

}