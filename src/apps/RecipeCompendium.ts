import {Recipe} from "../Recipe.js";
import {Settings} from "../Settings.js";
import {AnyOf} from "../AnyOf.js";
import {Result} from "../Result.js";

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
            .filter(item => Recipe.isRecipe(item))
            .map(item => Recipe.fromItem(item));
    }

    static getAll(actor): Recipe[] {
        return [...RecipeCompendium.getAllItems(), ...RecipeCompendium.getForActor(actor)];
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

    static async filterForActor(actor, filter) {
        const items = RecipeCompendium.getAllItems();
        const own = RecipeCompendium.getForActor(actor);
        const list = (filter == FilterType.own) ? own : [...items, ...own];
        const returnList: Recipe[] = [];
        for (const recipe of list) {
            if (filter == FilterType.all || filter == FilterType.own) {
                returnList.push(recipe);
            } else {
                const listOfAnyOfIngredients = this._filterData(recipe.input, component => component.type === Settings.ANYOF_SUBTYPE);
                if (await this.isAnyAnyOfInList(listOfAnyOfIngredients, actor.items)) { //isAvailable or usable ! when any item matches anyOf has the given quantity
                    const listOfIngredientsWithoutAnyOf = this._filterData(recipe.input, component => component.type !== Settings.ANYOF_SUBTYPE);
                    const result = RecipeCompendium.validateRecipeToItemList(listOfIngredientsWithoutAnyOf, actor.items, Result.from(recipe, actor));
                    await RecipeCompendium.filterRequired(actor, recipe,result);
                    if ((filter == FilterType.usable && !result.hasError())
                        || (filter == FilterType.available && result._isAnyConsumedAvailable())) {
                        returnList.push(recipe);
                    }
                }

            }
        }
        return returnList;
    }

    static async filterRequired(actor: Actor, recipe: Recipe,result:Result) {
        if (Settings.get(Settings.USE_ATTENDANTS)) {
            const listOfAnyOfRequired = this._filterData(recipe.required, component => component.type === Settings.ANYOF_SUBTYPE);
            if (await this.isAnyAnyOfInList(listOfAnyOfRequired, actor.items)) {
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
                result.updateComponent("required", component);
            }
        }
        return result;
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

    static async evaluateOptions(type: DataType, recipe: Recipe, actorItems) {
        for (const [group, data] of Object.entries(recipe[type])) {
            const key = await this.evaluateOption(type, recipe, group);
            await this.evaluateAnyOf(type, recipe, group, key, actorItems)
        }
    }

    static async evaluateAnyOf(type: DataType, recipe: Recipe, group: string, key: string, actorItems) {
        const component = recipe[type][group][key];
        if (component.type === Settings.ANYOF_SUBTYPE) {
            const item = await component.getEntity();
            const anyOf = new AnyOf(item);
            const components = await anyOf.filter(actorItems)
            const comps = components.reduce((result, item, index) => {
                result[index.toString()] = item;
                return result;
            }, {})
            const used = await this.chooseComponent(comps);
            comps[used].quantity = component.quantity;
            recipe._addData(type, comps[used], comps[used].uuid, group);
            recipe._removeData(type, group, key);
        }
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

    static validateRecipeToItemList(listOfIngredients: Component[], listOfItems, result: Result): Result {
        for (const component of listOfIngredients) {
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