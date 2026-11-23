import {afterAll, beforeEach, describe, expect, mock, spyOn, test} from "bun:test";
import * as undici from "undici";
import type {BdWebAddon} from "../src/types";


const store = new Map<string, unknown>();
const globalDB = {
    get: (key: string) => Promise.resolve(store.get(key)),
    set: (key: string, value: unknown) => Promise.resolve(!!store.set(key, value)),
};
void mock.module("../src/db", () => ({globalDB}));

let failRequests = false;
const requestMock = spyOn(undici, "request").mockImplementation(((url: string) => {
    if (failRequests) return Promise.reject(new Error("network down"));
    const addon = {id: url.length, name: url} as unknown as BdWebAddon;
    return Promise.resolve({statusCode: 200, body: {json: () => Promise.resolve([addon]), dump: () => Promise.resolve()}});
}) as unknown as typeof undici.request);

const {cache, ensureCache} = await import("../src/util/addons");

afterAll(() => {
    requestMock.mockRestore();
});


describe("ensureCache", () => {
    beforeEach(() => {
        store.clear();
        cache.clear();
        failRequests = false;
        requestMock.mockClear();
    });

    test("a failed refresh keeps the old cache and retries next time", async () => {
        const old = [{id: 1, name: "old"}] as unknown as BdWebAddon[];
        store.set("addonCache", old);
        store.set("addonCacheLastUpdate", 0);

        failRequests = true;
        await ensureCache();
        expect(cache.size).toBe(1);
        expect(store.get("addonCache")).toEqual(old);
        expect(store.get("addonCacheLastUpdate")).toBe(0);

        failRequests = false;
        await ensureCache();
        expect(cache.size).toBe(2);
        expect(store.get("addonCacheLastUpdate")).toBeGreaterThan(0);
    });

    test("concurrent callers share one refresh", async () => {
        await Promise.all([ensureCache(), ensureCache(), ensureCache()]);
        expect(requestMock).toHaveBeenCalledTimes(2);
        expect(cache.size).toBe(2);
    });
});
