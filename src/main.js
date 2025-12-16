import {CraftingApp} from './apps/CraftingApp.js';
import {RecipeSheet} from './apps/RecipeSheet.js';
import {Settings} from './Settings.js';
import {Crafting} from "./Crafting.js";
import {RecipeCompendium} from "./apps/RecipeCompendium.js";
import {AnyOfSheet} from "./apps/AnyOfSheet.js";
import {Recipe} from "./Recipe.js";
import {ActorSheetTab} from "./apps/ActorSheetTab.js";
import {
    itemTypeMigration,
    migrateDeprecateTools,
    migrateRecipeSkillToTests, migrateRecipeTestsToBeaversTests,
    migrateRecipeToOrConditions,
} from "./migration.js";
import {ActorSheetCraftedInventory} from "./apps/ActorSheetCraftedInventory.js";
import {CraftedItemSheet} from "./apps/CraftedItemSheet.js";
import "./compatibility/tidy5e.js";
import { hookChatLog } from "./apps/ChatLog.js";

Hooks.on("beavers-system-interface.init", async function(){
    beaversSystemInterface.addModule(Settings.NAMESPACE);
});
Hooks.on("ready", async function(){
    if(window.beaversSystemInterface === undefined){
        ui.notifications.error("Beavers Crafting | missing module Beavers System Interface", {permanent:true});
    }
})

async function migrate(){
    const version = Settings.get(Settings.MAJOR_VERSION);
    if(version == 2){
        await migrateDeprecateTools();
        await migrateRecipeSkillToTests();
        Settings.set(Settings.USE_TOOL,false);
        Settings.set(Settings.MAJOR_VERSION,3);
    }
    if(version == 3){
        await migrateRecipeToOrConditions();
    }
    if(version < 400){
        await new Promise(resolve => setTimeout(resolve, 10000));
        await migrateRecipeTestsToBeaversTests();
    }
    Settings.set(Settings.MAJOR_VERSION,400);
}

function debug(){
    const originalCall = Hooks.call;
    const originalCallAll = Hooks.callAll;

// Override Hooks.call
    Hooks.call = function (hookName, ...args) {
        console.log(`Hook executed: ${hookName}`, { args });
        return originalCall.call(this, hookName, ...args);
    };

// Override Hooks.callAll
    Hooks.callAll = function (hookName, ...args) {
        console.log(`Hook executed (callAll): ${hookName}`, { args });
        return originalCallAll.call(this, hookName, ...args);
    };
}

Hooks.once("beavers-system-interface.ready", async function(){
    Settings.init();
    if(!game[Settings.NAMESPACE])game[Settings.NAMESPACE]={};
    game[Settings.NAMESPACE].Crafting = Crafting;
    game[Settings.NAMESPACE].RecipeCompendium = RecipeCompendium;
    game[Settings.NAMESPACE].Recipe = Recipe;
    game[Settings.NAMESPACE].Settings = Settings;
    game[Settings.NAMESPACE].migrateRecipeAddItemType = itemTypeMigration;
    game[Settings.NAMESPACE].migrateRecipeSkillToTests= migrateRecipeSkillToTests;
    game[Settings.NAMESPACE].migrateDeprecateTools= migrateDeprecateTools;
    game[Settings.NAMESPACE].migrateRecipeToOrConditions= migrateRecipeToOrConditions;
    game[Settings.NAMESPACE].migrateRecipeTestsToBeaversTests= migrateRecipeTestsToBeaversTests;
    hookChatLog();
    migrate();
    beaversSystemInterface.addExtension(Settings.NAMESPACE,{componentAddFlags:["crafted","isCrafted"]})

    if(Settings.get(Settings.SEPARATE_CRAFTED_ITEMS) === "full"){
        beaversSystemInterface.addExtension(Settings.NAMESPACE,{componentIsSame:(a,b,previousResult)=>{
            const aHasFlag = foundry.utils.getProperty(a,`flags.${Settings.NAMESPACE}.isCrafted`);
            const bHasFlag = foundry.utils.getProperty(b,`flags.${Settings.NAMESPACE}.isCrafted`);
            return previousResult && aHasFlag === bHasFlag
            }})
    }
    if(Settings.get(Settings.SEPARATE_CRAFTED_ITEMS) === "partial"){
        beaversSystemInterface.addExtension(Settings.NAMESPACE,{componentIsSame:(a,b,previousResult)=>{
                const aHasFlag = foundry.utils.getProperty(a,`flags.${Settings.NAMESPACE}.isCrafted`);
                const bHasFlag = foundry.utils.getProperty(b,`flags.${Settings.NAMESPACE}.isCrafted`);
                return previousResult && (!aHasFlag || aHasFlag === bHasFlag)
            }})
    }

    Hooks.on("renderActorSheet", (app, html, data)=>{
        if (app instanceof Application) {
            if (!Settings.isDisabledActor(app.actor)) {
                new ActorSheetTab(app, html, data);
            }
            new ActorSheetCraftedInventory(app, html, data);
        }
    });

    //SubTypeSheet
    Hooks.on(`renderItemSheet`, async (app, html, data) => {
      if (app instanceof Application) {
        await RecipeSheet.bind(app, html, data, 1);
        AnyOfSheet.bind(app, html, data);
        CraftedItemSheet.bind(app, html, data);
      }
    });

    Hooks.on(`renderApplicationV2`, async (app, html, data, options) => {
      await RecipeSheet.bind(app, html, data, 2);
      AnyOfSheet.bind(app, html, data, 2);
      CraftedItemSheet.bind(app, html, data);
      if (app.actor) {
        if (!Settings.isDisabledActor(app.actor)) {
          new ActorSheetTab(app, html, data);
        }
        new ActorSheetCraftedInventory(app, html, data);
      }
    });


//add Subtype to create Item
    Hooks.on("preCreateItem", (doc, createData, options, user) => {
        if (foundry.utils.getProperty(createData, `flags.${Settings.NAMESPACE}.subtype`) === 'recipe' ) {
            doc.updateSource({"flags.beavers-crafting.subtype": Settings.RECIPE_SUBTYPE,"img":"icons/sundries/scrolls/scroll-worn-tan.webp"});
        }
        if (foundry.utils.getProperty(createData,`flags.${Settings.NAMESPACE}.subtype`) === 'anyOf' ) {
            doc.updateSource({"flags.beavers-crafting.subtype": Settings.ANYOF_SUBTYPE,"img":"modules/beavers-crafting/icons/anyOf.png"});
        }
    });

//evil TODO fix this make recipes own type !
// own type does not yet work for all supported systems.

    Hooks.on("getDialogHeaderButtons", (dialog,buttons) => {
        hookForCatchingDialogTitle(dialog,buttons) //v1
    });
    Hooks.on("getHeaderControlsApplicationV2", (dialog,buttons) => {
        hookForCatchingDialogTitle(dialog,buttons)
    });

    function hookForCatchingDialogTitle(dialog, buttons){
        if(Settings.get(Settings.CAPTURE_CREATE_ITEM_TITLE)) {
            var title = dialog.data?.title || dialog.options.window.title;
            var captureItemWindow = (e)=> {
                ui.notifications.info("Capture and set title of window for beavers-crafting module to "+title);
                Settings.set(Settings.CREATE_ITEM_TITLE, title);
                Settings.set(Settings.CAPTURE_CREATE_ITEM_TITLE,false);
                dialog.close()
            }
            buttons.unshift({
                action: "captureItemWindow",
                icon: "fas fa-bullseye",
                label: "capture item creation window",
                onClick: captureItemWindow,
                onclick: captureItemWindow
            });
        }
    }

    function hookForCatchingCreateItemDialog(app, html, version){
        if (version === 1 || app instanceof foundry.applications?.api?.ApplicationV2) {
            const title = game.settings.get(Settings.NAMESPACE, Settings.CREATE_ITEM_TITLE) || "Create New Item";
            if(!html.jquery) html = $(html);
            if (html[0]?.localName !== "div" && html[0]?.localName !== "dialog") {
                html = $(html[0].parentElement.parentElement);
            }
            let windowTitle = app.data?.title;//V1
            if(!windowTitle) windowTitle = app.options.window.title; //V2
            if (windowTitle === title || windowTitle === "Create Item" || windowTitle === "Create New Item") {
                if (game.system.id === "dnd5e" && game["dnd5e"].version.split(".")[0] >= 3) {
                    dnd5e(html);
                    app.setPosition({ height: "auto" });
                } else {
                    legacy(html);
                }
            }
        }
    }

    Hooks.on("renderDialog", (app, html, content) => {
        hookForCatchingCreateItemDialog(app,html,1);
    });

    Hooks.on("renderDialogV2", (app, html, content) => {
        hookForCatchingCreateItemDialog(app,html,2);
    });
    //dnd5e v5.2.x
    Hooks.on("renderCreateDocumentDialog", (app,html,content) => {
      hookForCatchingCreateItemDialog(app,html,2);
    });

    //pathfinder1
    Hooks.on("renderItemCreateDialog", (app, html, content) => {
        if(!html.jquery) html = $(html);
        legacy(html);
    });

    function legacy(html){
        const itemType = beaversSystemInterface.configLootItemType;

        html.find("select[name='type']").append("<option value='"+itemType+"'>📜Recipe📜</option>");
        html.find("select[name='type']").append("<option value='"+itemType+"'>❔AnyOf❔</option>");
        if (html.find("input.subtype").length === 0) {
            var form = html.find("form");
            if(form.length === 0 && html.prop("tagName") === "FORM"){
                form = html;
            }
            form.append('<input class="subtype" name="flags.beavers-crafting.subtype" style="display:none" value="">');
        }

        html.find("select[name='type']").on("change", function (event) {
            const name = $(this).find("option:selected").text();
            let value = "";
            if (name === "📜Recipe📜") {
                event.stopPropagation();
                html.find("select[name='system.subType']").parent().parent().remove()
                value = "recipe"
            }
            if (name === "❔AnyOf❔") {
                event.stopPropagation();
                html.find("select[name='system.subType']").parent().parent().remove()
                value = "anyOf"
            }
            html.find("input.subtype").val(value);
        })
    }
    //temp quickwin
    function dnd5e(html){
        const itemType = beaversSystemInterface.configLootItemType;
        html.find("ol.card").append(`<li>
            <label>
                <img src="icons/sundries/scrolls/scroll-worn-tan.webp" alt="Recipe">
                <span>Recipe</span>
                <input type="radio" data-subType="recipe" name="type" value="${itemType}">
            </label>
        </li><li>
            <label>
                <img src="modules/beavers-crafting/icons/anyOf.png" alt="AnyOf">
                <span>AnyOf</span>
                <input type="radio" data-subType="anyOf" name="type" value="${itemType}">
            </label>
        </li><input class="subtype" name="flags.beavers-crafting.subtype" style="display:none" value="">`)
        html.find("input[type=radio]").on("click", function () {
            const subType = $(this).data("subtype");
            html.find("input.subtype").val(subType);
        })
    }

    getTemplate('modules/beavers-crafting/templates/beavers-folders.hbs').then(t=>{
        Handlebars.registerPartial('beavers-folders', t);
    });
    getTemplate('modules/beavers-crafting/templates/beavers-recipe-folder-item.hbs').then(t=>{
        Handlebars.registerPartial('beavers-recipe-folder-item', t);
    });
    getTemplate('modules/beavers-crafting/templates/beavers-actor-folder-item.hbs').then(t=>{
        Handlebars.registerPartial('beavers-actor-folder-item', t);
    });
    getTemplate('modules/beavers-crafting/templates/beavers-recipe-component.hbs').then(t=>{
        Handlebars.registerPartial('beavers-recipe-component', t);
    });
    getTemplate('modules/beavers-crafting/templates/beavers-recipe.hbs').then(t=>{
        Handlebars.registerPartial('beavers-recipe', t);
    })
});

//fucking stupid handlebars !!!
Handlebars.registerHelper('beavers-isEmpty', function (value, options) {
    return value === undefined ||
    (value instanceof Object && Object.keys(value).length === 0) ||
    (value instanceof Array && value.length === 0)
});

Handlebars.registerHelper("beavers-objectLen", function(json) {
    return Object.keys(json).length;
});
Handlebars.registerHelper('beavers-split', function (input, delimiter) {
    if (typeof input === 'string') {
        return input.split(delimiter); // Split the string by the specified delimiter
    }
    return []; // Return an empty array if input is not a string
});