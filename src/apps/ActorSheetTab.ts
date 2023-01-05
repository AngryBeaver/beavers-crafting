import {System} from "../systems/System.js";
import {CraftingApp} from "./CraftingApp.js";

export class ActorSheetTab {
    app;
    html;
    data;
    system:System;

    constructor(app, html, data){
        this.app = app;
        this.html = html;
        this.data = data;
        this.system = new System();
        void this.init();
    }

    async init() {
        const tab = game["i18n"].localize("beaversCrafting.actorSheet.tab");
        const tabBody = $(await renderTemplate('modules/beavers-crafting/templates/actor-sheet-tab.hbs', {}));
        this.system.addActorTab("crafting", tab, tabBody, this.html);
        this.activateListeners(tabBody);
    }

    activateListeners(tabBody:JQuery) {
        tabBody.find(".addRecipe").on("click",(event)=>{
            new CraftingApp(this.app.actor).render(true);
        })
    }


}
