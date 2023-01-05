import {System} from "./System.js";

export class Dnd5e implements System{

    getCurrencies(){
        return Object.entries(game["dnd5e"].config.currencies).map(currency=>currency[1]);
    }

    getSkills(){
        return Object.entries(game["dnd5e"].config.skills).map(skills=>{
            // @ts-ignore
            return {id:skills[0],...skills[1]};
        });
    }

    getAbilities(){
        return Object.entries(game["dnd5e"].config.abilities).map(ab=>{
            return {id:"ability-"+ab[0],label:ab[1]};
        });
    }

    addActorTab(id:string,tabHeader:string,tabBody:JQuery, html){
        const tabs = $(html).find(".sheet-navigation.tabs");
        const body = $(html).find(".sheet-body");
        const tabItem = $('<a class="item" data-tab="'+id+'">'+tabHeader+'</a>');
        tabs.append(tabItem);
        const tabContent = $('<div class="tab '+id+'" data-group="primary" data-tab="'+id+'"></div>');
        body.append(tabContent);
        tabContent.append(tabBody);
    }



}