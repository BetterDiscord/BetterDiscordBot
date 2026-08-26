import {describe, expect, test} from "bun:test";
import {Bool, Id, IdError, MAX_CUSTOM_ID, Num, Str, decodeId, encodeId, namespaceOf, oneOf} from "../src/framework/ids";


describe("custom id codec", () => {
    const spec = {a: Str, b: Str, c: Num, d: Bool};

    test.each([
        ["separator in a value", {a: "a:b", b: "plain", c: 1, d: true}],
        ["percent and separator", {a: "100%:sure", b: "%3A", c: -2.5, d: false}],
        ["empty and repeated separators", {a: "", b: "::::", c: 0, d: true}],
        ["non-ascii", {a: "emoji 🎭 ok", b: "a%b:c", c: 42, d: false}]
    ])("round-trips %s", (_label, params) => {
        expect(decodeId(spec, encodeId("ns", spec, params))).toEqual(params);
    });

    test("namespace is the prefix and survives escaping", () => {
        expect(namespaceOf(encodeId("some.thing", spec, {a: "x:y", b: "", c: 1, d: false}))).toBe("some.thing");
    });

    test("a spec with no params encodes to just the namespace", () => {
        expect(encodeId("bare", {}, {})).toBe("bare");
        expect(decodeId({}, "bare")).toEqual({});
    });
});


describe("codec validation", () => {
    test("rejects an id over Discord's 100-character limit", () => {
        expect(() => encodeId("ns", {a: Str}, {a: "y".repeat(MAX_CUSTOM_ID)})).toThrow(IdError);
    });

    test("accepts an id exactly at the limit", () => {
        const id = encodeId("ns", {a: Str}, {a: "y".repeat(MAX_CUSTOM_ID - "ns:".length)});
        expect(id).toHaveLength(MAX_CUSTOM_ID);
    });

    test("rejects a malformed snowflake in both directions", () => {
        expect(() => Id.format("nope")).toThrow(IdError);
        expect(() => Id.parse("12")).toThrow(IdError);
        expect(Id.parse("123456789012345678")).toBe("123456789012345678");
    });

    test("rejects a non-numeric value for a number param", () => {
        expect(() => decodeId({n: Num}, "ns:banana")).toThrow(IdError);
    });

    test("rejects the wrong number of params, which is what a stale id looks like", () => {
        const spec = {a: Str, b: Str};
        expect(() => decodeId(spec, "ns:only-one")).toThrow(IdError);
        expect(() => decodeId(spec, "ns:a:b:c")).toThrow(IdError);
    });

    test("oneOf rejects a value outside the set", () => {
        const mode = oneOf("user", "admin");
        expect(mode.parse("admin")).toBe("admin");
        expect(() => mode.parse("root")).toThrow(IdError);
    });
});
