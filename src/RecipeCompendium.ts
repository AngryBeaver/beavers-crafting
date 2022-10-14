//the firstdraft implementation will be kept simple stupid and not performant at all.
import {Recipe} from "./Recipe.js";
import {Settings} from "./Settings.js";

export class RecipeCompendium {

    static getAll(): Recipe[] {
        // @ts-ignore
        return game.items.directory.documents
            .filter(item => RecipeCompendium.isRecipe(item))
            .map(item => new Recipe(item));
    }

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

    static filterForActor(actor, filter) {
        return RecipeCompendium.getAll()
            .filter(recipe => {
                if (filter == FilterType.all) {
                    return true;
                }
                const result = RecipeCompendium.validateRecipeToItemList(recipe, actor.items);
                return ((filter == FilterType.usable && !result.hasErrors)
                    || (filter == FilterType.available && result.isAvailable));
            });

    }

    static validateRecipeToItemList(recipe: Recipe, listOfItems, result?: Result): Result {
        if (!result) result = new DefaultResult();
        result.isAvailable = recipe.ingredients.size === 0;
        for (const [k, component] of Object.entries(recipe.ingredients)) {
            const itemChange = RecipeCompendium.findComponentInList(listOfItems, component);
            const remainingQuantity = itemChange.toUpdate["system.quantity"] - component.quantity;
            const isAvailAble = itemChange.toUpdate["system.quantity"] > 0;
            result.ingredients[k] = {
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
        const itemChange = new DefaultItemChange();
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
        const isFromSource = (item, component) => item.flags?.core?.sourceId == component.uuid;
        const hasSameSource = (item, component) => item.flags?.core?.sourceId == component.sourceId;
        return isSameName(item, component) && (isFromSource(item, component) || hasSameSource(item, component));
    }

    static isRecipe(item) {
        // @ts-ignore
        return (item?.type === 'loot' && item?.system?.source === game.settings.get(Settings.NAMESPACE, Settings.RECIPE_SOURCE_NAME));
    }

}

export enum FilterType {
    usable, available, all
}

class DefaultItemChange implements ItemChange {
    toDelete: any[] = [];
    toUpdate = {
        "_id": "",
        "system.quantity": 0
    };
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
    hasException:false;
    isAvailable = true;
}