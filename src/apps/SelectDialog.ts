export class SelectDialog extends Application {
    choices: { [id: string]: {text:string,img?:string} }
    callback;
    selected: number | string;

    static str(data: { choices: { [id: string]: {text:string,img?:string} } }) {
        return new Promise<string>((resolve) => {
            const keys = Object.keys(data.choices);
            if(keys.length === 1){
                resolve(keys[0]);
                return;
            }
            if(keys.length === 0){
                resolve("");
                return;
            }
            new SelectDialog({
                ...data,
                callback: resolve
            }).render(true);
        });
    }

    constructor(data: { choices: { }, callback: (id: string | PromiseLike<string>) => void }, options?: Partial<Application.Options>) {
        super(options);
        this.choices = data.choices;
        this.callback = data.callback;
    }

    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            title: game["i18n"].localize(`beaversCrafting.test-app.title`),
            width: 300,
            height: 70,
            template: "modules/beavers-crafting/templates/select-dialog.hbs",
            resizable: false,
            classes: ["beavers-crafting", "select-dialog"],
            popOut: true
        });
    }

    getData() {
        return {
            choices: this.choices
        }
    }

    activateListeners(html: JQuery) {
        html.find("select").on("change", () => {
            const result = html.find("select").val() as string;
            this.selected = result;
            if (result != "") {
                this.close();
            }
        })
    }

    close(options?: Application.CloseOptions): Promise<void> {
        const result = super.close(options);
        this.callback(this.selected);
        return result;
    }


}

