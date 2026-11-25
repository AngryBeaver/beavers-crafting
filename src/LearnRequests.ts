import { Settings } from "./Settings.js";
import { RecipeKnowledge } from "./RecipeKnowledge.js";
import { sanitizeUuid } from "./helpers/Utility.js";
import { markDeleted, renderTemplate } from "./helpers/Compat.js";

/**
 * Players asking the Gamemaster to learn a blueprint (setting "Learning recipes" = "Gamemaster approves").
 *
 * A request lives on the actor (`flags.beavers-crafting.learnRequests.<key>`), so it survives reloads and either
 * side being offline. Every client handles the requests when an actor changes or the world is ready:
 * - the player sets it "pending"
 * - the active Gamemaster posts a chat card whispered to the Gamemasters (once: the card's id is kept on the request)
 * - Allow learns it with the usual rules → "learned" (or "rejected" when a rule refuses); Reject → "rejected"
 * - the user who asked gets a popup with the answer and removes the request
 */
type RequestStatus = "pending" | "learned" | "rejected";

interface LearnRequest {
  recipe: string;
  name: string;
  user: string;
  status: RequestStatus;
  card?: string;
}

const FLAG = "learnRequests";
const TEMPLATE = "modules/beavers-crafting/templates/learn-request-card.hbs";

export class LearnRequests {
  /** the player asks to learn the recipe */
  static async request(actor, recipe: { uuid: string; name: string }): Promise<void> {
    const request: LearnRequest = { recipe: recipe.uuid, name: recipe.name, user: game["user"].id, status: "pending" };
    await actor.setFlag(Settings.NAMESPACE, `${FLAG}.${keyOf(recipe.uuid)}`, request);
  }

  static isPending(actor, recipeUuid: string): boolean {
    return requestsOf(actor)[keyOf(recipeUuid)]?.status === "pending";
  }

  /** the update touched the requests of the actor */
  static isAffectedBy(changes): boolean {
    return foundry.utils.hasProperty(changes, `flags.${Settings.NAMESPACE}.${FLAG}`);
  }

  /** this client's part of the actor's requests: the active Gamemaster posts cards, the asking user gets the answer */
  static async process(actor): Promise<void> {
    for (const [key, request] of Object.entries(requestsOf(actor))) {
      if (request.status === "pending") {
        if (!request.card && isActiveGamemaster()) await postCard(actor, key, request);
      } else if (request.user === game["user"].id) {
        await deliverAnswer(actor, key, request);
      }
    }
  }

  /** ready: what happened while this client was offline */
  static async processAll(): Promise<void> {
    for (const actor of game["actors"]) {
      await LearnRequests.process(actor);
    }
  }

  /** renderChatMessageHTML: the Allow / Reject buttons of a request card */
  static bindCard(message, html: HTMLElement): void {
    if (!cardFlagOf(message)) {
      return;
    }
    html.querySelectorAll<HTMLButtonElement>("[data-learn-decision]").forEach((button) => {
      button.addEventListener("click", () => void decide(message, button.dataset.learnDecision === "allow"));
    });
  }
}

function requestsOf(actor): { [key: string]: LearnRequest } {
  return actor.getFlag(Settings.NAMESPACE, FLAG) ?? {};
}

function keyOf(recipeUuid: string): string {
  return sanitizeUuid(recipeUuid);
}

function cardFlagOf(message): { actor: string; key: string } | undefined {
  return message.getFlag(Settings.NAMESPACE, "learnRequest");
}

/** several Gamemasters may be online: only one of them posts the cards */
function isActiveGamemaster(): boolean {
  return game["users"].activeGM?.id === game["user"].id;
}

async function postCard(actor, key: string, request: LearnRequest): Promise<void> {
  const message = await ChatMessage.create({
    content: await cardContent(request),
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: game["i18n"].localize("beaversCrafting.knowledge.requestFlavor"),
    whisper: ChatMessage.getWhisperRecipients("GM").map((user) => user.id as string),
    flags: { [Settings.NAMESPACE]: { learnRequest: { actor: actor.uuid, key } } },
  });
  await actor.setFlag(Settings.NAMESPACE, `${FLAG}.${key}.card`, message?.id);
}

/** a Gamemaster clicked Allow or Reject; a request decided by another Gamemaster is left alone */
async function decide(message, allow: boolean): Promise<void> {
  const flag = cardFlagOf(message);
  const actor = flag && (await fromUuid(flag.actor));
  const request = actor && requestsOf(actor)[flag.key];
  if (!request || request.status !== "pending") {
    return;
  }
  const learned = allow && (await RecipeKnowledge.learn(actor, request.recipe)) !== undefined;
  const status: RequestStatus = learned ? "learned" : "rejected";
  await actor.setFlag(Settings.NAMESPACE, `${FLAG}.${flag.key}.status`, status);
  await message.update({ content: await cardContent({ ...request, status }) });
}

async function deliverAnswer(actor, key: string, request: LearnRequest): Promise<void> {
  const text = game["i18n"].format(`beaversCrafting.knowledge.${request.status}`, {
    actor: actor.name,
    recipe: request.name,
  });
  if (request.status === "learned") {
    ui.notifications?.info(text);
  } else {
    ui.notifications?.warn(text);
  }
  await actor.update(markDeleted({}, `flags.${Settings.NAMESPACE}.${FLAG}.${key}`));
}

async function cardContent(request: LearnRequest): Promise<string> {
  const recipe: any = await fromUuid(request.recipe);
  const pending = request.status === "pending";
  return renderTemplate(TEMPLATE, {
    name: request.name,
    img: recipe?.img,
    pending,
    status: request.status,
    // decided by this client's user: the Gamemaster who clicked
    result: pending ? "" : game["i18n"].format(`beaversCrafting.knowledge.decided.${request.status}`, {
      gm: game["user"].name,
    }),
  });
}
