import {Recipe} from "./Recipe.js";
import {Exchange} from "./Exchange.js";


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
    skill?: {
        name: string,
        total: number,
        difference: number,
    }
}

class Precast implements PreCastData {
    ingredients: {
        [key: string]: {
            isAvailable: boolean
        }
    }
    attendants: {
        [key: string]: {
            isAvailable: boolean
        }
    }
    tool?: boolean;
    currencies?: boolean
    constructor(){
        this.attendants = {};
        this.ingredients = {};
    }
}

export class Result implements ResultData {
    updates: {
        items: {
            toUpdate: updateItem[];
            toDelete: string[];
            toCreate: ComponentData[]
        }
        actor: {
            "system.currency": Currencies5e;
            [key: string]: any
        }
    };
    chat = new DefaultChatData();
    precast = new Precast();
    hasErrors = false;
    hasException: false;
    isAvailable = true;

    constructor(recipe:Recipe, actor ){
        this.chat.name = recipe.name;
        this.chat.img = recipe.img;
        this.updates = {
            items:{
                toUpdate:[],
                toDelete:[],
                toCreate:[]
            },
            actor:{
                "system.currency": actor.system.currency
            }
        }
    }

    changeCurrency(currency: Currency) {
        let isAvailable = false;
        try {
            this.updates.actor["system.currency"] = Exchange.pay(currency, this.updates.actor["system.currency"]);
            isAvailable = true;
        } catch (e) {
        }
        this.chat.input.consumed["currency"] = {
            component: {
                id: "invalid",
                uuid: "invalid",
                type: "Currency",
                name: currency.name,
                img: 'icons/commodities/currency/coins-assorted-mix-copper-silver-gold.webp',
                quantity: currency.value
            },
            isAvailable:isAvailable
        }
        this.precast.currencies = isAvailable;
        if(!isAvailable){
            this.hasErrors = true;
            this.chat.success = false;
        }
    }

}

