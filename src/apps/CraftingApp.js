export class CraftingApp extends FormApplication {
    constructor(actor) {
        super();
        this.actor = actor;
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            width: 600,
            height: 680,
            template: "modules/beavers-crafting/templates/crafting-app.hbs",
            closeOnSubmit: false,
            submitOnClose: true,
            submitOnChange: true,
            resizable: true,
            classes: ["sheet", "journal-sheet", "journal-entry","beavers-crafting"],
            popOut: true,
            id: 'beavers-crafting',
            title: game.i18n.localize(`beavers-crafting.recipeApp.title`),
            dragDrop: [{dragSelector: ".item-list .item", dropSelector: null}]
        });
    }

    getData() {
        console.log(this.actor.items);
        // Send data to the template
        return {
            items: this.actor.items,
            msg: this.actor.items,
            color: 'red',
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
    }

    async _onDrop(event) {
        const isIngredient = event.target.classList.contains("");
        const isProduct = event.target.classList.contains("mastercrafted-result");
        if(!isIngredient && !isProduct) return;
        let data;
        try {
            data = JSON.parse(event.dataTransfer.getData('text/plain'));
        }
        catch (err) {
            return false;
        }
        if(!data.type === "Item") return;
        const recipeId = event.target.closest(".mastercrafted-recipe").dataset.recipeId;
        const bookId = event.target.closest(".mastercrafted-recipe").dataset.bookId;
        const ingredientId = event.target.dataset.ingredientId;
        const productId = event.target.dataset.resultId;
        const recipe = RecipeBook.get(bookId).getRecipe(recipeId);
        const item = await fromUuid(data.uuid);
        if(isIngredient) {
            if(recipe.hasComponent(item.name)){
                return ui.notifications.error(game.i18n.localize(`${MODULE_ID}.recipeApp.errors.alreadyingredient`));
            }
            recipe.addComponent(ingredientId,data.uuid, item.name);
        }
        if(isProduct) {
            recipe.addProduct(productId,data.uuid, item.name);
        }
    }


    async _updateObject(event, formData) {
        console.log(formData.exampleInput);
    }
}