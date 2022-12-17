//the firstdraft implementation will be kept simple stupid and not performant at all.
import {Component, Recipe} from "../Recipe.js";
import {Settings} from "../Settings.js";
import {AnyOf} from "../AnyOf.js";
import {getItem, sanitizeUuid} from "../helpers/Utility.js";
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
        return game.items.directory.documents
            .filter(item => Recipe.isRecipe(item))
            .map(item => Recipe.fromItem(item));
    }

    static getAll(actor): Recipe[] {
        return [...RecipeCompendium.getAllItems(),...RecipeCompendium.getForActor(actor)];
    }

    static async filterForItems(recipes: Recipe[], items) {
        const returnList: Recipe[] = [];
        for (const recipe of recipes) {
            const listOfAnyOfIngredients = Object.values(recipe.ingredients).filter(component => component.type === Settings.ANYOF_SUBTYPE);
            const listOfIngredientsWithoutAnyOf = Object.values(recipe.ingredients).filter(component => component.type !== Settings.ANYOF_SUBTYPE);
            let countItems = 0;
            itemLoop: for(const item of items) {
                for (const component of listOfIngredientsWithoutAnyOf) {
                    if (this.isSame(item, component)) {
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
        const list = (filter == FilterType.own)?own:[...items,...own];
        const returnList: Recipe[] = [];
        for (const recipe of list) {
            if (filter == FilterType.all || filter == FilterType.own) {
                returnList.push(recipe);
            } else {
                const listOfAnyOfIngredients = Object.values(recipe.ingredients).filter(component => component.type === Settings.ANYOF_SUBTYPE);
                if (await this.isAnyAnyOfInList(listOfAnyOfIngredients, actor.items)) {                                       //isAvailable or usable ! when any item matches anyOf has the given quantity
                    const listOfIngredientsWithoutAnyOf = Object.values(recipe.ingredients).filter(component => component.type !== Settings.ANYOF_SUBTYPE);
                    const result = RecipeCompendium.validateRecipeToItemList(listOfIngredientsWithoutAnyOf, actor.items, new Result(recipe,actor));
                    await RecipeCompendium.validateTool(recipe,actor.items,result);
                    await RecipeCompendium.validateAttendants(recipe,actor.items,result);
                    if ((filter == FilterType.usable && !result.hasError)
                        || (filter == FilterType.available && result.isAvailable)) {
                        returnList.push(recipe);
                    }
                }

            }
        }
        return returnList;
    }

    static async isAnyAnyOfInList(listOfAnyOfIngredients: Component[], listOfItems) {
        for (const component of listOfAnyOfIngredients) {
            if (component.type === Settings.ANYOF_SUBTYPE) {
                const item = await component.getEntity();
                const anyOf = new AnyOf(item);
                const results = await anyOf.filter(listOfItems);
                if (results.filter(c => c.quantity >= component.quantity).length == 0) {
                    return false;
                }
            }
        }
        return true;
    }

    static async validateAttendants(recipe:Recipe,listOfItems,result : Result): Promise<Result>{
        if( Settings.get(Settings.USE_ATTENDANTS)) {
            for(const attendant  of Object.values(recipe.attendants)){
                const key = sanitizeUuid(attendant.uuid);
                const itemChange = RecipeCompendium.findComponentInList(listOfItems, attendant);
                const remainingQuantity = itemChange.toUpdate["system.quantity"] - attendant.quantity;
                const isAvailable = remainingQuantity >= 0;
                result.precast.attendants[key] = {
                    isAvailable: isAvailable
                }
                result.chat.components["attendants_"+key] = {
                    component: attendant,
                    isAvailable: isAvailable,
                    type: "required"
                }
                if (!isAvailable) {
                    result.chat.success = false;
                    result.hasError = true;
                }
            }
        }
        return result;
    }

    static async validateTool(recipe,listOfItems,result : Result): Promise<Result>{
        if( recipe.tool && Settings.get(Settings.USE_TOOL)) {
            const item = await getItem(recipe.tool);
            const component = new Component(item, item.uuid, "Item");
            const isAvailable = listOfItems.filter((i) => RecipeCompendium.isSame(i, component)).length > 0;
            result.precast.tool = isAvailable;
            result.chat.components["tool"] = {
                component: component,
                isAvailable: isAvailable,
                type: "required"
            }
            if(!isAvailable){
                result.chat.success = false;
                result.hasError = true;
            }
        }
        return result;
    }

    static validateRecipeToItemList(listOfIngredients: Component[], listOfItems, result : Result): Result {
        let anyIngredientIsAvailable = listOfIngredients.length === 0;
        for (const component of listOfIngredients) {
            const remainingQuantity = result.removeComponent("consumed",component);
            const key = sanitizeUuid(component.uuid);
            const isAvailable = remainingQuantity>=0
            result.precast.ingredients[key] = {
                isAvailable: isAvailable
            }
            if (remainingQuantity>-component.quantity) {
                anyIngredientIsAvailable = true;
            }
        }
        if(!anyIngredientIsAvailable){
            result.isAvailable = false;
        }
        return result;
    }

    static findComponentInList(listOfItems, component: ComponentData): ItemChange {
        const itemChange = new DefaultItemChange(component);
        listOfItems.forEach((i) => {
            if (this.isSame(i, component)) {
                if (itemChange.toUpdate["system.quantity"] == 0) {
                    itemChange.toUpdate._id = i.id;
                } else {
                    itemChange.toDelete.push(i.id);
                }
                itemChange.toUpdate["system.quantity"] = itemChange.toUpdate["system.quantity"] + (i.system?.quantity || 1);
            }
        });
        return itemChange;
    }

    static isSame(item, component: ComponentData) {
        const isSameName = item.name === component.name;
        const hasSameItemType = item.documentName==="Item" && item.type === component.itemType;
        return isSameName && hasSameItemType;
    }

}

export enum FilterType {
    usable,
    available,
    all,
    own
}

class DefaultItemChange implements ItemChange {
    toDelete: any[] = [];
    toUpdate = {
        "_id": "",
        "system.quantity": 0
    };

    constructor(component: ComponentData) {
        this.toUpdate._id = component.id;
    }
}