import {Recipe} from "../Recipe.js";
import {Settings} from "../Settings.js";
import {getCurrencies, getSkills} from "../systems/dnd5e.js"
import {RecipeCompendium} from "./RecipeCompendium.js";
import {getDataFrom, getItem} from "../helpers/Utility.js";
import {isAnyOf} from "./AnyOfSheet.js";

const recipeSheets: { [key: string]: RecipeSheet } = {};

export class RecipeSheet {
    app;
    item;
    editable:boolean;
    recipe:Recipe;
    recipeElement?;


    static bind(app, html, data) {
        if(RecipeCompendium.isRecipe(app.item)){
            if(!recipeSheets[app.id]){
                recipeSheets[app.id] = new RecipeSheet(app,data);
            }
            recipeSheets[app.id].init(html);
        }
    }

    constructor(app, data) {
        this.app = app;
        this.item = app.item;
        this.editable = data.editable;
        this.addDragDrop();
    }

    init(html){
        if(html[0].localName !== "div") {
            html = $(html[0].parentElement.parentElement);
        }
        let exists = html.find(".sheet-body .beavers-crafting");
        if(exists.length != 0){
            return;
        }
        this.recipeElement = $('<div class="beavers-crafting recipe"></div>');
        html.find(".sheet-body").empty();
        html.find(".sheet-body").append(this.recipeElement);
        this.recipe = Recipe.fromItem(this.item);
        this.render();
    }

    addDragDrop(){
        if(this.editable) {
            const dragDrop = new DragDrop({
                dropSelector: '.sheet-body',
                permissions: {
                    dragstart: this.app._canDragStart.bind(this.app),
                    drop: this.app._canDragDrop.bind(this.app)
                },
                callbacks: {
                    dragstart: this.app._onDragStart.bind(this.app),
                    dragover: this.app._onDragOver.bind(this.app),
                    drop: this._onDrop.bind(this)
                }
            });
            this.app._dragDrop.push(dragDrop);
            dragDrop.bind(this.app.form);
        }
    }

    async render(){
        let template = await renderTemplate('modules/beavers-crafting/templates/recipe-sheet.hbs',
            {recipe: this.recipe,currencies: getCurrencies(),skills: getSkills(),editable:this.editable,displayResults:Settings.get(Settings.DISPLAY_RESULTS),displayIngredients:Settings.get(Settings.DISPLAY_RESULTS)});
        this.recipeElement.find('.recipe').remove();
        this.recipeElement.append(template);
        this.handleEvents();
    }

    handleEvents() {
        this.recipeElement.find('.ingredients .item-delete').click(e=>{
            this.recipe.removeIngredient(e.target.dataset.id);
            this.update();
        });
        this.recipeElement.find('.results .item-delete').click(e=>{
            this.recipe.removeResults(e.target.dataset.id);
            this.update();
        });
        this.recipeElement.find('.skills .item-delete').click(e=>{
            this.recipe.removeSkill();
            this.update();
        });
        this.recipeElement.find('.skills .item-add').click(e=>{
            this.recipe.addSkill();
            this.update();
        });
        this.recipeElement.find('.currencies .item-delete').click(e=>{
            this.recipe.removeCurrency();
            this.update();
        });
        this.recipeElement.find('.currencies .item-add').click(e=>{
            this.recipe.addCurrency();
            this.update();
        });
        this.recipeElement.find('.results .item-name').on("click",e=>{
            const uuid = $(e.currentTarget).data("id");
            if(Settings.get(Settings.DISPLAY_RESULTS)) {
                getItem(uuid).then(i=>i.sheet._render(true));
            }
        });
        this.recipeElement.find('.ingredients .item-name').on("click",e=>{
            const uuid = $(e.currentTarget).data("id");
            if(Settings.get(Settings.DISPLAY_INGREDIENTS)) {
                getItem(uuid).then(i=>i.sheet._render(true));
            }
        });
    }



    async _onDrop(e) {
        const isIngredient = $(e.target).parents(".beavers-crafting .recipe .ingredients").length !==0;
        const isResult = $(e.target).parents(".beavers-crafting .recipe .results").length !==0;
        if(!isIngredient && !isResult){
            return;
        }
        const data = getDataFrom(e);
        if(data &&
            (data.type === "Item" ||
                (data.type === "RollTable" && isResult)
            )
        ) {
            const entity = await fromUuid(data.uuid);
            if (entity) {
                if (isIngredient) {
                    let type = data.type;
                    let uuid = data.uuid;
                    if(isAnyOf(entity)){
                        type = Settings.ANYOF_SUBTYPE;
                        uuid = foundry.utils.randomID();
                    }
                    this.recipe.addIngredient(entity, uuid,type);
                }
                if (isResult) {
                    this.recipe.addResult(entity, data.uuid, data.type);
                }
                this.update();
            }
        }
    }

    update() {
        const flags={};
        flags[Settings.NAMESPACE] = {
            recipe: this.recipe.serialize()
        };
        this.item.update({
            "flags": flags
        });
        this.render();
    }
}