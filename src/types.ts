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
    _skill?: {
        name: string,
        dc: number,
        total: number,
    };
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

type TestType = "skill" | "tool" | "ability" | "hit";

type ComponentStatus = "success"|"error"|"locked"|"undefined";


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
    skill?: {
        name: string,
        dc: number,
        total: number,
    }
    tests:{
        maxHits:number,
        maxFails:number,
        hits:number,
        fails:number,
        hitPer:number,
        failPer:number
    }
}
interface PreCastData {
    ingredients: {
        [key: string]: ComponentStatus
    }
    attendants: {
        [key: string]: ComponentStatus
    }
    currencies?: { status: ComponentStatus }
}

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

interface Skill {
    name: string;
    dc: number;
    consume: boolean;
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

interface RecipeData {
    ingredients: {
        [key: string]: ComponentData
    }
    results: {
        [key: string]: ComponentData
    }
    tests?: Tests;
    skill?: Skill;
    currency?: Currency;
    tool?: string;
    attendants: {
        [key: string]: ComponentData
    },
    macro?: string
    folder?: string
    instruction?: string
}