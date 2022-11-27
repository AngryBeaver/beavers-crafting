
interface Result {
    changes: {
        items: {
            toUpdate:any[],
            toDelete:any[],
            toCreate:Component[]
        },
        currencies: {},
    }
    ingredients: {
        [key: string]: IngredientResult }
    results: { [key: string]: Component }
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
    component:Component,
    isAvailable:boolean,
    difference:number
}

interface Component {
    id:string;
    uuid:string;
    type:string;
    sourceId:string;
    name:string;
    img:string;
    quantity:number;
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