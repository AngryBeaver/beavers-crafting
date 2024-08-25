import {Result} from "./Result.js";
import {getToolConfig} from "./apps/ToolConfig.js";


export class TestHandler{
    beaversTests:BeaversCraftingTests
    result:Result;
    initiatorData:InitiatorData;

    constructor(beaversTests:BeaversCraftingTests,result:Result,actor:Actor){
        this.beaversTests = beaversTests;
        this.result = result;
        this.initiatorData={
            userId: game["user"].id,
            actorId: actor.id || "",
            sceneId: canvas?.scene?.id||"",
        }
        TestHandler.initialize(result,beaversTests);
    }

    static getMaxHits(beaversTests:BeaversCraftingTests):number{
        let max = 0;
        Object.values(beaversTests.ands).forEach((and)=>{
            max += and.hits;
        });
        return max;
    }

    static initialize(result:Result,beaversTests:BeaversCraftingTests){
        result._initTests(TestHandler.getMaxHits(beaversTests),beaversTests.fails);
    }

    getCurrentTestAnd():BeaversTestAnd{
        let iterate = 0;
        for(const and of Object.values(this.beaversTests.ands)){
            iterate += and.hits;
            if(this.result._tests.hits<iterate){
                return and;
            }
        }
        throw Error("no Additional Tests found");
    }
    nextTest():string{
        const currentTest = this.getCurrentTestAnd();
        if(Object.keys(currentTest.ors).length == 1){
            const serializedTest = Object.values(currentTest.ors)[0];
            return this.getTest(serializedTest).render();
        }
        return "process";
    }

    hasAdditionalTests():boolean{
        if(this.result.hasError()){
            return false
        }
        if(TestHandler.getMaxHits(this.beaversTests)<=this.result._tests.hits){
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
        const test = this.getTest(testOr);
        var result:TestResult =  await test.action(this.initiatorData);
        const testAnd = this.getCurrentTestAnd();
        var hits = Math.min(result.success,testAnd.hits);
        this.result.updateTests(hits,result.fail);
    }

    async selectTestChoice():Promise<SerializedTest<any>>{
        const choices = {};
        const testAnd = this.getCurrentTestAnd();
        //fix name for tool uuid !
        for(const [id,or] of  Object.entries(testAnd.ors)){
            choices[id] = this.getTest(or).render();
        }
        const choice = parseInt(await beaversSystemInterface.uiDialogSelect({choices:choices}));
        return testAnd.ors[choice];
    }

    getTest(serializedTest: SerializedTest<any>):Test<any>{
        return beaversSystemInterface.testClasses[serializedTest.type].create(serializedTest.data)
    }

}