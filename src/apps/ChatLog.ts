import { Settings } from "../Settings.js";

export function hookChatLog(){
  if(game[Settings.NAMESPACE].Settings.get(Settings.DRAGGABLE_CHAT_RESULT)) {
    addDraggAble(ui.chat?.element);
  }
  //v13+ renders chat messages as HTMLElement, the jquery renderChatMessage hook is removed in v15
  const hook = game["version"].split(".")[0] >= 13 ? "renderChatMessageHTML" : "renderChatMessage";
  Hooks.on(hook,(msg,html,option)=>{
    addDraggAble(html);
  });
}

function addDraggAble(html){
  if(!html) return;
  $(html).find(".beavers-crafting .beavers-component .flexrow[data-type='output']")
    .attr("draggable", "true")
    .addClass("draggable")
    .on("dragstart",
      (event) => {
        drag(event);
      });
}

function drag(event) {
  // @ts-ignore
  const uuid = $(event.currentTarget).data("id");
  event.originalEvent.dataTransfer.setData(
    "text/plain",
    JSON.stringify({type: "Item", uuid:uuid })
  );
}
