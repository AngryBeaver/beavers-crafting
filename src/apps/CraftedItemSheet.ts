import {Settings} from "../Settings.js";

export class CraftedItemSheet{
    app;
    html;
    data;
    item;

    private constructor(app, html, data) {
        this.app = app;
        this.item = app.item;
        this.html = html;
        this.data = data;
        void this.init()
    }

    static bind(app, html, data) {
        if (!!getProperty(app.item,`flags.${Settings.NAMESPACE}.crafted`)) {
            new CraftedItemSheet(app,html,data);
        }
    }

    async init() {
        //TODO make this system independent !
        if(!!getProperty(this.item,`flags.${Settings.NAMESPACE}.crafted`)){
            this.html.find(`input[name=name]`).after(
                '<img title="crafted" class="beavers-fontsize-svg-img" src="modules/beavers-crafting/icons/blueDiamond.svg"/>')
        }
    }

}