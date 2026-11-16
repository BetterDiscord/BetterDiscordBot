import {describe, expect, test} from "bun:test";
import {matchScamTerms} from "../src/util/scamterms";


// Text that OCR read from real scam images, kept with its misreadings.
const scamImages = {
    fakeProfilePost: `MrBeast © B of Grok @MrBeast Beast Games Strong Vs Smart Is Out Now! | am pleased to announce the launch of my own cryptocurrency casino linked to our recent launch of the Vyro project! To celebrate this big event, | am giving away $2,500 to everyone who registers, and you can withdraw the bonus immediately. Post da How to claim your reward: 1. Go to sabrewin.com 2. Enter the special promo code`,
    bonusPage: `@ Home 3 Profile 5 Bonuses % VIP-Club TR (CER BONUSES \\BLE ACK @ Activate Code for Bonus : & 3 Profile 3 Enter the promo code and receive an exclusi 6 Deposit 3 4 Settings Rakeback ch SRE SNR Bets placed in 24 hours | Your rakeback i Congratulations! You have b: one of the lucky ones Your prize has been successfully credited`,
    withdrawalPopup: `7X MrBeast (@MrBeast) / X x @ Catewin | Profile tN + - => © 5 catewin.com/profile/withdraw Withdrawal Success! x Your Withdrawal of $3700.00 Was Successfully! The money will be transferred to your specified wallet. Continue`,
    walletScreen: `1. Select a Withdraw Method ® Tether | CRYPTO BANK CARD 4. Enter Wallet Address 2. Select Crypto to Withdraw 5. Type a Comment & Tether v 3. Select Network ERC20 BEP20 TRC20 6. Enter Withdrawal Amount 2700 drawal Success! x 21:47 w Te &« w usDT $0.999 ar Withdrawal of $2700.00 Was Successfull`,
    blurryPhoneScreenshot: `MrBeast® B : east Games Strong Vs Smarts Out Now! &) Media Personality © Follow me for a cookie © Joined April 2014 > Pinned eo = eMBeast - 47 minutes 380 i ae OB oe mtr om mp to re i CO tnraw the bonus immediateh ‘How to claim your reward: 1. Go to maccox.com LC he speci promo cad: PROT Ee or 53.200 bonus Play`,
};

describe("text from real scam images", () => {
    test("the fake profile post is flagged", () => {
        expect(matchScamTerms(scamImages.fakeProfilePost)).toEqual({
            terms: ["casino", "cryptocurrency", "promo code", "mrbeast", "withdraw", "bonus"],
            isScam: true,
        });
    });

    test("the casino's bonus page is flagged", () => {
        expect(matchScamTerms(scamImages.bonusPage)).toEqual({
            terms: ["rakeback", "promo code", "deposit", "bonus", "prize"],
            isScam: true,
        });
    });

    test("the withdrawal popup is flagged by the name in the browser tab", () => {
        expect(matchScamTerms(scamImages.withdrawalPopup)).toEqual({terms: ["mrbeast", "withdraw"], isScam: true});
    });

    test("the wallet screen is flagged", () => {
        expect(matchScamTerms(scamImages.walletScreen)).toEqual({terms: ["usdt", "crypto", "withdraw"], isScam: true});
    });

    test("a blurry screenshot is flagged from the few words that survive", () => {
        expect(matchScamTerms(scamImages.blurryPhoneScreenshot)).toEqual({terms: ["mrbeast", "bonus", "promo"], isScam: true});
    });

    test("an image where only one word is readable is not flagged", () => {
        const match = matchScamTerms("Successful Awal Succes Withdraws cessful succ val was s frawa withc our v Receiveq x / $3,400");
        expect(match).toEqual({terms: ["withdraw"], isScam: false});
    });
});

describe("ordinary text", () => {
    const ordinary = {
        "a settings panel": "Plugin Settings Enable message logger Update plugins automatically Theme: Dark",
        "a server giveaway": "Nitro giveaway! React below to win the prize. Claim now before it ends",
        "a bank app": "Your deposit of $50 has arrived. Available funds: $120. Withdraw to your account",
        "code that uses the crypto module": "TypeError: crypto.randomUUID is not a function at promo (plugin.js:12)",
        "a mention of the person the scam imitates": "MrBeast posted a new video",
        "a pay rise": "I got a bonus at work and will withdraw it tomorrow",
        "no text at all": "",
    };

    for (const [name, text] of Object.entries(ordinary)) {
        test(`${name} is not flagged`, () => {
            expect(matchScamTerms(text).isScam).toBe(false);
        });
    }
});

describe("counting terms", () => {
    test("different forms of a word count once", () => {
        expect(matchScamTerms("withdraw withdrawal withdrawals WITHDRAWS").terms).toEqual(["withdraw"]);
        expect(matchScamTerms("bonus Bonuses").terms).toEqual(["bonus"]);
    });

    test("letter case does not matter", () => {
        expect(matchScamTerms("CASINO RaKeBaCk").terms).toEqual(["casino", "rakeback"]);
    });

    test("a term inside a longer word is not found", () => {
        expect(matchScamTerms("casinos prized refunds promotion").terms).toEqual([]);
    });

    test("promo code is found with a space, without one, and is not also counted as promo", () => {
        expect(matchScamTerms("enter the promo code").terms).toEqual(["promo code"]);
        expect(matchScamTerms("SPECIAL PROMOCODE").terms).toEqual(["promo code"]);
        expect(matchScamTerms("special promo").terms).toEqual(["promo"]);
    });

    test("cryptocurrency is not also counted as crypto", () => {
        expect(matchScamTerms("my own cryptocurrency").terms).toEqual(["cryptocurrency"]);
        expect(matchScamTerms("CRYPTO | BANK CARD").terms).toEqual(["crypto"]);
    });

    test("mrbeast is found with and without a space", () => {
        expect(matchScamTerms("MrBeast").terms).toEqual(["mrbeast"]);
        expect(matchScamTerms("Mr Beast").terms).toEqual(["mrbeast"]);
    });
});

describe("the rule for flagging", () => {
    test("one unique term alone is not enough", () => {
        expect(matchScamTerms("casino").isScam).toBe(false);
    });

    test("two unique terms are enough", () => {
        expect(matchScamTerms("casino rakeback").isScam).toBe(true);
    });

    test("one unique term and one common term are enough", () => {
        expect(matchScamTerms("usdt deposit").isScam).toBe(true);
    });

    test("common terms alone are never enough, however many there are", () => {
        const match = matchScamTerms("crypto withdraw deposit bonus promo giveaway claim now prize funds");
        expect(match.terms.length).toBe(9);
        expect(match.isScam).toBe(false);
    });
});
