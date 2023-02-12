import {Settings} from "./Settings.js";

export async function itemTypeMigration(){
    async function addItemType(component){
        if(component.type === "Item") {
            const entity = await component.getEntity();
            component.itemType = entity.type;
        }
    }
    async function migrateRecipe(recipe){
        for(const key in recipe.attendants){
            await addItemType(recipe.attendants[key]);
        }
        for(const key in recipe.ingredients){
            await addItemType(recipe.ingredients[key]);
        }
        for(const key in recipe.results){
            await addItemType(recipe.results[key]);
        }
        await recipe.update();
    }
    ui.notifications?.info("Beavers Crafting | migration: items");
    for(const recipe of game[Settings.NAMESPACE].RecipeCompendium.getAllItems()){
        await migrateRecipe(recipe);
    }
    ui.notifications?.info("Beavers Crafting | migration: actors");
    for (const actor of game["actors"]){
        for(const recipe of game[Settings.NAMESPACE].RecipeCompendium.getForActor(actor)){
            await migrateRecipe(recipe);
        }
    }
    ui.notifications?.info("Beavers Crafting | migration: done");
}