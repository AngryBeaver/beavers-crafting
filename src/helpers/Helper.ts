import {Document} from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/abstract/module.mjs";
import {Dnd5e} from "../systems/Dnd5e.js";
import {Pf2e} from "../systems/Pf2e.js";

export class Helper{

    game: Game;

    constructor(game: Game){
        this.game = game;
    }



    async getDocument(uuid) {
        const parts = uuid.split(".");
        if (parts[0] === "Compendium") {
            const pack = this.game.packs.get(parts[1] + "." + parts[2]);
            if(pack !== undefined) {
                return await pack.getDocument(parts[3]);
            }else{
                return null;
            }
        } else {
            return await fromUuid(uuid);
        }
    }
}

export function getSystem() {
    if (game["system"].id === "dnd5e") {
        return new Dnd5e();
    }
    if (game["system"].id === "pf2e") {
        return new Pf2e();
    }
    throw Error("System is not supported");
}