import {Recipe} from "../Recipe.js";
import {getSystemSetting, Settings} from "../Settings.js";
import {getDataFrom} from "../helpers/Utility.js";
import {AnyOf} from "../AnyOf.js";
import {getToolConfig} from "./ToolConfig.js";

const recipeSheets: { [key: string]: RecipeSheet } = {};

export class RecipeSheet {
    app;
    item;
    editable:boolean;
    recipe:Recipe;
    recipeElement?;
    sheet:{
        active:string
    }

    static bind(app, html, data) {
        if(Recipe.isRecipe(app.item)){
            if(!recipeSheets[app.id]){
                recipeSheets[app.id] = new RecipeSheet(app,data);
            }
            recipeSheets[app.id].init(html);
            if(!app.initialized){
                app.options.height = 500;
                app.options.width = 700;
                app.setPosition({height:app.options.height,width:app.options.width});
            }
            app.initialized = true;

            app._onResize = (e)=>{
                app.options.height = app.position.height;
                app.options.width = app.position.width;
            }
        }
    }

    constructor(app, data) {
        this.app = app;
        this.item = app.item;
        this.editable = data.editable;
        this.sheet = {
            active : "main"
        };
        this.addDragDrop();
    }

    init(html){
        if(html[0].localName !== "div") {
            html = $(html[0].parentElement.parentElement);
        }
        let exists = html.find(".beavers-crafting.recipe");
        if(exists.length != 0){
            return;
        }
        this.recipeElement = $('<div class="beavers-crafting recipe"></div>');
        beaversSystemInterface.itemSheetReplaceContent(this.app,html,this.recipeElement);
        this.recipe = Recipe.fromItem(this.item);
        this.render();
    }

    addDragDrop(){
        if(this.editable) {
            const dragDrop = new DragDrop({
                dropSelector: '.sheet-body',
                permissions: {
                    dragstart: this.app._canDragStart.bind(this.app),
                    drop: this.app._canDragDrop.bind(this.app)
                },
                callbacks: {
                    dragstart: this.app._onDragStart.bind(this.app),
                    dragover: this.app._onDragOver.bind(this.app),
                    drop: this._onDrop.bind(this)
                }
            });
            this.app._dragDrop.push(dragDrop);
            dragDrop.bind(this.app.form);
        }
    }

    async render(){
        const tools = await getToolConfig();
        const toolChoices = {};
        tools.forEach(tool=>{
            toolChoices[tool.uuid]={text:tool.name,img:tool.img};
        })
        let main = await renderTemplate('modules/beavers-crafting/templates/recipe-main.hbs',
            {
                recipe: this.recipe,
                currencies: beaversSystemInterface.configCurrencies,
                skills: beaversSystemInterface.configSkills,
                abilities: beaversSystemInterface.configCanRollAbility?beaversSystemInterface.configAbilities:[],
                tools: tools,
                toolChoices: toolChoices,
                editable:this.editable,
                displayResults:Settings.get(Settings.DISPLAY_RESULTS),
                displayIngredients:Settings.get(Settings.DISPLAY_RESULTS),
                useAttendants: Settings.get(Settings.USE_ATTENDANTS),
                canRollTool:getSystemSetting().hasTool,
                canRollAbility:beaversSystemInterface.configCanRollAbility,
            });
        let description = await renderTemplate('modules/beavers-crafting/templates/recipe-description.hbs',
            {
                recipe: this.recipe,
                editable:this.editable,
            });
        let template = await renderTemplate('modules/beavers-crafting/templates/recipe-sheet.hbs',{
            main: main,
            description: description,
            active: this.sheet.active,
            advanced: "test",
            recipe: this.recipe
        });
        this.recipeElement.find('.recipe').remove();
        this.recipeElement.append(template);
        this.handleEvents();
    }

    handleEvents(){

        this.app._activateEditor(this.recipeElement.find(".editor-content")[0]);
        this.recipeElement.find('.tabs a').click(e=>{
            this.sheet.active = $(e.currentTarget).data("tab");
            this.render();
        });

        this.handleMainEvents();
    }

    async _onDrop(e) {
        await this._onDropMain(e);
    }

    update() {
        const flags={};
        flags[Settings.NAMESPACE] = {
            recipe: this.recipe.serialize()
        };
        this.item.update({
            "flags": flags
        });
        this.render();
    }

    handleMainEvents() {
        this.recipeElement.find('.ingredients .item-delete').click(e=>{
            this.recipe.removeIngredient(e.target.dataset.id);
            this.update();
        });
        this.recipeElement.find('.results .item-delete').click(e=>{
            this.recipe.removeResult(e.target.dataset.id);
            this.update();
        });
        this.recipeElement.find('.attendants .item-delete').click(e=>{
            this.recipe.removeAttendant(e.target.dataset.id);
            this.update();
        });
        this.recipeElement.find('.skills .item-delete').click(e=>{
            this.recipe.removeSkill();
            this.update();
        });
        this.recipeElement.find('.skills .item-add').click(e=>{
            this.recipe.addSkill();
            this.update();
        });
        this.recipeElement.find('.tools .item-add').click(e=>{
            this.recipe.addTool()
                .then(()=>this.update());
        });
        this.recipeElement.find('.tools .item-delete').click(e=>{
            this.recipe.removeTool();
            this.update();
        });
        this.recipeElement.find('.currencies .item-delete').click(e=>{
            this.recipe.removeCurrency();
            this.update();
        });
        this.recipeElement.find('.cost .item-add').click(e=>{
            this.recipe.addCurrency();
            this.update();
        });
        this.recipeElement.find('.tests .testAnd .item-add').click(e=>{
            this.recipe.addTestAnd();
            this.update();
        });
        this.recipeElement.find('.tests .testOr .item-add').click(e=>{
            const and = $(e.currentTarget).data("and");
            this.recipe.addTestOr(and);
            this.update();
        });
        this.recipeElement.find('.tests .item-delete').click(e=>{
            const and = $(e.currentTarget).data("and");
            const or = $(e.currentTarget).data("or");
            this.recipe.removeTestOr(and,or);
            this.update();
        });

        this.recipeElement.find("select.test-type").on("change",e=>{
                const and = $(e.currentTarget).data("and");
                const or = $(e.currentTarget).data("or");
                if( this.recipe.tests?.ands[and]?.ors[or]?.uuid !== undefined){
                    this.recipe.tests.ands[and].ors[or].uuid = "";
                    this.recipe.tests.ands[and].ors[or].type = "hit";
                    this.recipeElement.find("[name='flags.beavers-crafting.recipe.tests.ands."+and+".ors."+or+".uuid']").val("");
                }
        })

        this.recipeElement.find('.results .crafting-item-img').on("click",e=>{
            const uuid = $(e.currentTarget).data("id");
            if(Settings.get(Settings.DISPLAY_RESULTS)) {
                beaversSystemInterface.uuidToDocument(uuid).then(i=>i.sheet._render(true));
            }
        });
        this.recipeElement.find('.ingredients .crafting-item-img').on("click",e=>{
            const uuid = $(e.currentTarget).data("id");
            if(Settings.get(Settings.DISPLAY_INGREDIENTS)) {
                beaversSystemInterface.uuidToDocument(uuid).then(i=>i.sheet._render(true));
            }
        });
        this.recipeElement.find('.attendants .crafting-item-img').on("click",e=>{
            const uuid = $(e.currentTarget).data("id");
            if(Settings.get(Settings.DISPLAY_INGREDIENTS)) {
                beaversSystemInterface.uuidToDocument(uuid).then(i=>i.sheet._render(true));
            }
        });
    }


    async _onDropMain(e){
        const isIngredient = $(e.target).parents(".beavers-crafting .recipe .ingredients").length !==0;
        const isResult = $(e.target).parents(".beavers-crafting .recipe .results").length !==0;
        const isAttendant = $(e.target).parents(".beavers-crafting .recipe .attendants").length !==0;
        if(!isIngredient && !isResult && !isAttendant){
            return;
        }
        const data = getDataFrom(e);
        if(data &&
            (data.type === "Item" ||
                (data.type === "RollTable" && isResult)
            )
        ) {
            const entity = await fromUuid(data.uuid);
            if (entity) {
                const isAnyOf = AnyOf.isAnyOf(entity)
                if(isAnyOf && !isIngredient){
                    return;
                }
                if (isIngredient) {
                    let type = data.type;
                    let keyid = data.uuid;
                    if(AnyOf.isAnyOf(entity)){
                        type = Settings.ANYOF_SUBTYPE;
                        keyid = foundry.utils.randomID();
                    }
                    this.recipe.addIngredient(entity, keyid,type);
                }
                if (isResult) {
                    this.recipe.addResult(entity, data.uuid, data.type);
                }
                if (isAttendant) {
                    this.recipe.addAttendant(entity, data.uuid, data.type);
                }
                this.update();
            }
        }
    }
}