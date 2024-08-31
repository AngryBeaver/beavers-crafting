interface ResultApi {
    hasError: ()=>boolean,
    addChatComponent: (componentChatData:ComponentChatData)=>void,
    updateActorProperty:(key:string,value:any)=>void,
    updateComponent: (type: ComponentType, componentData: ComponentData, fn: (componentResult:ComponentResultData,quantity: number)=>void)=>void,
    deleteComponent: (type: ComponentType, componentData: ComponentData)=>void,
    payCurrency: (currency:Currency)=>void
}

interface ResultData {
    _actorUpdate:{
        [key:string]: string
    };
    _hasException:boolean;
    _components: {
        required: ComponentResultsData,
        consumed: ComponentResultsData,
        produced: ComponentResultsData
    }
    _tests?: {
        hits: number,
        fails: number,
        maxFails:number,
        maxHits: number
    }
    _currencyResult?: CurrencyResultData
    _chatAddition: {
        [key: string]:ComponentChatData
    }
    _recipe: RecipeData;
}

interface CraftingData {
    uuid?: string,
    name: string,
    img: string,
    startAt: number,
    lastAt: number,
    endAt: number,
    result: ResultData
    recipe: RecipeData
    isFinished?:boolean,
    restore: any[]
}

interface ComponentResultsData {
    _data: ComponentResultData[];
}

interface ComponentResultData {
    component: ComponentData,
    isProcessed: boolean,
    originalQuantity: number,
    userInteraction: UserInteraction
}

type UserInteraction =  "always" | "never" | "onSuccess";

type ComponentType = "consumed" | "required" | "produced";
type DataType = "required" | "input" | "output";

type ComponentStatus = "success"|"error"|"locked"|"undefined"|"unknown";


interface ComponentChatData {
    component: ComponentData,
    type: ComponentType,
    status: ComponentStatus,
    isProcessed: boolean,
}

interface ChatData {
    name: string;
    img: string;
    components:{
        required:ComponentChatData[],
        consumed:ComponentChatData[],
        produced:ComponentChatData[]
    }
    status: string;
    beaversTests:{
        maxHits:number,
        maxFails:number,
        hits:number,
        fails:number,
        hitPer:number,
        failPer:number
    }
}
interface PreCastData {
    input: {
        [key: string]: {
            [key: string]: ComponentStatus
        }
    }
    required: {
        [key: string]: {
            [key: string]: ComponentStatus
        }
    }
    currencies?: { status: ComponentStatus }
}

interface Currency {
    name: string;
    value: number;
}

interface CurrencyResultData extends Currency{
    hasError: boolean;
    isConsumed: boolean
}

interface MacroResult<t> {
    value: t,
    error?: Error
}

interface AnyOfStoreData {
    macro: string
}

interface BeaversCraftingTests extends BeaversTests{
    consume: boolean,
}

interface RecipeData {
    input: {
        [key: string]: {
            [key: string]: ComponentData
        }
    }
    output: {
        [key: string]: {
            [key: string]: ComponentData
        }
    }
    required: {
        [key: string]: {
            [key: string]: ComponentData
        }
    }
    ingredients?: {
        [key: string]: ComponentData
    }
    results?: {
        [key: string]: ComponentData
    }
    attendants?: {
        [key: string]: ComponentData
    },
    beaversTests?: BeaversCraftingTests
    tests?: Tests;
    currency?: Currency;
    tool?: string;
    macro?: string
    folder?: string
    instruction?: string
}


//legacy Test can be removed
type TestType = "skill" | "tool" | "ability" | "hit";

interface Tests {
    fails: number,
    consume: boolean,
    ands: {
        [key: number]: TestAnd,
    }
}

interface TestAnd {
    hits: number,
    ors: {
        [key: number]: TestOr,
    }
}

interface TestOr {
    check: number,
    type: TestType,
    uuid: string
}