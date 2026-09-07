import {describe, expect, test} from "bun:test";
import {paginate} from "../src/paginator";
import {sessionHarness} from "./helpers/session";


const IS_COMPONENTS_V2 = 1 << 15;

interface Rendered {
    flags?: unknown;
    components?: Array<{content?: string; components?: Array<{label: string; disabled?: boolean}>}>;
}

function paginated(count: number, perPage = 10) {
    const harness = sessionHarness();
    const items = Array.from({length: count}, (_, index) => index + 1);
    const done = paginate({
        interaction: harness.interaction,
        items,
        perPage,
        renderPage: (page, number, total) => [{type: 10, content: `[${page.join(",")}] ${number}/${total}`}]
    });

    const latest = () => harness.shown.at(-1) as Rendered;
    return {
        harness,
        done,
        label: () => String(latest().components?.[0]?.content),
        buttons: () => latest().components?.[1]?.components ?? [],
        flags: () => Number(latest().flags ?? 0)
    };
}


describe("paginate", () => {
    test("starts on page one and disables the backward controls", async () => {
        const p = paginated(23);
        await p.harness.press("noop");
        expect(p.label()).toBe("[1,2,3,4,5,6,7,8,9,10] 1/3");
        expect(p.buttons()[0]?.disabled).toBe(true);
        expect(p.buttons()[1]?.disabled).toBe(true);
        await p.harness.end();
        await p.done;
    });

    test("walks forwards and backwards, and clamps at both ends", async () => {
        const p = paginated(23);
        await p.harness.press("next");
        expect(p.label()).toBe("[11,12,13,14,15,16,17,18,19,20] 2/3");
        await p.harness.press("next");
        expect(p.label()).toBe("[21,22,23] 3/3");
        await p.harness.press("next");
        expect(p.label()).toBe("[21,22,23] 3/3");
        await p.harness.press("first");
        expect(p.label()).toBe("[1,2,3,4,5,6,7,8,9,10] 1/3");
        await p.harness.press("previous");
        expect(p.label()).toBe("[1,2,3,4,5,6,7,8,9,10] 1/3");
        await p.harness.press("last");
        expect(p.label()).toBe("[21,22,23] 3/3");
        await p.harness.end();
        await p.done;
    });

    test("the page counter tracks the current page", async () => {
        const p = paginated(23);
        await p.harness.press("last");
        expect(p.buttons()[2]?.label).toBe("Page 3 of 3");
        await p.harness.end();
        await p.done;
    });

    test("an empty list is one page, not zero", async () => {
        const p = paginated(0);
        await p.harness.press("noop");
        expect(p.buttons()[2]?.label).toBe("Page 1 of 1");
        expect(p.buttons().every(button => button.disabled)).toBe(true);
        await p.harness.end();
        await p.done;
    });

    /** The previous implementation dropped this flag on the final edit. */
    test("every render carries IsComponentsV2, including the last", async () => {
        const p = paginated(23);
        await p.harness.press("next");
        await p.harness.end();
        await p.done;
        expect(p.harness.shown.every(shown => Number((shown as Rendered).flags) === IS_COMPONENTS_V2)).toBe(true);
    });

    test("all controls are disabled once the collector ends", async () => {
        const p = paginated(23);
        await p.harness.press("next");
        await p.harness.end();
        await p.done;
        expect(p.buttons().every(button => button.disabled)).toBe(true);
    });
});
