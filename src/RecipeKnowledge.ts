import { Recipe } from "./Recipe.js";
import { Settings } from "./Settings.js";

/**
 * What an actor knows: a recipe item on the actor is a learned recipe.
 *
 * Every way of learning (drag & drop, the "Learn" button, a Gamemaster allowing a request, a crafting whose result
 * is a recipe, the API) creates such an item, so the rules of learning live in one place:
 * {@link RecipeKnowledge.guardLearning} on preCreateItem. Forgetting is deleting that item, announced by
 * {@link RecipeKnowledge.announceForgotten}.
 *
 * Hooks for other modules:
 * - `beavers-crafting.preLearn` (actor, recipeItem): return false to refuse, show your own message
 * - `beavers-crafting.forget` (actor, recipeItem): the recipe was removed from the actor
 */
export const PRE_LEARN_HOOK = `${Settings.NAMESPACE}.preLearn`;
export const FORGET_HOOK = `${Settings.NAMESPACE}.forget`;

export class RecipeKnowledge {
  /** the recipe items of the actor */
  static learnedItems(actor): any[] {
    return actor.items.filter((item) => Recipe.isRecipe(item));
  }

  /** the actor's copy of the given recipe document, if it has learned it */
  static findLearned(actor, recipeDocument): any | undefined {
    return RecipeKnowledge.learnedItems(actor).find((item) => isSameRecipe(item, recipeDocument));
  }

  /** the recipe is one of the actor's own recipe items */
  static isLearned(actor, recipe: Recipe): boolean {
    return actor.items.some((item) => item.uuid === recipe.uuid);
  }

  /** a blueprint the actor has learned: the only recipes whose knowledge matters */
  static isLearnedBlueprint(actor, recipe: Recipe): boolean {
    return recipe.mustBeLearned && RecipeKnowledge.isLearned(actor, recipe);
  }

  /** a recipe can be crafted by everyone who sees it, a blueprint only by an actor that learned it */
  static mayCraft(actor, recipe: Recipe): boolean {
    return !recipe.mustBeLearned || RecipeKnowledge.isLearned(actor, recipe);
  }

  /** the Gamemaster always learns at once, players only with the setting "Players learn directly" */
  static learnsDirectly(user): boolean {
    return user.isGM || Settings.get(Settings.LEARN_MODE) === "direct";
  }

  /** copies the recipe onto the actor, remembering where it came from; the rules run in guardLearning */
  static async learn(actor, uuid: string): Promise<any | undefined> {
    const source = await fromUuid(uuid);
    if (!source || !Recipe.isRecipe(source)) {
      return undefined;
    }
    const data = source.toObject();
    delete data._id;
    foundry.utils.setProperty(data, source.pack ? "_stats.compendiumSource" : "_stats.duplicateSource", uuid);
    const [created] = await actor.createEmbeddedDocuments("Item", [data]);
    return created;
  }

  /** preCreateItem: a recipe that is about to land on an actor is learned, unless it is known or a module refuses */
  static guardLearning(item): false | void {
    const actor = item.parent;
    if (!(actor instanceof Actor) || !Recipe.isRecipe(item)) {
      return;
    }
    if (RecipeKnowledge.findLearned(actor, item)) {
      ui.notifications?.info(
        game["i18n"].format("beaversCrafting.knowledge.alreadyKnown", { actor: actor.name, recipe: item.name }),
      );
      return false;
    }
    if (Hooks.call(PRE_LEARN_HOOK, actor, item) === false) {
      return false;
    }
  }

  /** the actor forgets the recipe: its item is removed */
  static async forget(item): Promise<void> {
    await item.delete();
  }

  /** deleteItem (on the deleting client only): a recipe removed from an actor, by "Forget" or any other way */
  static announceForgotten(item): void {
    const actor = item.parent;
    if (actor instanceof Actor && Recipe.isRecipe(item)) {
      Hooks.callAll(FORGET_HOOK, actor, item);
    }
  }
}

/**
 * Two recipe documents are the same recipe when one was copied from the other (Foundry records the source),
 * or, when a copy has no recorded source (a world item dropped on an actor), when their names are equal.
 */
export function isSameRecipe(a, b): boolean {
  const idsA = identitiesOf(a);
  const idsB = identitiesOf(b);
  if (idsA.length === 0 || idsB.length === 0) {
    return a.name === b.name;
  }
  return idsA.some((id) => idsB.includes(id));
}

/** the uuids a recipe document stands for: itself (unless it is an actor's copy) and the documents it was copied from */
function identitiesOf(document): string[] {
  const stats = document?._stats ?? {};
  const own = document?.parent ? undefined : document?.uuid;
  return [own, stats.compendiumSource, stats.duplicateSource, document?.flags?.core?.sourceId].filter(
    (id): id is string => !!id,
  );
}
