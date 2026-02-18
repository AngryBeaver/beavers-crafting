import {Settings} from "../Settings.js";

export class ActorSheetContainer {
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
        this.app.actor.items
            .forEach(i => {
                if (foundry.utils.getProperty(i, `flags.${Settings.NAMESPACE}.containerId`)) {
                    this.html.find(`.item[data-item-id=${i.id}]`).hide();
                }
            })
    }
}
