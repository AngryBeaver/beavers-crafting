
export function sortByFolder(unsorted:Array<{
  folder?: string;
  [key: string]: any;
}>){
  let folders = {};
  unsorted.sort(
      (a,b)=> {
        return recursiveSort(a, a.folder, b, b.folder)
      });
  unsorted.forEach(recipe=>{
      recursiveFolder(folders,recipe.folder,recipe);
    });
  return folders
}

function recursiveFolder(data,folder,recipe){
  if(folder === undefined || folder === ""){
    data[''] = data[''] || [];
    data[''].push(recipe);
  }else{
    const parts = folder.split(/\.(.*)/s);
    data[parts[0]] = data[parts[0]] || {folders:{}}
    recursiveFolder(data[parts[0]].folders,parts[1],recipe);
  }
}

export function recursiveSort(a, afolder:string|undefined,b, bfolder:string|undefined){
  if(afolder === undefined || afolder === ""){
    if(bfolder !== undefined && bfolder !== ""){
      return -1
    }else{
      if(a.name < b.name){
        return -1
      }
      if(a.name > b.name){
        return 1;
      }
      return 0
    }
  }else{
    if(bfolder === undefined || bfolder === ""){
      return 1
    }else{
      const aparts = afolder.split(/\.(.*)/s);
      const bparts = bfolder.split(/\.(.*)/s);
      if(aparts[0] < bparts[0]){
        return -1
      }else if(aparts[0] > bparts[0]){
        return 1;
      }else {
        return recursiveSort(a, aparts[1],b, bparts[1])
      }
    }
  }
}