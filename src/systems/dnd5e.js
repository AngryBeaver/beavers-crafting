export function getCurrencies(){
    return Object.entries(game.dnd5e.config.currencies).map(currency=>currency[1]);
}

export function getSkills(){
    return Object.entries(game.dnd5e.config.skills).map(skills=>{
        return {...{id:skills[0]},...skills[1]};
    });
}