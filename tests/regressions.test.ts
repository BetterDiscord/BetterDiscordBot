import {describe, expect, test} from "bun:test";
import {hasDisallowedChars} from "../src/util/names";
import config from "../src/config";
import * as notices from "../src/util/notices";


/**
 * One test per bug fixed during the refactor, so none of them can come back
 * quietly. Each names the failure it guards against.
 */

describe("display-name checks are stateless (was: /cleanname server skipped members)", () => {
    const dirty = ["𝓑𝓪𝓭𝓝𝓪𝓶𝓮", "AlsoBad☆", "Bad♥Three", "Bad♦Four", "Ω", "naïve", "🎭🎭🎭"];
    const clean = ["Zerebos", "some_user", "a-b.c", "plain name", "123", "A_B-C.D"];

    // The regex was module-level with a /g flag. RegExp.test advances lastIndex
    // on a global regex, so consecutive calls returned alternating answers.
    test("every disallowed name is caught, on every pass", () => {
        for (let pass = 0; pass < 3; pass++) {
            for (const name of dirty) expect(hasDisallowedChars(name)).toBe(true);
        }
    });

    test("every allowed name passes, on every pass", () => {
        for (let pass = 0; pass < 3; pass++) {
            for (const name of clean) expect(hasDisallowedChars(name)).toBe(false);
        }
    });

    test("the same input gives the same answer twenty times running", () => {
        const answers = new Set(Array.from({length: 20}, () => hasDisallowedChars("Bad♥Three")));
        expect([...answers]).toEqual([true]);
    });
});


describe("config (was: snowflakes inline in six files)", () => {
    test("every id is a plausible snowflake", () => {
        const ids = [
            config.guilds.betterDiscord,
            config.roles.pluginDeveloper,
            config.roles.themeDeveloper,
            config.roles.communityPluginDeveloper,
            config.roles.communityThemeDeveloper,
            config.channels.accountIssues,
            config.automod.spamLinkRule
        ];
        for (const id of ids) expect(id).toMatch(/^\d{15,25}$/);
    });

    test("ids are distinct, so none of them is a copy-paste slip", () => {
        const roles = Object.values(config.roles);
        expect(new Set(roles).size).toBe(roles.length);
    });
});


describe("notices satisfy every send path (was: casts at each call site)", () => {
    // The djsx widgets were typed as an intersection that satisfied neither
    // reply nor editReply, so every call site needed `as MessageOptions`.
    test("a notice is a plain object with numeric flags and container components", () => {
        const notice = notices.success("done", {ephemeral: true});
        expect(typeof notice.flags).toBe("number");
        expect(Array.isArray(notice.components)).toBe(true);
        expect(notice.components).toHaveLength(1);
    });

    test("interpolation happens in the template, not in markup", () => {
        // The JSX version emitted a literal "$" here: `${...}` inside JSX text
        // is not interpolated.
        const isUpdating = true;
        const notice = notices.success(`Tag \`hello\` has been ${isUpdating ? "updated" : "created"} successfully!`);
        const content = String((notice.components[0] as unknown as {components: Array<{content: string}>}).components[0].content);
        expect(content).toContain("has been updated successfully!");
        expect(content).not.toContain("$");
    });
});
