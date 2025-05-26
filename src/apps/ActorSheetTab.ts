import {CraftingApp} from "./CraftingApp.js";
import {Crafting} from "../Crafting.js";
import {Settings} from "../Settings.js";

export class ActorSheetTab {
    app;
    html;
    data;
    system:System;
    craftingFolder: {
        [key:string]:{id:string, crafting:Crafting,chatData:{}}[]
    } = {}
    craftingList:{
        [key:string]:Crafting
    } = {};

    constructor(app, html, data){
        app.beaversCraftingTabSheet = this;
        this.app = app;
        this.html = html.jquery ? html:$(html);
        this.data = data;
        void this.init().then(()=>{
            this.activateTab()
        });
    }

    async init() {
        const label = Settings.get(Settings.TAB_NAME) || game["i18n"].localize("beaversCrafting.actorSheet.tab");
        const icon = Settings.get(Settings.TAB_ICON) || "fa-scroll";
        const flag = foundry.utils.getProperty(this.app.actor,`flags.${Settings.NAMESPACE}.crafting`) || {};
        const unsortedFolders = {};
        for(const [x,y] of Object.entries(flag)){
            const craftingData = (y as CraftingData);
            const crafting = new Crafting(craftingData,this.app.actor);
            let folder = "";
            if(crafting.recipe.folder){
                folder = crafting.recipe.folder.split(".")[0];
            }
            this.craftingList[x] = crafting;
            if(!unsortedFolders[folder] ){
                unsortedFolders[folder] = [];
            }
            unsortedFolders[folder].push({id:x,crafting:crafting, chatData: crafting.getChatData()});
        }
        Object.keys(unsortedFolders).sort().forEach((k)=> {
            if (k !== "") {
                this.craftingFolder[k] = unsortedFolders[k];
            }
        })
        if(unsortedFolders[""]){
            this.craftingFolder[""] = unsortedFolders[""];
        }

        const tabBody = $(await renderTemplate('modules/beavers-crafting/templates/actor-sheet-tab.hbs',
            {
                craftingFolder:this.craftingFolder,
            }));
        beaversSystemInterface.actorSheetAddTab(this.app, this.html, this.data.actor, { id: Settings.ACTOR_TAB_ID, label: label, html: `<i class="fas ${icon}"/>` }, tabBody);
        this.activateListeners(tabBody);
    }

    activateTab(){
        if(this.app.activeTab !== undefined){
            if(this.app._tabs){ //V1
                this.app._tabs[0].activate(this.app.activeTab);
            }
            if(this.app.changeTab){//V2
                this.app.changeTab(this.app.activeTab,"primary",{force:true});
            }

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
        tabBody.find(".advanceCrafting").on("click",(e)=>{
            const id = (e.currentTarget.dataset.id as string);
            void this.craftingList[id].continueCrafting().then(()=>{
                this.app.render();
            });
        });
        this.html.find('nav [data-group="primary"][data-tab]').click(e => {
            this.app.activeTab = e.currentTarget.dataset.tab;
            this.app.render();
        });
    }


}
