import {getCurrencies, getSkills} from "../systems/dnd5e.js";
import {FilterType, RecipeCompendium} from "../RecipeCompendium.js";
import {Crafting} from "../Crafting.js";

export class CraftingApp extends Application {
    data: {
        actor,
        filter,
        recipes,
        index,
        recipe?,
        content?,
        result?
    };

    constructor(actor, options: any = {}) {
        super(options);
        this.data = {
            actor: actor,
            filter: FilterType.available,
            recipes: [],
            index:0
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
            classes: ["dnd5e","sheet","beavers-crafting"],
            popOut: true,
            id: 'beavers-crafting',
            dragDrop: [{dragSelector: ".item-list .item", dropSelector: null}]
        });
    }

    async getData(options={}) {
        const data: any = mergeObject(this.data, await super.getData(options));
        data.recipes = RecipeCompendium.filterForActor(data.actor, data.filter);
        await this.renderRecipeSheet(data);
        return data;
    }

    async renderRecipeSheet(data){
        data.recipe = data.recipes[data.index];
        console.log(data);
        if(!data.recipe) {
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
        console.log(data);
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
            this.renderRecipeSheet(this.data).then( data => {
                html.find(".sheet-body").empty();
                html.find(".sheet-body").append(data.content);
                html.find(".crafting-app a.item.selected").removeClass("selected");
                html.find(".crafting-app a.item[data-id ="+index+"]").addClass("selected");
            });
        });

        html.find(".dialog-button").on("click",(e)=>{
            Crafting.from(this.data.actor.id,this.data.recipe.id)
                .then(crafting=>{
                    return crafting.craft();

                }).then(result=>{
                    if(!result.hasErrors){
                        this.render();
                    }
                });
        });
    }
}