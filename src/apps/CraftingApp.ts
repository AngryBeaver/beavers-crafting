import {getCurrencies, getSkills} from "../systems/dnd5e.js";
import {FilterType, RecipeCompendium} from "../RecipeCompendium.js";
import {Crafting} from "../Crafting.js";
import {DefaultComponent} from "../Recipe";

export class CraftingApp extends Application {
    data: {
        actor,
        filter,
        recipes,
        index,
        filterItems:{},
        recipe?,
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
            classes: ["dnd5e", "sheet", "beavers-crafting"],
            popOut: true,
            id: 'beavers-crafting'
        });
    }

    async getData(options = {}) {
        const data: any = mergeObject(this.data, await super.getData(options));
        let recipes = RecipeCompendium.filterForActor(data.actor, data.filter);
        if(Object.values(data.filterItems).length != 0){
            recipes = RecipeCompendium.filterForItems(recipes,Object.values(data.filterItems));
        }
        data.recipes = recipes;
        await this.renderRecipeSheet(data);
        return data;
    }

    async renderRecipeSheet(data) {
        data.recipe = data.recipes[data.index];
        if (!data.recipe) {
            data.content = null;
            return null;
        }
        data.result = RecipeCompendium.validateRecipeToItemList(data.recipe, this.data.actor.items);
        data.content = await renderTemplate('modules/beavers-crafting/templates/recipe-sheet.hbs',
            {
                recipe: data.recipe,
                currencies: getCurrencies(),
                skills: getSkills(),
                editable: false,
                result: data.result
            });
        return data;
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find(".header .entry-filter select.search").on("change", (e) => {
            this.data.filter = $(e.target).val();
            this.data.index = 0;
            this.data.content = null;
            this.render();
        });

        html.find(".sidebar a.item").on("click", (e) => {
            const index = $(e.currentTarget).data().id;
            this.data.index = index;
            this.renderRecipeSheet(this.data).then(data => {
                html.find(".sheet-body").empty();
                html.find(".sheet-body").append(data.content);
                html.find(".crafting-app a.item.selected").removeClass("selected");
                html.find(".crafting-app a.item[data-id =" + index + "]").addClass("selected");
            });
        });

        html.find(".dialog-button").on("click", (e) => {
            Crafting.from(this.data.actor.id, this.data.recipe.id)
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
        this.addDragDrop(html);
    }

    addDragDrop(html) {
        const dropFilter = new DragDrop({
            dropSelector: '.drop-area',
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
        this._dragDrop.push(dropFilter);
        dropFilter.bind(html[0]);
    }

    async _onDrop(e){
        const isFilterDrop = $(e.target).hasClass("drop-area");
        if(isFilterDrop){
            return this._onDropFilter(e);
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

export function getDataFrom(e:DragEvent){
    try {
        // @ts-ignore
        return JSON.parse(e.dataTransfer.getData('text/plain'));
    }
    catch (err) {
        return false;
    }
}