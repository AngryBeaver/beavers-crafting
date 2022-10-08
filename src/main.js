import {CraftingApp} from './apps/CraftingApp.js';
import {RecipeSheet} from './RecipeSheet.js';
import {Settings} from './Settings.js';
import {Crafting} from "./Crafting.js";
import {BEAVERS_CRAFTING} from "./consts.js";

Hooks.once('init', async function () {
    Settings.init();
    if(!game[Settings.NAMESPACE])game[Settings.NAMESPACE]={};
    game[Settings.NAMESPACE].Crafting = Crafting;
});


Hooks.on("getActorSheetHeaderButtons", (app, buttons) => {
    buttons.unshift({
        label: "beaversCrafting.actorLink",
        class: "beaversCrafting",
        icon: "fas fa-hammer",
        onclick: () => new CraftingApp(app.object).render(true)
    });
});

//Recipe remap use action
Hooks.on(`dnd5e.preUseItem`, (item, config, options) => {
    console.log(item);
    if(item.flags[Settings.NAMESPACE]?.recipe){
        new Crafting(item.parent, item).craft();
        return false;
    }
});


//RecipeSubTypeSheet
Hooks.on(`renderItemSheet5e`, (app, html, data) => {
    RecipeSheet.bind(app, html, data);
});

//add RecipeSubtype to create Item
Hooks.on("preCreateItem", (doc, createData, options, user) => {
    if (createData.subtype && createData.subtype === 'recipe' &&
        !foundry.utils.hasProperty(createData, "system.source")) {
        doc.updateSource({"system.source": "Recipe","img":"icons/tools/hand/hammer-backing-steel.webp"});
    }
});
//evil
Hooks.on("renderDialog", (app, html, content) => {
    if (app.data.title === "Create New Item") {
        if (html[0].localName !== "div") {
            html = $(html[0].parentElement.parentElement);
        }
        html.find("select").append("<option value='loot'>🛠Recipe🛠</option>");
        if (html.find("input.subtype").length === 0) {
            html.find("form").append('<input class="subtype" name="subtype" style="display:none" value="">');
        }
        html.find("select").on("change", function () {
            const name = $(this).find("option:selected").text();
            let value = "";
            if (name === "🛠Recipe🛠") {
                value = "recipe"
            }
            html.find("input.subtype").val(value);
        })
    }
});



//for convenient
Handlebars.registerHelper('hasKey', function (param1, key, options) {
    console.log(param1);
    console.log(key);
    if (param1[key]) {
        return options.fn(this);
    }
    return options.inverse(this);
});
