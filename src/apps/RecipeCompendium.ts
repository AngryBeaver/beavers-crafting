//the firstdraft implementation will be kept simple stupid and not performant at all.
import {Recipe} from "../Recipe.js";
import {Settings} from "../Settings.js";
import {AnyOf} from "./AnyOfSheet.js";
import {sanitizeUuid} from "../helpers/Utility.js";

export class RecipeCompendium {

    static getAll(): Recipe[] {
        // @ts-ignore
        return game.items.directory.documents
            .filter(item => RecipeCompendium.isRecipe(item))
            .map(item => Recipe.fromItem(item));
    }
    //todo ANYOF
    static filterForItems(recipes: Recipe[], items) {
        return recipes.filter(recipe => {
            const recipeItemsInItemList = items.filter(
                item => {
                    for (const [k, component] of Object.entries(recipe.ingredients)) {
                        if (this.isSame(item, component)) {
                            return true;
                        }
                    }
                    return false;
                })
            return recipeItemsInItemList.length === items.length;
        });
    }

    static async filterForActor(actor, filter) {
        const list = RecipeCompendium.getAll();
        const returnList:Recipe[] = [];
        for(const recipe of list){
            if (filter == FilterType.all) {
                returnList.push(recipe);
            }else{
                const listOfAnyOfIngredients = Object.values(recipe.ingredients).filter(component => component.type === Settings.ANYOF_SUBTYPE);
                if (await this.isAnyAnyOfInList(listOfAnyOfIngredients, actor.items)) {                                       //isAvailable or usable ! when any item matches anyOf has the given quantity
                    const listOfIngredientsWithoutAnyOf = Object.values(recipe.ingredients).filter(component => component.type !== Settings.ANYOF_SUBTYPE);
                    const result = RecipeCompendium.validateRecipeToItemList(listOfIngredientsWithoutAnyOf, actor.items);
                    if((filter == FilterType.usable && !result.hasErrors)
                        || (filter == FilterType.available && result.isAvailable)){
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
                const item = await fromUuid(component.uuid);
                const anyOf = new AnyOf(item);
                const results = await anyOf.filter(listOfItems);
                if (results.filter(c=>c.quantity >= component.quantity).length == 0) {
                    return false;
                }
            }
        }
        return true;
    }

    static validateRecipeToItemList(listOfIngredients: Component[], listOfItems, result ?: Result): Result {
        if (!result) result = new DefaultResult();
        result.isAvailable = listOfIngredients.length === 0;
        for (const component of listOfIngredients) {
            const key = sanitizeUuid(component.uuid);
            const itemChange = RecipeCompendium.findComponentInList(listOfItems, component);
            const remainingQuantity = itemChange.toUpdate["system.quantity"] - component.quantity;
            const isAvailAble = itemChange.toUpdate["system.quantity"] > 0;
            result.ingredients[key] = {
                component: component,
                isAvailable: isAvailAble,
                difference: remainingQuantity,
            };
            if (isAvailAble) {
                result.isAvailable = isAvailAble;
            }
            if (remainingQuantity < 0) {
                result.hasErrors = true;
            } else {
                if (remainingQuantity == 0) {
                    result.changes.items.toDelete.push(itemChange.toUpdate._id);
                } else {
                    itemChange.toUpdate["system.quantity"] = remainingQuantity;
                    result.changes.items.toUpdate.push(itemChange.toUpdate);
                }
                result.changes.items.toDelete.push(...itemChange.toDelete);
            }
        }
        return result;
    }

    static findComponentInList(listOfItems, component: Component): ItemChange {
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

    static isSame(item, component: Component) {
        const isSameName = (item, component) => item.name === component.name;
        const isFromSource = (item, component) => item.flags?.core?.sourceId === component.uuid;
        const hasSameSource = (item, component) => item.flags?.core?.sourceId === component.sourceId || item.sourceId === component.sourceId;
        return isSameName(item, component) && (isFromSource(item, component) || hasSameSource(item, component));
    }

    static isRecipe(item) {
        // @ts-ignore
        return (item?.type === 'loot' && item?.system?.source === Settings.RECIPE_SUBTYPE);
    }

}

export enum FilterType {
    usable,
    available,
    all
}

class DefaultItemChange implements ItemChange {
    toDelete: any[] = [];
    toUpdate = {
        "_id": "",
        "system.quantity": 0
    };

    constructor(component: Component) {
        this.toUpdate._id = component.id;
    }

}

export class DefaultResult implements Result {
    ingredients = {};
    currencies = true;
    changes = {
        items: {
            toUpdate: [],
            toDelete: [],
            toCreate: []
        },
        currencies: {},
    };
    results = {};
    hasErrors = false;
    hasException: false;
    isAvailable = true;
}