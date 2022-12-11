import {Recipe} from "./Recipe";


class DefaultChatData implements ChatData {
    name="";
    img="";
    success=true;
    input={
        consumed:{},
        required:{}
    };
    output={

    };

}

export class Result implements ResultData {
    updates = {
        items: {
            toUpdate: [],
            toDelete: [],
            toCreate: []
        },
        actor: {},
    };
    chat = new DefaultChatData();
    ingredients = {};
    currencies = true;
    attendants = {};
    results = {};
    hasErrors = false;
    hasException: false;
    isAvailable = true;

    constructor(recipe:Recipe){
        this.chat.name = recipe.name;
        this.chat.img = recipe.img;
    }
}

