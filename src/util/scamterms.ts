interface ScamTerm {
    name: string;
    pattern: RegExp;

    /** A unique term that contains this one. When that term is found, this one is not counted as well. */
    partOf?: string;
}

/** Wraps a pattern so that it only matches whole words, in any letter case. */
function term(name: string, pattern: string = name, partOf?: string): ScamTerm {
    return {name, pattern: new RegExp(`\\b(?:${pattern})\\b`, "i"), partOf};
}

// Words that are rare outside of the crypto casino scam
const uniqueTerms = [
    term("casino"),
    term("rakeback"),
    term("bitcoin"),
    term("cryptocurrency", "cryptocurrenc(?:y|ies)"),
    term("usdt"),
    term("promo code", "promo ?code"),
    term("mrbeast", "mr ?beast"),
    term("airdrop"),
    term("free spins"),
    term("welcome reward"),
];

// Words the scam uses that could also appear in ordinary screenshots (e.g. bank app, server giveaway, or code with a `crypto` module)
const commonTerms = [
    term("crypto", "crypto\\w*", "cryptocurrency"),
    term("withdraw", "withdraw\\w*"),
    term("deposit", "deposit\\w*"),
    term("bonus", "bonus(?:es)?"),
    term("promo", "promo", "promo code"),
    term("giveaway"),
    term("claim now"),
    term("prize"),
    term("funds"),
];

/** How many different terms a piece of text needs before it counts as the scam. */
const TERMS_NEEDED = 2; // TODO: tweak this threshold based on testing and false positives

export interface ScamTermMatch {
    /** The names of the terms found, each listed once however many times or in whatever form it appears. */
    terms: string[];
    isScam: boolean;
}

/**
 * Looks for the crypto casino scam's vocabulary in text read from an image.
 * The text counts as the scam when it has enough different terms and at least one of them is unique,
 * so that a few common words together, such as "giveaway" and "prize", are not enough.
 */
export function matchScamTerms(text: string): ScamTermMatch {
    const unique = uniqueTerms.filter(t => t.pattern.test(text)).map(t => t.name);
    const common = commonTerms
        .filter(t => t.pattern.test(text) && !(t.partOf && unique.includes(t.partOf)))
        .map(t => t.name);
    const terms = [...unique, ...common];

    return {terms, isScam: unique.length > 0 && terms.length >= TERMS_NEEDED};
}
