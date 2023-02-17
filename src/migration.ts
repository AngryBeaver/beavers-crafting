import {Settings} from "./Settings.js";
import {Crafting} from "./Crafting.js";
import {DefaultTest, Recipe} from "./Recipe.js";

export async function itemTypeMigration() {
    async function addItemType(component) {
        if (component.type === "Item") {
            const entity = await component.getEntity();
            component.itemType = entity.type;
        }
    }

    async function migrateRecipe(recipe) {
        for (const key in recipe.attendants) {
            await addItemType(recipe.attendants[key]);
        }
        for (const key in recipe.ingredients) {
            await addItemType(recipe.ingredients[key]);
        }
        for (const key in recipe.results) {
            await addItemType(recipe.results[key]);
        }
        await recipe.update();
    }

    ui.notifications?.info("Beavers Crafting | migration: items");
    for (const recipe of game[Settings.NAMESPACE].RecipeCompendium.getAllItems()) {
        await migrateRecipe(recipe);
    }
    ui.notifications?.info("Beavers Crafting | migration: actors");
    for (const actor of game["actors"]) {
        for (const recipe of game[Settings.NAMESPACE].RecipeCompendium.getForActor(actor)) {
            await migrateRecipe(recipe);
        }
    }
    ui.notifications?.info("Beavers Crafting | migration: done");
}

export async function migrateRecipeSkillToTests() {

    ui.notifications?.info("Beavers Crafting | migration: items");
    for (const recipe of game[Settings.NAMESPACE].RecipeCompendium.getAllItems()) {
         recipeSkillToTests(recipe);
        await recipe.update();
    }
    ui.notifications?.info("Beavers Crafting | migration: actors");
    for (const actor of game["actors"]) {
        for (const recipe of game[Settings.NAMESPACE].RecipeCompendium.getForActor(actor)) {
             recipeSkillToTests(recipe);
            await recipe.update();
        }
        const flag = this.app.actor.flags["beavers-crafting"]?.crafting || {};
        for (const [x, y] of Object.entries(flag)) {
            const craftingData = (y as CraftingData);
            const crafting = new Crafting(craftingData, this.app.actor);
             recipeSkillToTests(crafting.recipe);
             recipeSkillToTests(crafting.result._recipe);
            await crafting._addToActor()
        }
        ui.notifications?.info("Beavers Crafting | migration: done");
    }
}

export function recipeSkillToTests(recipe: RecipeData) {
    if (recipe.skill != undefined) {
        if (recipe.tests != undefined) {
            throw Error("can't migrate recipe as it already has tests and skill remove one manually");
        }
        recipe.tests = new DefaultTest();
        if (recipe.tests !== undefined) {
            recipe.skill.name
            const skillParts = recipe.skill.name.split("-")
            let skillName = skillParts[0];
            recipe.tests.ands[1].ors[1].type = "skill";
            recipe.tests.ands[1].ors[1].uuid = skillName;
            recipe.tests.ands[1].ors[1].check = recipe.skill.dc;
            if (skillName === 'ability') {
                recipe.tests.ands[1].ors[1].type = "ability";
                recipe.tests.ands[1].ors[1].uuid = skillParts[1];
            }
        }
        delete recipe.skill;
        recipe["-=skill"]=null;
    }
}

