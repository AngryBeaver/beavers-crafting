import {Settings} from "../Settings.js";

export class ActorSheetCraftedInventory{
    app;
    html;
    data;

    constructor(app, html, data) {
        this.app = app;
        this.html = html;
        this.data = data;
        void this.init()
    }

    async init() {
        //TODO make this system independent !
        this.app.actor.items
            .forEach(i=>{
                if(!!getProperty(i,`flags.${Settings.NAMESPACE}.crafted`)){
                    this.html.find(`.item[data-item-id=${i.id}] .item-name`).append("<span style='flex:0'>💎</span>")
                }
            })
    }

}