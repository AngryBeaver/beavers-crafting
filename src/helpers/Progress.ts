/** above this many checks the pips get too small, a bar or plain text is used instead */
export const MAX_PIPS = 12;

export type Pip = { cls: "ok" | "bad" | "" } | { sep: true };

/** one pip per required success, then (separated) one per allowed failure */
export function progressPips(hits: number, maxHits: number, fails: number, maxFails: number): Pip[] | undefined {
    if (maxHits + maxFails > MAX_PIPS) {
        return undefined;
    }
    const pips: Pip[] = [];
    for (let i = 0; i < maxHits; i++) pips.push({cls: i < hits ? "ok" : ""});
    if (maxFails > 0) {
        pips.push({sep: true});
        for (let i = 0; i < maxFails; i++) pips.push({cls: i < fails ? "bad" : ""});
    }
    return pips;
}
