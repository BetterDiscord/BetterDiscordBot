import {describe, expect, test} from "bun:test";
import {hasDisallowedChars} from "../src/util/names";


describe("hasDisallowedChars", () => {
    test("gives the same answer on repeated calls", () => {
        // A shared /g regex alternated true/false here, so /cleanname server skipped members.
        const names = ["ŁukasZ", "✨star✨", "ñame", "zoë"];
        for (const name of names) {
            expect(hasDisallowedChars(name)).toBe(true);
            expect(hasDisallowedChars(name)).toBe(true);
        }
    });

    test("allows names within the username standards", () => {
        expect(hasDisallowedChars("zerebos")).toBe(false);
        expect(hasDisallowedChars("Some_User-1.2 3")).toBe(false);
    });
});
