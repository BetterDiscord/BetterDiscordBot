import {describe, expect, test} from "bun:test";
import {isSessionId, runSession, sessionId} from "../src/framework/session";
import {sessionHarness} from "./helpers/session";


describe("session ids", () => {
    test("are namespaced so the dispatcher can tell them apart", () => {
        expect(isSessionId(sessionId("next"))).toBe(true);
        expect(isSessionId("selfroles.open:user")).toBe(false);
    });
});


describe("runSession", () => {
    const counter = (harness: ReturnType<typeof sessionHarness>) => runSession<number>({
        interaction: harness.interaction,
        initial: 1,
        render: (n, {ended}) => ({content: `n=${n} ended=${ended}`}),
        reduce: (action, n) => action === "inc" ? n + 1 : action === "dec" ? n - 1 : undefined
    });

    test("renders the initial state immediately", async () => {
        const harness = sessionHarness();
        const done = counter(harness);
        await harness.press("noop");
        expect(harness.shown[0]).toEqual({content: "n=1 ended=false"});
        await harness.end();
        await done;
    });

    test("applies each action in order", async () => {
        const harness = sessionHarness();
        const done = counter(harness);
        await harness.press("inc");
        await harness.press("inc");
        await harness.press("dec");
        await harness.end();
        expect(await done).toBe(2);
    });

    test("an unrecognised action acknowledges without changing state", async () => {
        const harness = sessionHarness();
        const done = counter(harness);
        const before = harness.shown.length;
        await harness.press("mystery");
        expect(harness.shown).toHaveLength(before);
        await harness.end();
        expect(await done).toBe(1);
    });

    /**
     * The old Paginator assigned `this.buttonInteraction = i` before checking
     * the user, so anyone could redirect someone else's menu.
     */
    test("a different user cannot drive the menu", async () => {
        const harness = sessionHarness("owner");
        const done = counter(harness);
        await harness.press("inc");

        const refusals = await harness.press("inc", {userId: "someone-else"});
        expect(String(refusals[0]?.content)).toContain("belongs to someone else");

        await harness.end();
        expect(await done).toBe(2);
    });

    test("audience:anyone opts out of the ownership check", async () => {
        const harness = sessionHarness("owner");
        const done = runSession<number>({
            interaction: harness.interaction,
            initial: 0,
            audience: "anyone",
            render: n => ({content: `n=${n}`}),
            reduce: (action, n) => action === "inc" ? n + 1 : undefined
        });
        expect(await harness.press("inc", {userId: "a-stranger"})).toEqual([]);
        await harness.end();
        expect(await done).toBe(1);
    });

    test("the final render is marked ended so controls can be disabled", async () => {
        const harness = sessionHarness();
        const done = counter(harness);
        await harness.press("inc");
        await harness.end();
        await done;
        expect(harness.shown.at(-1)).toEqual({content: "n=2 ended=true"});
    });
});
