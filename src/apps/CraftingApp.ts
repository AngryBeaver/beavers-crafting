import {getAbilities, getCurrencies, getSkills} from "../systems/dnd5e.js";
import {FilterType, RecipeCompendium} from "./RecipeCompendium.js";
import {Crafting} from "../Crafting.js";
import {getDataFrom, getItem, sanitizeUuid} from "../helpers/Utility.js";
import {Settings} from "../Settings.js";
import {getToolConfig} from "./ToolConfig.js";
import {AnyOf} from "../AnyOf.js";
import {Component, Recipe} from "../Recipe.js";

export class CraftingApp extends Application {
    data: {
        actor,
        filter,
        recipes:Recipe[],
        index,
        filterItems:{},
        recipe?:Recipe,
        content?,
        result?,
    };

    constructor(actor, options: any = {}) {
        super(options);
        this.data = {
            actor: actor,
            filter: FilterType.available,
            recipes: [],
            index: 0,
            filterItems: {}
        };

    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            // @ts-ignore
            title: game.i18n.localize(`beaversCrafting.crafting-app.title`),
            width: 560,
            height: 400,
            template: "modules/beavers-crafting/templates/crafting-app.hbs",
            closeOnSubmit: true,
            submitOnClose: true,
            submitOnChange: true,
            resizable: true,
            classes: ["dnd5e", "sheet", "beavers-crafting","crafting-app"],
            popOut: true,
            id: 'beavers-crafting'
        });
    }

    async getData(options = {}) {
        const data: any = mergeObject(this.data, await super.getData(options));
        let recipes = await RecipeCompendium.filterForActor(data.actor, data.filter);
        if(Object.values(data.filterItems).length != 0){
            recipes = await RecipeCompendium.filterForItems(recipes,Object.values(data.filterItems));
        }
        data.recipes = recipes;
        data.recipe = data.recipes[data.index];
        data.content = null;
        return data;
    }

    async renderRecipeSheet() {
        if (this.data.recipe === undefined || this._element === null) {
            return;
        }
        this.data.result = RecipeCompendium.validateRecipeToItemList(Object.values(this.data.recipe.ingredients), this.data.actor.items);
        const crafting = await Crafting.from(this.data.actor.id, this.data.recipe.uuid);
        this.data.result = await crafting.checkTool(this.data.result);
        this.data.result = await crafting.checkAttendants(this.data.result);
        this.data.content = await renderTemplate('modules/beavers-crafting/templates/recipe-main.hbs',
            {
                recipe: this.data.recipe,
                currencies: getCurrencies(),
                skills: getSkills(),
                abilities: getAbilities(),
                editable: false,
                result: this.data.result,
                displayResults:Settings.get(Settings.DISPLAY_RESULTS),
                displayIngredients:Settings.get(Settings.DISPLAY_RESULTS),
                tools: await getToolConfig(),
                useTool: Settings.get(Settings.USE_TOOL),
                useAttendants: Settings.get(Settings.USE_ATTENDANTS)
            });
        this._element.find(".sheet-body").empty();
        this._element.find(".sheet-body").append(this.data.content);
        this.activateRecipeSheetListener(this._element);
    }

    activateListeners(html) {

        super.activateListeners(html);
        html.find(".header .entry-filter select.search").on("change", (e) => {
            this.data.filter = $(e.target).val();
            this.data.index = 0;
            this.data.content = null;
            this.render();
        });
        html.find(".dialog-button").on("click", (e) => {
            if (this.data.recipe === undefined){
                return;
            }
            Crafting.fromRecipe(this.data.actor.id, this.data.recipe)
                .then(crafting => {
                    return crafting.craft();
                }).then(result => {
                if (!result.hasErrors) {
                    this.render();
                }
            });
        });
        html.find(".header .drop-area .item").on("click", (e) => {
            const uuid = $(e.currentTarget).data("id");
            delete this.data.filterItems[uuid];
            this.render();
        });
        html.find(".sidebar a.item").on("click", (e) => {
            const index = $(e.currentTarget).data().id;
            this.data.index = index;
            this.data.recipe = this.data.recipes[index];
            html.find(".sidebar a.item.selected").removeClass("selected");
            html.find(".sidebar a.item[data-id =" + index + "]").addClass("selected");
            void this.renderRecipeSheet();
        });
        void this.renderRecipeSheet();
    }

    activateRecipeSheetListener(html) {
        html.find('.results .item-name').on("click",e=>{
            const uuid = $(e.currentTarget).data("id");
            if(Settings.get(Settings.DISPLAY_RESULTS)) {
                getItem(uuid).then(i=>i.sheet._render(true));
            }
        });
        html.find('.ingredients .item-name').on("click",e=>{
            const uuid = $(e.currentTarget).data("id");
            if(Settings.get(Settings.DISPLAY_INGREDIENTS)) {
                getItem(uuid).then(i=>i.sheet._render(true));
            }
        });
        this.addDragDrop(html);
    }

    addDragDrop(html) {
        const dropFilter = new DragDrop({
            dropSelector: '.drop-area, .ingredients .item-name',
            permissions: {
                dragstart: this._canDragStart.bind(this),
                drop: this._canDragDrop.bind(this)
            },
            callbacks: {
                dragstart: this._onDragStart.bind(this),
                dragover: this._onDragOver.bind(this),
                drop: this._onDrop.bind(this)
            }
        });
        if(this._dragDrop.length > 1){
            this._dragDrop.pop();
        }
        this._dragDrop.push(dropFilter);
        dropFilter.bind(html[0]);
    }

    async _onDrop(e){
        const isFilterDrop = $(e.target).hasClass("drop-area");
        if(isFilterDrop){
            return this._onDropFilter(e);
        }
        const isIngredient = $(e.target).parent("item");
        if(isIngredient){
            const uuid = $(e.currentTarget).data("id");
            const key = $(e.currentTarget).data("key");
            getItem(uuid).then(
                item => {
                    if(AnyOf.isAnyOf(item)){
                       return this._onDropAnyOf(new AnyOf(item),key,e);
                    }
                    return;
                }
            )
        }

    }

    async _onDropAnyOf(anyOf:AnyOf, key:string, e:DragEvent) {
        if (this.data.recipe === undefined){
            return;
        }
        const data = getDataFrom(e);
        if(data) {
            if (data.type !== "Item") return;
            const entity = await fromUuid(data.uuid);
            let result = await anyOf.executeMacro(entity);
            if(result.value) {
                const previousComponent = this.data.recipe.ingredients[key];
                const component = new Component(entity, data.uuid, data.type);
                const nextKey = sanitizeUuid(data.uuid);
                component.quantity = previousComponent.quantity;
                this.data.recipe = Recipe.fromRecipe(this.data.recipe);
                //remove existing ingredient with same id and add quantity;
                if(this.data.recipe.ingredients[nextKey]){
                    component.quantity = component.quantity + this.data.recipe.ingredients[nextKey].quantity;
                    delete this.data.recipe.ingredients[nextKey];
                }
                //copyInPlace;
                const ingredients = Object.fromEntries(
                    Object.entries(this.data.recipe.ingredients).map(([o_key, o_val]) => {
                        if (o_key === key) return [nextKey, component];
                        return [o_key, o_val];
                    })
                );
                this.data.recipe.ingredients = ingredients;
                void this.renderRecipeSheet();
            }

        }
    }

    async _onDropFilter(e:DragEvent){
        const data = getDataFrom(e)
        if(data){
            if(data.type !== "Item") return;
            let entity = await fromUuid(data.uuid);
            this.data.filterItems[data.uuid] = entity;

            this.render();
        }
    }
}

