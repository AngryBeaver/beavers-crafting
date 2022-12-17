import {Component, Recipe} from "./Recipe.js";
import {Exchange} from "./Exchange.js";
import {RecipeCompendium} from "./apps/RecipeCompendium.js";
import {sanitizeUuid} from "./helpers/Utility.js";

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
    hasError = false;
    hasException = false;
    isAvailable = true;
    actorItems=[];

    constructor(recipe:Recipe, actor ){
        this.chat.name = recipe.name;
        this.chat.img = recipe.img;
        this.updates = {
            items: {
                toUpdate:[],
                toDelete:[],
                toCreate:[]
            },
            actor:{
                "system.currency": actor.system.currency
            }
        }
        this.actorItems = actor.items;
    }

    updateActorProperty(key,value){
        this.updates.actor[key] = value;
    }

    setError(hasError: boolean){
        this.hasError = hasError;
        this.chat.success = !hasError;
    }

    setException(hasException: boolean){
        this.hasException = hasException;
    }
    addChatComponent(key:string, componentResult: ComponentResult){
        this.chat.components[key] = componentResult;
    }
    removeChatComponent(key:string){
        delete this.chat.components[key];
    }

    changeCurrency(currency: Currency) {
        let isAvailable = false;
        try {
            this.updates.actor["system.currency"] = Exchange.pay(currency, this.updates.actor["system.currency"]);
            isAvailable = true;
        } catch (e) {
        }
        this.addChatComponent("currency", {
            component: {
                id: "invalid",
                uuid: "invalid",
                type: "Currency",
                name: currency.name,
                img: 'icons/commodities/currency/coins-assorted-mix-copper-silver-gold.webp',
                quantity: currency.value
            },
            isAvailable: isAvailable,
            type: "consumed"
        });
    }

    removeComponent(type: ComponentType, component: ComponentData) : number {
        const stackStatus = this._addToStack(component,- component.quantity);
        const isAvailable = stackStatus.quantity >= 0;
        const stackKey = sanitizeUuid(stackStatus.id);
        this.addChatComponent(type+stackKey, {
            component: component,
            isAvailable: isAvailable,
            type: type
        });
        if(!isAvailable){
            this.setError(true);
        }
        return stackStatus.quantity;
    }

    _addToStack(component: ComponentData, quantity: number):StackStatus {
        const itemChange = RecipeCompendium.findComponentInList(this.actorItems, component);
        const isOnActor = itemChange.toUpdate["system.quantity"] > 0;
        const updatedItem = this.updates.items.toUpdate
            .filter(x => x._id === itemChange.toUpdate._id)[0];
        const createdItem = this.updates.items.toCreate
            .filter(x => x.id === itemChange.toUpdate._id)[0];
        if(createdItem !== undefined){
            return {
                id: itemChange.toUpdate._id,
                quantity: createdItem.quantity+quantity,
                status: "created"
            }
        }
        if(updatedItem !== undefined){
            return {
                id: itemChange.toUpdate._id,
                quantity: updatedItem["system.quantity"]+quantity,
                status: "updated"
            }
        }
        if(isOnActor){
            this.updates.items.toDelete.push(...itemChange.toDelete);
            itemChange.toUpdate["system.quantity"] = itemChange.toUpdate["system.quantity"]+quantity
            this.updates.items.toUpdate.push(itemChange.toUpdate);
            return {
                id: itemChange.toUpdate._id,
                quantity: itemChange.toUpdate["system.quantity"],
                status: "updated"
            }
        }
        const createdComponent = Component.clone(component);
        createdComponent.quantity = quantity;
        this.updates.items.toCreate.push(createdComponent);
        return {
            id: itemChange.toUpdate._id,
            quantity: quantity,
            status: "created"
        }
    }

    addComponent(type: ComponentType, component: ComponentData) : number {
        // @ts-ignore
        const stackStatus = this._addToStack(component,component.quantity);
        const isAvailable = stackStatus.quantity >= 0;
        const stackKey = sanitizeUuid(stackStatus.id);
        this.addChatComponent(type+stackKey, {
            component: component,
            isAvailable: isAvailable,
            type: type
        });
        return stackStatus.quantity;
    }

}

class DefaultChatData implements ChatData {
    name="";
    img="";
    success=true;
    components:{
        [key: string]: ComponentResult
    }
    skill?: {
        name: string,
        total: number,
        difference: number,
    }
    constructor(){
        this.components = {};
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


