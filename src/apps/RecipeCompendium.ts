import {Recipe} from "../Recipe.js";
import {Settings} from "../Settings.js";
import {AnyOf} from "../AnyOf.js";
import {Script} from "../Script.js";
import {Result} from "../Result.js";
import {Container} from "../Container.js";
import { getActorContentPool } from "../ContainerHandler.js";
import { RecipeKnowledge } from "../RecipeKnowledge.js";

function isAllowedToSee(item:Item):boolean{
  // @ts-ignore
  return item.testUserPermission(game.user, foundry.CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED);
}

export class RecipeCompendium {

    static getForActor(actor): Recipe[] {
        // @ts-ignore
        return actor.items
            .filter(item => Recipe.isRecipe(item))
            .map(item => Recipe.fromItem(item));
    }

    static getAllItems(): Recipe[] {
        // @ts-ignore
        return game.items
            .filter(item => {
                return isAllowedToSee(item) && Recipe.isRecipe(item)
            })
            .map(item => Recipe.fromItem(item));
    }

    /** world recipes the user may see and the actor has not learned: a learned one is listed as the actor's own copy */
    static getWorldFor(actor): Recipe[] {
        // @ts-ignore
        return game.items
            .filter(item => isAllowedToSee(item) && Recipe.isRecipe(item) && !RecipeKnowledge.findLearned(actor, item))
            .map(item => Recipe.fromItem(item));
    }

    static getAll(actor): Recipe[] {
        return [...RecipeCompendium.getWorldFor(actor), ...RecipeCompendium.getForActor(actor)];
    }

    static _filterData(data: { [key: string]: { [key: string]: Component } }, filter: (component: Component) => boolean): Component[] {
        const list: Component[] = [];
        for (const group of Object.values(data)) {
            for (const component of Object.values(group)) {
                if (filter(component)) {
                    list.push(component);
                }
            }
        }
        return list;
    }


    static async filterForItems(recipes: Recipe[], items) {
        const returnList: Recipe[] = [];
        for (const recipe of recipes) {
            const listOfAnyOfIngredients = this._filterData(recipe.input, component => component.type === Settings.ANYOF_SUBTYPE);
            const listOfIngredientsWithoutAnyOf = this._filterData(recipe.input, component => component.type !== Settings.ANYOF_SUBTYPE);
            let countItems = 0;
            itemLoop: for (const item of items) {
                const itemComponent = beaversSystemInterface.componentFromEntity(item);
                for (const component of listOfIngredientsWithoutAnyOf) {
                    if (component.isSame(itemComponent)) {
                        countItems++;
                        continue itemLoop;
                    }
                }
                for (const component of listOfAnyOfIngredients) {
                    const entity = await component.getEntity();
                    const anyOf = new AnyOf(entity);
                    const isOf = await anyOf.executeMacro(item);
                    if (isOf.value) {
                        countItems++
                        continue itemLoop;
                    }
                }
                break itemLoop;
            }
            if (countItems === items.length) {
                returnList.push(recipe);
            }
        }
        return returnList;
    }

    /**
     * @param craftable optional map that gets filled with uuid -> "can be crafted right now" (incl. currency).
     */
    static async filterForActor(actor, filter, craftable?: Map<string, boolean>) {
        const own = RecipeCompendium.getForActor(actor);
        const list = (filter == FilterType.own) ? own : [...RecipeCompendium.getWorldFor(actor), ...own];
        const returnList: Recipe[] = [];
        const pool = getActorContentPool(actor);
        for (const recipe of list) {
            const needsEvaluation = craftable !== undefined || (filter != FilterType.all && filter != FilterType.own);
            const status = needsEvaluation ? await this.evaluateForActor(actor, recipe, pool) : undefined;
            if (craftable !== undefined && status !== undefined) {
                craftable.set(recipe.uuid, status.usable && await this._canPay(recipe, actor));
            }
            if (filter == FilterType.all || filter == FilterType.own
                || (filter == FilterType.usable && status?.usable)
                || (filter == FilterType.available && status?.available)) {
                returnList.push(recipe);
            }
        }
        return returnList;
    }

    static async evaluateForActor(actor, recipe: Recipe, pool): Promise<{ available: boolean, usable: boolean }> {
        if (!RecipeKnowledge.mayCraft(actor, recipe)) {
            return {available: false, usable: false};
        }
        const listOfAnyOfIngredients = this._filterData(recipe.input, component => component.type === Settings.ANYOF_SUBTYPE);
        if (!await this.isAnyAnyOfInList(listOfAnyOfIngredients, pool)) { //isAvailable or usable ! when any item matches anyOf has the given quantity
            return {available: false, usable: false};
        }
        const listOfIngredientsWithoutAnyOf = this._filterData(recipe.input, component => component.type !== Settings.ANYOF_SUBTYPE);
        const result = RecipeCompendium.validateRecipeToItemList(listOfIngredientsWithoutAnyOf, Result.from(recipe, actor));
        await RecipeCompendium.validateScriptCosts(recipe, result);
        await RecipeCompendium.filterRequired(actor, recipe, result);
        return {available: result._isAnyConsumedAvailable(), usable: !result.hasError()};
    }

    static async _canPay(recipe: Recipe, actor): Promise<boolean> {
        if (!recipe.currency) {
            return true;
        }
        const result = Result.from(recipe, actor);
        await result.checkCurrency();
        return !result._currencyResult?.hasError;
    }

    static async filterRequired(actor: Actor, recipe: Recipe,result:Result) {
        if (Settings.get(Settings.USE_ATTENDANTS)) {
            const listOfAnyOfRequired = this._filterData(recipe.required, component => component.type === Settings.ANYOF_SUBTYPE);
            const pool = getActorContentPool(actor);
            if (await this.isAnyAnyOfInList(listOfAnyOfRequired, pool)) {
                await RecipeCompendium.validateRequired(recipe, result);
            }
        }
    }

    static async isAnyAnyOfInList(listOfAnyOfIngredients: Component[], listOfItems) {
        if (listOfAnyOfIngredients.length === 0) {
            return true;
        }
        for (const component of listOfAnyOfIngredients) {
            if (component.type === Settings.ANYOF_SUBTYPE) {
                try {
                    const item = await component.getEntity();
                    const anyOf = new AnyOf(item);
                    const results = await anyOf.filter(listOfItems);
                    if (results.filter(c => c.quantity >= component.quantity).length > 0) {
                        return true;
                    }
                } catch (error) {
                    console.warn(error);
                }
            }
        }
        return false;
    }

    static async validateRequired(recipe: Recipe, result: Result): Promise<Result> {
        if (Settings.get(Settings.USE_ATTENDANTS)) {
            const listOfRequiredWithoutAnyOf = this._filterData(recipe.required, component => component.type !== Settings.ANYOF_SUBTYPE);
            for (const component of listOfRequiredWithoutAnyOf) {
                if (component.type !== Settings.SCRIPT_SUBTYPE) {
                    result.updateComponent("required", component);
                }
            }
            for (const {component, quantity} of this._sumScripts(listOfRequiredWithoutAnyOf)) {
                const {ok, reason} = await this.checkScript(component, result._actor, recipe, false, quantity);
                result.setScriptResult(component, ok, reason, "required", quantity);
            }
        }
        return result;
    }


    /** the Scripts in "Cost": their check says whether they can be paid (no check: always) */
    static async validateScriptCosts(recipe: Recipe, result: Result): Promise<Result> {
        for (const {component, quantity} of this._sumScripts(this._filterData(recipe.input, () => true))) {
            const {ok, reason} = await this.checkScript(component, result._actor, recipe, true, quantity);
            result.setScriptResult(component, ok, reason, "consumed", quantity);
        }
        return result;
    }

    /** the Scripts of a section, the same script once with the sum of its quantities (like items) */
    static _sumScripts(components: Component[]): { component: Component, quantity: number }[] {
        const sums = new Map<string, { component: Component, quantity: number }>();
        for (const component of components) {
            if (component.type !== Settings.SCRIPT_SUBTYPE) continue;
            const quantity = Math.max(1, Number(component.quantity) || 1);
            const sum = sums.get(component.uuid);
            if (sum) {
                sum.quantity += quantity;
            } else {
                sums.set(component.uuid, {component, quantity});
            }
        }
        return [...sums.values()];
    }

    /** @param optional true: a script without check counts as met (a cost that only pays) */
    static async checkScript(component: Component, actor, recipe: Recipe, optional = false, quantity = 1): Promise<{ ok: boolean, reason?: string }> {
        let entity;
        try {
            entity = await component.getEntity();
        } catch (e) {
            entity = undefined;
        }
        if (!entity || !Script.isScript(entity)) {
            // @ts-ignore
            return {ok: false, reason: game.i18n.format("beaversCrafting.script.missing", {name: component.name})};
        }
        const script = new Script(entity);
        if (optional && !await script.hasCheck()) {
            return {ok: true};
        }
        return script.check(actor, recipe, quantity);
    }

    static async evaluateOption(type: DataType, recipe: Recipe, group: string): Promise<string> {
        const data = recipe[type][group];
        const listOfPossibilities = Object.keys(data);
        let chosen = listOfPossibilities[0];
        if (listOfPossibilities.length > 1) {
            chosen = await this.chooseComponent(data);
            for (const key of listOfPossibilities) {
                if (key !== chosen) {
                    recipe._removeData(type, group, key)
                }
            }
        }
        return chosen;
    }

    /** @returns false when an AnyOf can not be resolved: nothing matches or the choice was cancelled */
    static async evaluateOptions(type: DataType, recipe: Recipe, items: Item[]): Promise<boolean> {
        for (const group of Object.keys(recipe[type])) {
            const key = await this.evaluateOption(type, recipe, group);
            if (!await this.evaluateAnyOf(type, recipe, group, key, items)) {
                return false;
            }
        }
        return true;
    }

    /** @returns false when nothing in items matches the AnyOf (with a warning) or the choice was cancelled */
    static async evaluateAnyOf(type: DataType, recipe: Recipe, group: string, key: string, items: Item[]): Promise<boolean> {
        const component = recipe[type][group][key];
        if (component.type !== Settings.ANYOF_SUBTYPE) {
            return true;
        }
        const candidates = await this.anyOfCandidates(component, items);
        if (candidates.length === 0) {
            ui.notifications?.warn(game["i18n"].format("beaversCrafting.anyOf.noMatch", {anyOf: component.name}));
            return false;
        }
        const chosen = candidates[await this.chooseComponent(Object.fromEntries(candidates.entries()))];
        if (chosen === undefined) {
            return false;
        }
        this.resolveAnyOf(type, recipe, group, key, chosen);
        return true;
    }

    /** the items of the pool that match an AnyOf component */
    static async anyOfCandidates(component: Component, items: Item[]): Promise<Component[]> {
        const item = await component.getEntity();
        return new AnyOf(item).filter(items);
    }

    /** replace the AnyOf component at group/key with the chosen one, keeping the needed quantity */
    static resolveAnyOf(type: DataType, recipe: Recipe, group: string, key: string, chosen: Component) {
        const component = recipe[type][group][key];
        chosen.quantity = component.quantity;
        recipe._addData(type, chosen, chosen.uuid, group);
        recipe._removeData(type, group, key);
    }


    static async chooseComponent(listOfComponents: { [key: string]: Component }): Promise<string> {
        const selectData: SelectData = {
            choices: {}
        }
        for (const [key, component] of Object.entries(listOfComponents)) {
            selectData.choices[key] = {text: component.name, img: component.img};
        }
        return beaversSystemInterface.uiDialogSelect(selectData);
    }

    /** the items (and money) of the cost; Scripts are evaluated by validateScriptCosts */
    /** the costs against the actor of the result (its items without containers, see getActorContentPool) */
    static validateRecipeToItemList(listOfIngredients: Component[], result: Result): Result {
        for (const component of listOfIngredients) {
            if (component.type === Settings.SCRIPT_SUBTYPE) {
                continue;
            }
            result.updateComponent("consumed", component);
        }
        return result;
    }

}

export enum FilterType {
    usable,
    available,
    all,
    own
}