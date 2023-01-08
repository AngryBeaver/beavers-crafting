import {System} from "../systems/System.js";
import {CraftingApp} from "./CraftingApp.js";
import {getSystem} from "../helpers/Helper.js";
import {Crafting} from "../Crafting.js";

export class ActorSheetTab {
    app;
    html;
    data;
    system:System;

    constructor(app, html, data){
        this.app = app;
        this.html = html;
        this.data = data;
        this.system = getSystem();
        void this.init().then(()=>{
            this.activateTab()
        });
    }

    async init() {
        const tab = game["i18n"].localize("beaversCrafting.actorSheet.tab");
        const craftingList = this.app.actor.flags["beavers-crafting"]?.crafting || {};
        const chatList = {};
        for(const [x,y] of Object.entries(craftingList)){
            const craftingData = (y as CraftingData);
            const crafting = new Crafting(craftingData,this.app.actor);
            chatList[x] = crafting.getChatData();
        }
        const tabBody = $(await renderTemplate('modules/beavers-crafting/templates/actor-sheet-tab.hbs', {craftingList:craftingList,chatList:chatList}));
        this.system.actorSheet_addTab("crafting", tab, tabBody, this.html);
        this.activateListeners(tabBody);
    }

    activateTab(){
        if(this.app.activeTab !== undefined){
            this.app._tabs[0].activate(this.app.activeTab);
        }
    }

    activateListeners(tabBody:JQuery) {
        tabBody.find(".addCrafting").on("click",(event)=>{
            new CraftingApp(this.app.actor).render(true);
        });
        tabBody.find(".removeCrafting").on("click",(e)=>{
            const id = e.target.dataset.id;
            const flags = {}
            flags["beavers-crafting.crafting.-="+id] = null;
            void this.app.actor.update({flags:flags});
        });
        this.html.find('.tabs[data-group="primary"]').click(e => {
            this.app.activeTab = e.target.dataset.tab;
        });
    }


}
