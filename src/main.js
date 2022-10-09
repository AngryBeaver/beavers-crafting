import {CraftingApp} from './apps/CraftingApp.js';
import {RecipeSheet} from './RecipeSheet.js';
import {Settings} from './Settings.js';
import {Crafting} from "./Crafting.js";
import {RecipeCompendium} from "./RecipeCompendium.js";

Hooks.once('init', async function () {
    Settings.init();
    if(!game[Settings.NAMESPACE])game[Settings.NAMESPACE]={};
    game[Settings.NAMESPACE].Crafting = Crafting;
    game[Settings.NAMESPACE].RecipeCompendium = RecipeCompendium;
});

Hooks.on("getActorSheetHeaderButtons", (app, buttons) => {
    buttons.unshift({
        label: "beaversCrafting.actorLink",
        class: "beaversCrafting",
        icon: "fas fa-scroll",
        onclick: () => new CraftingApp(app.object).render(true)
    });
});

//Recipe remap use action
Hooks.on(`dnd5e.preUseItem`, (item, config, options) => {
    console.log(item);
    if(item.flags[Settings.NAMESPACE]?.recipe){
        Crafting.fromOwned(item).craft();
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
        doc.updateSource({"system.source": game.settings.get(Settings.NAMESPACE,Settings.RECIPE_SOURCE_NAME),"img":"icons/sundries/scrolls/scroll-worn-tan.webp"});
    }
});
//evil
Hooks.on("renderDialog", (app, html, content) => {
    const title = game.settings.get(Settings.NAMESPACE,Settings.CREATE_ITEM_TITLE)||"Create New Item";
    if (app.data.title === title) {
        if (html[0].localName !== "div") {
            html = $(html[0].parentElement.parentElement);
        }
        html.find("select[name='type']").append("<option value='loot'>📜Recipe📜</option>");
        if (html.find("input.subtype").length === 0) {
            html.find("form").append('<input class="subtype" name="subtype" style="display:none" value="">');
        }
        console.log("here");
        html.find("select[name='type']").on("change", function () {
            const name = $(this).find("option:selected").text();
            let value = "";
            if (name === "📜Recipe📜") {
                value = "recipe"
            }
            html.find("input.subtype").val(value);
        })
    }
});



//fucking stupid handlebars !!!
Handlebars.registerHelper('hasKey', function (param1, key, options) {
    if (param1[key]) {
        return options.fn(this);
    }
    return options.inverse(this);
});