import {Settings} from "../Settings.js";

export class CraftedItemSheet{
    app;
    html;
    data;
    item;

    private constructor(app, html, data) {
        this.app = app;
        this.item = app.item;
        this.html = html.jquery ? html : $(html);
        this.data = data;
        void this.init()
    }

    static bind(app, html, data) {
        if (Settings.get(Settings.SEPARATE_CRAFTED_ITEMS) !== "none" &&
            !!foundry.utils.getProperty(app.item,`flags.${Settings.NAMESPACE}.crafted`)) {
            new CraftedItemSheet(app,html,data);
        }
    }

    /** the crafted icon next to the name; sheets without a name input (input[name=name]) show none */
    async init() {
        const name = this.html.find(`input[name=name]`);
        name.parent().addClass("flexrow");
        name.after('<img title="crafted" class="beavers-fontsize-svg-img" src="modules/beavers-crafting/icons/tools.svg"/>');
    }

}