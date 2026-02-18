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
        this.app.actor.items.forEach(i => {
            if (i.getFlag("beavers-crafting", "containerId")) {
              const element = this.html.find(`[data-item-id="${i.id}"]`);
              if (element.length > 0) {
                element.addClass("beavers-hidden-item");
              }
            }
        })
    }
}
