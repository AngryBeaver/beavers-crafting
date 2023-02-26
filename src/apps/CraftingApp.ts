import {FilterType, RecipeCompendium} from "./RecipeCompendium.js";
import {Crafting} from "../Crafting.js";
import {getDataFrom, getItem, sanitizeUuid} from "../helpers/Utility.js";
import {Settings} from "../Settings.js";
import {getToolConfig} from "./ToolConfig.js";
import {AnyOf} from "../AnyOf.js";
import {Recipe} from "../Recipe.js";
import {Result} from "../Result.js";

export class CraftingApp extends Application {
    data: {
        actor,
        filter,
        recipes:Recipe[],
        index,
        filterItems:{},
        recipe?:Recipe,
        content?,
        result?:Result,
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
        if(this.element.length > 0){
            this.bringToTop();
        }
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            // @ts-ignore
            title: game.i18n.localize(`beaversCrafting.crafting-app.title`),
            width: 700,
            height: 450,
            template: "modules/beavers-crafting/templates/crafting-app.hbs",
            closeOnSubmit: true,
            submitOnClose: true,
            submitOnChange: true,
            resizable: true,
            classes: ["sheet", "beavers-crafting","crafting-app"],
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
        if (this.data.recipe === undefined || this.element === null) {
            return;
        }
        const crafting = await Crafting.from(this.data.actor.id, this.data.recipe.uuid);
        RecipeCompendium.validateRecipeToItemList(Object.values(this.data.recipe.ingredients), this.data.actor.items,crafting.result);
        await crafting.checkTool();
        await crafting.checkAttendants();
        this.data.result = crafting.result;
        this.data.content = await renderTemplate('modules/beavers-crafting/templates/recipe-main.hbs',
            {
                recipe: this.data.recipe,
                currencies: beaversSystemInterface.configCurrencies,
                skills: beaversSystemInterface.configSkills,
                abilities: beaversSystemInterface.configCanRollAbility?beaversSystemInterface.configAbilities:[],
                editable: false,
                precast: await this.getPrecastFromResult(this.data.result,this.data.recipe),
                displayResults:Settings.get(Settings.DISPLAY_RESULTS),
                displayIngredients:Settings.get(Settings.DISPLAY_RESULTS),
                tools: await getToolConfig(),
                useTool: Settings.get(Settings.USE_TOOL),
                useAttendants: Settings.get(Settings.USE_ATTENDANTS)
            });
        this.element.find(".sheet-body").empty();
        this.element.find(".sheet-body").append(this.data.content);
        this.activateRecipeSheetListener(this.element);
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
                    this.close();
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
            this.data.recipe = Recipe.clone(this.data.recipes[index]);
            html.find(".sidebar a.item.selected").removeClass("selected");
            html.find(".sidebar a.item[data-id =" + index + "]").addClass("selected");
            void this.renderRecipeSheet();
        });
        void this.renderRecipeSheet();
    }

    activateRecipeSheetListener(html) {
        html.find('.results .flexrow').on("click",e=>{
            const uuid = $(e.currentTarget).data("id");
            if(Settings.get(Settings.DISPLAY_RESULTS)) {
                getItem(uuid).then(i=>i.sheet._render(true));
            }
        });
        html.find('.ingredients .flexrow').on("click",e=>{
            const uuid = $(e.currentTarget).data("id");
            if(Settings.get(Settings.DISPLAY_INGREDIENTS)) {
                getItem(uuid).then(i=>i.sheet._render(true));
            }
        });
        this.addDragDrop(html);
    }

    addDragDrop(html) {
        const dropFilter = new DragDrop({
            dropSelector: '.drop-area, .ingredients .flexrow',
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
        const uuid = $(e.currentTarget).data("id");
        if(uuid != undefined){
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
                const component = beaversSystemInterface.componentFromEntity(entity);
                const nextKey = sanitizeUuid(data.uuid);
                component.quantity = previousComponent.quantity;
                this.data.recipe = Recipe.clone(this.data.recipe);
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

    async getPrecastFromResult(result: Result, recipe: Recipe): Promise<PreCastData>{
        const preCastData:PreCastData = {
            attendants: {},
            currencies: !result._currencyResult?.hasError,
            ingredients: {},
            tool: false,
        }
        for(const key in recipe.ingredients){
            const component = recipe.ingredients[key];
            preCastData.ingredients[key]={
                isAvailable: !result._components.consumed.hasError(component)
            }
        }
        for(const key in recipe.attendants){
            const component = recipe.attendants[key];
            preCastData.attendants[key]={
                isAvailable: !result._components.required.hasError(component)
            }
        }
        if(Settings.get(Settings.USE_TOOL) && recipe.tool){
            const item = await getItem(recipe.tool);
            const component = beaversSystemInterface.componentFromEntity(item);
            preCastData.tool = !result._components.required.hasError(component)
        }
        return preCastData;
    }
}

