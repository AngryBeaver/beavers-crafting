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
    endAt: number,
    result: ResultData
    recipe: RecipeData
}

interface ComponentResultsData {
    _data: ComponentResultData[];
}

interface ComponentResultData {
    component: ComponentData,
    originalQuantity: number,
    userInteraction: UserInteraction
    isProcessed: boolean,
}

type UserInteraction =  "always" | "never" | "onSuccess";

type ComponentType = "consumed" | "required" | "produced";

interface ComponentChatData {
    component: ComponentData,
    type: ComponentType,
    hasError: boolean,
    isProcessed: boolean,
}

interface ChatData {
    title: string;
    img: string;
    components:ComponentChatData[]
    status: string;
    skill?: {
        name: string,
        dc: number,
        total: number,
    }
}

interface PreCastData {
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
    currencies?: boolean;
}

interface ComponentData {
    id: string;
    uuid: string;
    type: string;
    name: string;
    img: string;
    quantity: number;
    itemType?: string;
}

interface Skill {
    name: string;
    dc: number;
    consume: boolean;
}

interface Currencies {
    [name:string]:number
}

interface SystemCurrencies {
    [name:string]:SystemCurrency
}

interface SystemCurrency {
    name: string,
    label: string,
    factor: number,
}

interface Currency {
    name: string;
    value: number;
}

interface CurrencyResultData extends Currency{
    hasError: boolean;
    isConsumed: boolean
}

interface ItemChange {
    toDelete: string[];
    toUpdate: UpdateItem;
}

interface UpdateItem {
    "_id": string,
    "system.quantity": number
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
    skill?: Skill;
    currency?: Currency;
    tool?: string;
    attendants: {
        [key: string]: ComponentData
    },
    macro?: string
}
interface ItemChanges {
    create:any[],
    update:UpdateItem[],
    delete:string[]
}
