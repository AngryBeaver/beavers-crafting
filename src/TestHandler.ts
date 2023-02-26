import {Result} from "./Result.js";
import {getToolConfig} from "./apps/ToolConfig.js";


export class TestHandler{
    tests:Tests
    result:Result;
    actor:Actor;

    constructor(tests:Tests,result:Result,actor:Actor){
        this.tests = tests;
        this.result = result;
        this.actor=actor;
        TestHandler.initialize(result,tests);
    }

    static getMaxHits(tests:Tests):number{
        let max = 0;
        Object.values(tests.ands).forEach((and)=>{
            max += and.hits;
        });
        return max;
    }

    static initialize(result:Result,tests:Tests){
        result._initTests(TestHandler.getMaxHits(tests),tests.fails);
    }

    getCurrentTestAnd():TestAnd{
        let iterate = 0;
        for(const and of Object.values(this.tests.ands)){
            iterate += and.hits;
            if(this.result._tests.hits<iterate){
                return and;
            }
        };
        throw Error("no Additional Tests found");
    }

    hasAdditionalTests():boolean{
        if(this.result.hasError()){
            return false
        }
        if(TestHandler.getMaxHits(this.tests)<=this.result._tests.hits){
            return false
        }
        try{
            this.getCurrentTestAnd();
        }catch(e){
            console.warn(e.message);
            return false;
        }
        return true;
    }


    async test(){
        const testOr = await this.selectTestChoice();
        let test = false;
        if(testOr.type === "ability") {
            test = await this._testAbility(testOr);
        }else if(testOr.type === "skill") {
            test = await this._testSkill(testOr);
        }else if(testOr.type === "tool") {
            test = await this._testTool(testOr);
        }else if(testOr.type === "hit") {
            test = true;
        }
        //todo time,hook,macro,item
        if(test){
            this.result.updateTests(1,0);
        }else{
            this.result.updateTests(0,1);
        }
    }

    async _testAbility(testOr:TestOr):Promise<boolean>{
        let roll = await beaversSystemInterface.actorRollAbility(this.actor, testOr.uuid);
        if(roll != undefined && roll.total >= testOr.check){
            return true;
        }
        return false;
    }

    async _testSkill(testOr:TestOr):Promise<boolean>{
        let roll = await beaversSystemInterface.actorRollSkill(this.actor, testOr.uuid);
        if(roll != undefined && roll.total >= testOr.check){
            return true;
        }
        return false;
    }

    async _testTool(testOr:TestOr):Promise<boolean>{
        const item = await beaversSystemInterface.uuidToDocument(testOr.uuid);
        const toolComponent = beaversSystemInterface.componentFromEntity(item);
        const results = beaversSystemInterface.itemListComponentFind(this.actor.items,toolComponent);
        const actorComponent = results.components[0]
        if(actorComponent == undefined){
            // @ts-ignore
            ui.notifications.warn("actor does not have this tool");
            throw Error("actor does not have this tool");
        }
        const actorItem = await beaversSystemInterface.uuidToDocument(actorComponent.uuid);
        let roll = await beaversSystemInterface.actorRollTool(this.actor, actorItem);
        if(roll != undefined && roll.total >= testOr.check){
            return true;
        }
        return false;
    }



    async selectTestChoice():Promise<TestOr>{
        const choices = {};
        const testAnd = this.getCurrentTestAnd();
        //fix name for tool uuid !


        for(const [id,or] of  Object.entries(testAnd.ors)){
            if(or.type === "skill"){
                beaversSystemInterface.configSkills.forEach(skill=>{
                    if(skill.id === or.uuid){
                        choices[id] = {text:skill.label+":"+or.check};
                        return;
                    }
                });
            }
            if(or.type === "ability"){
                beaversSystemInterface.configAbilities.forEach(ability=>{
                    if(ability.id === or.uuid){
                        choices[id] = {text:ability.label+":"+or.check};
                        return;
                    }
                });
            }
            if(or.type === "tool"){
                const tools = await getToolConfig();
                tools.forEach(tool=>{
                    if(tool.uuid === or.uuid){
                        choices[id] = {text:tool.name+":"+or.check,img:tool.img};
                        return;
                    }
                });
            }
            if(or.type === "hit"){
                choices[id] = {text:"hit step"};
            }

        }
        const choice = parseInt(await beaversSystemInterface.uiDialogSelect({choices:choices}));
        return testAnd.ors[choice];
    }

}