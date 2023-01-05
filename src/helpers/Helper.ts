import {Document} from "@league-of-foundry-developers/foundry-vtt-types/src/foundry/common/abstract/module.mjs";

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