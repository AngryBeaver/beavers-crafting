import {CraftingApp} from './apps/CraftingApp.js';
import {RecipeSheet} from './apps/RecipeSheet.js';
import {Settings} from './Settings.js';
import {Crafting} from "./Crafting.js";
import {RecipeCompendium} from "./apps/RecipeCompendium.js";
import {AnyOfSheet} from "./apps/AnyOfSheet.js";
import {Recipe} from "./Recipe.js";
import {ActorSheetTab} from "./apps/ActorSheetTab.js";
import {itemTypeMigration, migrateDeprecateTools, migrateRecipeSkillToTests} from "./migration.js";
import {getToolConfig} from "./apps/ToolConfig";


Hooks.on("beavers-system-interface.init", async function(){
    beaversSystemInterface.addModule("beavers-crafting");
});
Hooks.on("ready", async function(){
    if(window.beaversSystemInterface === undefined){
        ui.notifications.error("Beavers Crafting | missing module Beavers System Interface", {permanent:true});
    }
})

Hooks.once("beavers-system-interface.ready", async function(){
    Settings.init();
    if(!game[Settings.NAMESPACE])game[Settings.NAMESPACE]={};
    game[Settings.NAMESPACE].Crafting = Crafting;
    game[Settings.NAMESPACE].RecipeCompendium = RecipeCompendium;
    game[Settings.NAMESPACE].Recipe = Recipe;
    game[Settings.NAMESPACE].migrateRecipeAddItemType = itemTypeMigration;
    game[Settings.NAMESPACE].migrateRecipeSkillToTests= migrateRecipeSkillToTests;
    game[Settings.NAMESPACE].migrateDeprecateTools= migrateDeprecateTools;

    const version = Settings.get(Settings.MAJOR_VERSION);
    if(version == 2){
        await migrateDeprecateTools();
        await migrateRecipeSkillToTests();
        Settings.set(Settings.USE_TOOL,false);
    }
    Settings.set(Settings.MAJOR_VERSION,3);

    Hooks.on("getActorSheetHeaderButtons", (app, buttons) => {
        if(Settings.get(Settings.ADD_HEADER_LINK)) {
            buttons.unshift({
                label: "beaversCrafting.actorLink",
                class: "beaversCrafting",
                icon: "fas fa-scroll",
                onclick: () => new CraftingApp(app.object).render(true)
            });
        }
    });

    Hooks.on("renderActorSheet", (app, html, data)=>{
        new ActorSheetTab(app, html, data);
    });

//Recipe remap use action
    Hooks.on(`dnd5e.preUseItem`, (item, config, options) => {
        if(item.flags[Settings.NAMESPACE]?.recipe){
            Crafting.fromOwned(item).craft();
            return false;
        }
    });

//SubTypeSheet
    Hooks.on(`renderItemSheet`, (app, html, data) => {
        RecipeSheet.bind(app, html, data);
        AnyOfSheet.bind(app,html,data);
    });


//add Subtype to create Item
    Hooks.on("preCreateItem", (doc, createData, options, user) => {
        if (createData.flags["beavers-crafting"]?.subtype === 'recipe' ) {
            doc.updateSource({"flags.beavers-crafting.subtype": Settings.RECIPE_SUBTYPE,"img":"icons/sundries/scrolls/scroll-worn-tan.webp"});
        }
        if (createData.flags["beavers-crafting"]?.subtype === 'anyOf' ) {
            doc.updateSource({"flags.beavers-crafting.subtype": Settings.ANYOF_SUBTYPE,"img":"modules/beavers-crafting/icons/anyOf.png"});
        }
    });

//evil
    Hooks.on("renderDialog", (app, html, content) => {
        const title = game.settings.get(Settings.NAMESPACE,Settings.CREATE_ITEM_TITLE)||"Create New Item";

        if (app.data.title === title) {
            if (html[0].localName !== "div") {
                html = $(html[0].parentElement.parentElement);
            }
            const itemType = beaversSystemInterface.configLootItemType;

            html.find("select[name='type']").append("<option value='"+itemType+"'>📜Recipe📜</option>");
            html.find("select[name='type']").append("<option value='"+itemType+"'>❔AnyOf❔</option>");
            if (html.find("input.subtype").length === 0) {
                html.find("form").append('<input class="subtype" name="flags.beavers-crafting.subtype" style="display:none" value="">');
            }
            html.find("select[name='type']").on("change", function () {
                const name = $(this).find("option:selected").text();
                let value = "";
                if (name === "📜Recipe📜") {
                    value = "recipe"
                }
                if (name === "❔AnyOf❔") {
                    value = "anyOf"
                }
                html.find("input.subtype").val(value);
            })
        }
    });
    getTemplate('modules/beavers-crafting/templates/beavers-recipe-folders.hbs').then(t=>{
        Handlebars.registerPartial('beavers-recipe-folders', t);
    });
    getTemplate('modules/beavers-crafting/templates/beavers-recipe-test.hbs').then(t=>{
        Handlebars.registerPartial('beavers-recipe-test', t);
    });
    getTemplate('modules/beavers-crafting/templates/beavers-recipe-component.hbs').then(t=>{
        Handlebars.registerPartial('beavers-recipe-component', t);
    })
});

//fucking stupid handlebars !!!
Handlebars.registerHelper('hasKey', function (param1, key, options) {
    if (param1[key]) {
        return options.fn(this);
    }
    return options.inverse(this);
});
Handlebars.registerHelper('isEmpty', function (object, options) {
    return Object.keys(object).length === 0;
});