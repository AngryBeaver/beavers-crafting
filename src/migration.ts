import {Settings} from "./Settings.js";
import {Crafting} from "./Crafting.js";
import { DefaultTest, Recipe } from "./Recipe.js";


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

export async function migrateRecipeTestsToBeaversTests() {

    ui.notifications?.info("Beavers Crafting | migration: items");
    for (const recipe of game[Settings.NAMESPACE].RecipeCompendium.getAllItems()) {
        try {
            recipeTestsToBeaversTests(recipe);
            await recipe.update();
        } catch (e) {
            ui.notifications?.warn("Beavers Crafting |" + e);
        }
    }
    ui.notifications?.info("Beavers Crafting | migration: actors");
    for (const actor of game["actors"]) {
        for (const recipe of game[Settings.NAMESPACE].RecipeCompendium.getForActor(actor)) {
            try {
                recipeTestsToBeaversTests(recipe);
                await recipe.update();
            } catch (e) {
                ui.notifications?.warn("Beavers Crafting |" + e);
            }
        }
        const flag = foundry.utils.getProperty(actor, `flags.${Settings.NAMESPACE}.crafting`) || {};
        for (const [x, y] of Object.entries(flag)) {
            try {
                const craftingData = (y as CraftingData);
                const crafting = new Crafting(craftingData, actor);
                recipeTestsToBeaversTests(crafting.recipe);
                recipeTestsToBeaversTests(crafting.result._recipe);
                await crafting._addToActor()
            } catch (e) {
                ui.notifications?.warn("Beavers Crafting |" + e);
            }
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
        const flag = foundry.utils.getProperty(actor, `flags.${Settings.NAMESPACE}.crafting`) || {};
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
        const flag = foundry.utils.getProperty(actor, `flags.${Settings.NAMESPACE}.crafting`) || {};
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

export function recipeTestsToBeaversTests(recipe: RecipeData) {
    if (recipe.tests != undefined) {
        console.log("migrate recipe ");
        if (recipe.beaversTests != undefined) {
            console.warn("recipe has both migrated and not migrated data");
        }
        recipe.beaversTests = { ands:{}, consume:recipe.tests.consume, fails: recipe.tests.fails} as BeaversCraftingTests
        for (let key in recipe.tests.ands) {
            recipe.beaversTests.ands[key] = {ors:{},hits:recipe.tests.ands[key].hits} as BeaversTestAnd
            for (let orKey in recipe.tests.ands[key].ors) {
                if(recipe.tests.ands[key].ors[orKey].type === "skill") {
                    if(!beaversSystemInterface.testClasses["SkillTest"]) {
                        ui.notifications?.error("can't migrate recipe. Missing SkillTest plz upgrade your bsa-x");
                        throw Error("can't migrate recipe. Missing SkillTest plz upgrade your bsa-x");
                    }
                    recipe.beaversTests.ands[key].ors[orKey] = {
                        type: "SkillTest",
                        data: {
                            dc:recipe.tests.ands[key].ors[orKey].check,
                            skill:recipe.tests.ands[key].ors[orKey].uuid
                        }
                    }

                }
                if(recipe.tests.ands[key].ors[orKey].type === "ability") {
                    if(!beaversSystemInterface.testClasses["AbilityTest"]) {
                        ui.notifications?.error("can't migrate recipe. Missing AbilityTest plz upgrade your bsa-x");
                        throw Error("can't migrate recipe. Missing AbilityTest plz upgrade your bsa-x");
                    }
                    recipe.beaversTests.ands[key].ors[orKey] = {
                        type: "AbilityTest",
                        data: {
                            dc:recipe.tests.ands[key].ors[orKey].check,
                            ability:recipe.tests.ands[key].ors[orKey].uuid
                        }
                    }
                }
                if(recipe.tests.ands[key].ors[orKey].type === "hit") {
                    if(!beaversSystemInterface.testClasses["IncrementStep"]) {
                        ui.notifications?.error("can't migrate recipe. Missing IncrementStep plz upgrade your bsa-x");
                        throw Error("can't migrate recipe. Missing IncrementStep plz upgrade your bsa-x");
                    }
                    recipe.beaversTests.ands[key].ors[orKey] = {
                        type: "IncrementStep",
                        data: {
                            name:recipe.tests.ands[key].ors[orKey].uuid
                        }
                    }
                }
                if(recipe.tests.ands[key].ors[orKey].type === "tool") {
                    if(!beaversSystemInterface.testClasses["ToolTest"]) {
                        ui.notifications?.error("can't migrate recipe. Missing ToolTest plz upgrade your bsa-x");
                        throw Error("can't migrate recipe. Missing ToolTest plz upgrade your bsa-x");
                    }
                    recipe.beaversTests.ands[key].ors[orKey] = {
                        type: "ToolTest",
                        data: {
                            dc: recipe.tests.ands[key].ors[orKey].check,
                            tool:recipe.tests.ands[key].ors[orKey].uuid
                        }
                    }
                }
            }
        }
        // @ts-ignore
        delete recipe.tests;
        recipe["-=tests"] = null;
        return true;
    }
    return false;
}
export function recipeSkillToTests(recipe: RecipeData) {
    // @ts-ignore
    if (recipe.skill != undefined) {
        if (recipe.tests != undefined) {
            throw Error("can't migrate recipe as it already has tests and skill. Remove one manually");
        }
        recipe.tests = new DefaultTest();
        if (recipe.tests !== undefined) {
            // @ts-ignore
            recipe.skill.name
            // @ts-ignore
            const skillParts = recipe.skill.name.split("-")
            let skillName = skillParts[0];
            recipe.tests.ands[1].ors[1].type = "skill";
            recipe.tests.ands[1].ors[1].uuid = skillName;
            // @ts-ignore
            recipe.tests.ands[1].ors[1].check = recipe.skill.dc;
            if (skillName === 'ability') {
                recipe.tests.ands[1].ors[1].type = "ability";
                recipe.tests.ands[1].ors[1].uuid = skillParts[1];
            }
        }
        // @ts-ignore
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


