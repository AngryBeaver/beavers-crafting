import {Dnd5e} from "./Dnd5e.js";

export class System {
    getCurrencies:()=>any;
    getSkills:()=>any;
    getAbilities:()=>any;
    addActorTab:(id:string,tabHeader:string,tabBody:JQuery, html)=>void;


    constructor(){
        if(game["system"].id === "dnd5e"){
            return new Dnd5e();
        }
    }
}