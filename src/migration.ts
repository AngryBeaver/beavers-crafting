import {Settings} from "./Settings.js";
import {Crafting} from "./Crafting.js";
import {DefaultTest, Recipe} from "./Recipe.js";


export async function migrateRecipeToOrConditions(recipe: Recipe) {

    async function migrateRecipe(recipe) {
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

export async function itemTypeMigration() {
    async function addItemType(component) {
        if (component.type === "Item") {
            const entity = await component.getEntity();
            component.itemType = entity.type;
        }
    }

    async function migrateRecipe(recipe) {
        if (recipe.attendants) {
            for (const key in recipe.attendants) {
                await addItemType(recipe.attendants[key]);
            }
        }
        if (recipe.ingredients) {
            for (const key in recipe.ingredients) {
                await addItemType(recipe.ingredients[key]);
            }
        }
        if( recipe.results) {
            for (const key in recipe.results) {
                await addItemType(recipe.results[key]);
            }
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
        try {
            recipeSkillToTests(recipe);
            await recipe.update();
        } catch (e) {
            ui.notifications?.warn("Beavers Crafting |" + e);
        }
    }
    ui.notifications?.info("Beavers Crafting | migration: actors");
    for (const actor of game["actors"]) {
        for (const recipe of game[Settings.NAMESPACE].RecipeCompendium.getForActor(actor)) {
            try {
                recipeSkillToTests(recipe);
                await recipe.update();
            } catch (e) {
                ui.notifications?.warn("Beavers Crafting |" + e);
            }
        }
        const flag = getProperty(actor, `flags.${Settings.NAMESPACE}.crafting`) || {};
        for (const [x, y] of Object.entries(flag)) {
            try {
                const craftingData = (y as CraftingData);
                const crafting = new Crafting(craftingData, actor);
                recipeSkillToTests(crafting.recipe);
                recipeSkillToTests(crafting.result._recipe);
                await crafting._addToActor()
            } catch (e) {
                ui.notifications?.warn("Beavers Crafting |" + e);
            }
        }
    }
    ui.notifications?.info("Beavers Crafting | migration: done");
}

export async function migrateDeprecateTools() {

    ui.notifications?.info("Beavers Crafting | migration: items");
    for (const recipe of game[Settings.NAMESPACE].RecipeCompendium.getAllItems()) {
        try {
            await toolToAttendant(recipe);
            await recipe.update();
        } catch (e) {
            ui.notifications?.warn("Beavers Crafting |" + e);
        }
    }
    ui.notifications?.info("Beavers Crafting | migration: actors");
    for (const actor of game["actors"]) {
        for (const recipe of game[Settings.NAMESPACE].RecipeCompendium.getForActor(actor)) {
            try {
                await toolToAttendant(recipe);
                await recipe.update();
            } catch (e) {
                ui.notifications?.warn("Beavers Crafting |" + e);
            }
        }
        const flag = getProperty(actor, `flags.${Settings.NAMESPACE}.crafting`) || {};
        for (const [x, y] of Object.entries(flag)) {
            try {
                const craftingData = (y as CraftingData);
                const crafting = new Crafting(craftingData, actor);
                await toolToAttendant(crafting.recipe);
                const resultRecipe = new Recipe("invalid", "invalid", "invalid", "invalid", crafting.result._recipe);
                await toolToAttendant(resultRecipe);
                await crafting._addToActor()
            } catch (e) {
                ui.notifications?.warn("Beavers Crafting |" + e);
            }
        }
    }
    ui.notifications?.info("Beavers Crafting | migration: done");
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
        recipe["-=skill"] = null;
    }
}

export async function toolToAttendant(recipe: Recipe) {
    if (recipe.tool != undefined) {
        const item = await beaversSystemInterface.uuidToDocument(recipe.tool);
        recipe.addRequired(item, item.uuid, "");
        recipe.removeTool();
    }
}


