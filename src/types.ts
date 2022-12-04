
interface Result {
    changes: {
        items: {
            toUpdate:any[],
            toDelete:any[],
            toCreate:ComponentData[]
        },
        currencies: {},
    }
    ingredients: {
        [key: string]: IngredientResult }
    results: { [key: string]: ComponentData }
    currencies: boolean;
    skill?:{
        name: string,
        total: number,
        difference: number,
    };
    tool?:IngredientResult
    attendants: {
        [key: string]: IngredientResult
    }
    hasErrors:boolean;
    hasException:boolean;
    isAvailable:boolean;
}

interface IngredientResult {
    component:ComponentData,
    isAvailable:boolean,
    difference:number
}

interface ComponentData {
    id:string;
    uuid:string;
    type:string;
    name:string;
    img:string;
    quantity:number;
    itemType?: string;
}

interface Skill {
    name:string;
    dc:number;
    consume:boolean;
}

interface Currency {
    name:string;
    value:number;
}

interface ItemChange {
    toDelete: any[];
    toUpdate:{
        "_id": string,
        "system.quantity": number
    };
}

interface MacroResult<t> {
    value:t,
    error?:Error
}

interface RecipeData {
    ingredients:{
        [key: string]: ComponentData
    }
    results: {
        [key: string]: ComponentData
    }
    skill?:Skill;
    currency?:Currency;
    tool?:string;
    attendants:{
        [key: string]: ComponentData
    }
}