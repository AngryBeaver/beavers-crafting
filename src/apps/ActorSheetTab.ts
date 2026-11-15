import {CraftingApp} from "./CraftingApp.js";
import {Crafting} from "../Crafting.js";
import {Settings} from "../Settings.js";
import {TestHandler} from "../TestHandler.js";
import { sortByFolder } from "../helpers/Folder.js";
import { markDeleted, renderTemplate } from "../helpers/Compat.js";
import { Pip, progressPips } from "../helpers/Progress.js";

/** beavers-system-interface test types that need no roll, they just count as passed */
const NO_ROLL_TESTS = ["IncrementStep"];

interface EntryView {
    id: string;
    name: string;
    img: string;
    state: "active" | "success" | "error";
    open: boolean;
    sub: string;
    subIcon: string;
    hasTests: boolean;
    pips?: Pip[];
    bar?: { hit: number, fail: number };
    hasFails: boolean;
    progress: string;
    progressTip: string;
    actionIcon: string;
    actionLabel: string;
    instruction: string;
    groups: { label: string, items: { name: string, img: string, cls: string, icon: string }[] }[];
}

interface FolderView {
    name: string;
    path: string;
    collapsed: boolean;
    count: number;
    entries: EntryView[];
    folders: FolderView[];
}

/** UI state that has to survive the sheet re-rendering, per actor. */
const openEntries = new Map<string, Set<string>>();
const collapsedFolders = new Map<string, Set<string>>();

function stateSet(map: Map<string, Set<string>>, actorId: string): Set<string> {
    let set = map.get(actorId);
    if (!set) {
        set = new Set();
        map.set(actorId, set);
    }
    return set;
}

const t = (key: string) => game["i18n"].localize("beaversCrafting.actorSheet." + key);
const f = (key: string, data: object) => game["i18n"].format("beaversCrafting.actorSheet." + key, data);

export class ActorSheetTab {
    app;
    html;
    craftingList:{
        [key:string]:Crafting
    } = {};

    constructor(app, html, data){
        app.beaversCraftingTabSheet = this;
        this.app = app;
        this.html = html.jquery ? html:$(html);
        void this.init().then(()=>{
            this.activateTab()
        });
    }

    get actorKey(): string {
        return this.app.actor.uuid || this.app.actor.id;
    }

    async init() {
        const label = Settings.get(Settings.TAB_NAME) || game["i18n"].localize("beaversCrafting.actorSheet.tab");
        const icon = Settings.get(Settings.TAB_ICON) || "fa-scroll";
        const flag = foundry.utils.getProperty(this.app.actor,`flags.${Settings.NAMESPACE}.crafting`) || {};
        const open = stateSet(openEntries, this.actorKey);
        const unsorted: { folder: string, name: string, entry: EntryView }[] = [];
        const counts = {active: 0, success: 0, error: 0};
        for(const [id, data] of Object.entries(flag)){
            const crafting = new Crafting(data as CraftingData, this.app.actor);
            this.craftingList[id] = crafting;
            const entry = this._entryView(id, crafting, open.has(id));
            counts[entry.state]++;
            unsorted.push({folder: crafting.recipe.folder || "", name: crafting.recipe.name, entry});
        }
        const tree = this._buildTree(sortByFolder(unsorted));
        const summary = [
            {cls: "run", text: f("summary.active", {count: counts.active}), count: counts.active},
            {cls: "ok", text: f("summary.success", {count: counts.success}), count: counts.success},
            {cls: "bad", text: f("summary.error", {count: counts.error}), count: counts.error},
        ].filter(s => s.count > 0);
        const tabBody = $(await renderTemplate('modules/beavers-crafting/templates/actor-sheet-tab.hbs', {
            tree,
            summary,
            empty: unsorted.length === 0,
        }));
        beaversSystemInterface.actorSheetAddTab(this.app, this.html, this.app.actor, { id: Settings.ACTOR_TAB_ID, label: label, html: `<i class="fas ${icon}"/>` }, tabBody);
        this.activateListeners(tabBody);
    }

    _buildTree(node, parentPath = ""): { entries: EntryView[], folders: FolderView[], count: number } {
        const collapsed = stateSet(collapsedFolders, this.actorKey);
        const entries: EntryView[] = (node[""] || []).map(e => e.entry);
        const folders: FolderView[] = Object.keys(node)
            .filter(name => name !== "")
            .map(name => {
                const path = parentPath ? parentPath + "." + name : name;
                const sub = this._buildTree(node[name].folders, path);
                return {name, path, collapsed: collapsed.has(path), ...sub};
            });
        const count = entries.length + folders.reduce((sum, folder) => sum + folder.count, 0);
        return {entries, folders, count};
    }

    _entryView(id: string, crafting: Crafting, open: boolean): EntryView {
        const chat = crafting.getChatData();
        const tests = chat.beaversTests;
        const state = chat.status as EntryView["state"];
        const hasTests = !!crafting.recipe.beaversTests && tests.maxHits > 0;
        const view: EntryView = {
            id,
            name: chat.name,
            img: chat.img,
            state,
            open,
            sub: "",
            subIcon: "",
            hasTests,
            hasFails: hasTests && tests.maxFails > 0,
            progress: "",
            progressTip: "",
            actionIcon: "",
            actionLabel: "",
            instruction: crafting.recipe.instruction || "",
            groups: [],
        };

        if (hasTests) {
            const hits = Math.min(tests.hits, tests.maxHits);
            const fails = Math.min(tests.fails, tests.maxFails);
            view.progressTip = f("progress.tip", {hits, maxHits: tests.maxHits, fails, maxFails: tests.maxFails});
            view.pips = progressPips(hits, tests.maxHits, fails, tests.maxFails);
            if (!view.pips) {
                view.bar = {
                    hit: Math.round(hits * 100 / tests.maxHits),
                    fail: tests.maxFails > 0 ? Math.round(fails * 100 / tests.maxFails) : 0,
                };
            }
            view.progress = state === "error" && tests.maxFails > 0 && fails >= tests.maxFails
                ? f("progress.fails", {count: fails})
                : f("progress.hits", {hits, maxHits: tests.maxHits});
        }

        const missing = [...chat.components.required, ...chat.components.consumed]
            .filter(c => c.status === "error")
            .map(c => c.component.name);
        if (state === "active") {
            const next = hasTests ? this._nextTest(crafting) : undefined;
            if (next) {
                view.sub = f("next", {test: next.text});
                view.subIcon = next.roll ? "fa-dice-d20" : "fa-shoe-prints";
                view.actionIcon = next.roll ? "fa-dice-d20" : "fa-forward-step";
                view.actionLabel = next.roll ? t("roll") : t("proceed");
            } else {
                view.sub = t("ready");
                view.subIcon = "fa-hourglass-half";
                view.actionIcon = "fa-forward-step";
                view.actionLabel = t("finish");
            }
        } else if (state === "success") {
            const produced = chat.components.produced.map(c => `${Math.abs(c.component.quantity ?? 1)}× ${c.component.name}`);
            view.sub = produced.length ? f("crafted", {items: produced.join(", ")}) : t("completed");
        } else {
            view.sub = missing.length ? f("missing", {items: missing.join(", ")}) : t("tooManyFails");
        }

        const group = (label: string, list: ComponentChatData[]) => {
            if (list.length === 0) return;
            view.groups.push({
                label: t("details." + label),
                items: list.map(c => {
                    const quantity = Math.abs(c.component.quantity ?? 1);
                    const status = {
                        success: {cls: "ok", icon: "fa-check"},
                        error: {cls: "bad", icon: "fa-xmark"},
                        locked: {cls: "wait", icon: "fa-lock"},
                    }[c.status] || {cls: "wait", icon: ""};
                    return {
                        name: quantity !== 1 || c.component.type === "Currency" ? `${quantity}× ${c.component.name}` : c.component.name,
                        img: c.component.img,
                        ...status,
                    };
                }),
            });
        };
        group("required", chat.components.required);
        group("consumed", chat.components.consumed);
        group("produced", chat.components.produced);
        return view;
    }

    /**
     * the check(s) that come next as plain text, e.g. "Survival:dc 12",
     * and whether any of them is a roll (IncrementStep just proceeds).
     */
    _nextTest(crafting: Crafting): { text: string, roll: boolean } | undefined {
        try {
            const handler = new TestHandler(crafting.recipe.beaversTests as BeaversCraftingTests, crafting.result, crafting.actor);
            if (!handler.hasAdditionalTests()) return undefined;
            const ors = Object.values(handler.getCurrentTestAnd().ors);
            return {
                text: ors.map(or => CraftingApp._plainText(handler.getTest(or).render(), 40)).join(" / "),
                roll: ors.some(or => !NO_ROLL_TESTS.includes(or.type)),
            };
        } catch (e) {
            return undefined;
        }
    }

    activateTab(){
        if(this.app.activeTab !== undefined){
            if(this.app._tabs){ //V1
                this.app._tabs[0].activate(this.app.activeTab);
            }
            if(this.app.changeTab){//V2
                this.app.changeTab(this.app.activeTab,"primary",{force:true});
            }

        }
    }

    activateListeners(tabBody:JQuery) {
        const open = stateSet(openEntries, this.actorKey);
        const collapsed = stateSet(collapsedFolders, this.actorKey);
        tabBody.find(".addCrafting").on("click", () => {
            new CraftingApp(this.app.actor).render(true);
        });
        tabBody.find(".removeCrafting").on("click", (e) => {
            const id = e.currentTarget.dataset.id as string;
            open.delete(id);
            void this.app.actor.update(markDeleted({}, `flags.${Settings.NAMESPACE}.crafting.${id}`));
        });
        tabBody.find(".advanceCrafting").on("click", (e) => {
            const button = e.currentTarget as HTMLButtonElement;
            const id = button.dataset.id as string;
            button.disabled = true;
            void this.craftingList[id].continueCrafting().finally(() => {
                this.app.render();
            });
        });
        tabBody.find(".bct-toggle").on("click", (e) => {
            const entry = $(e.currentTarget).closest(".bct-entry");
            const id = entry.attr("data-id") as string;
            entry.toggleClass("open");
            if (entry.hasClass("open")) open.add(id); else open.delete(id);
        });
        tabBody.find(".bct-fold").on("click", (e) => {
            const folder = $(e.currentTarget).closest(".bct-folder");
            const path = folder.attr("data-path") as string;
            folder.toggleClass("collapsed");
            if (folder.hasClass("collapsed")) collapsed.add(path); else collapsed.delete(path);
        });

        this.html.find(beaversSystemInterface.actorSheetTabSelector).click(e => {
            if(e.currentTarget.dataset?.tab !== undefined) {
                this.app.activeTab = e.currentTarget.dataset.tab;
            }
            this.app.render();
        });
    }
}
