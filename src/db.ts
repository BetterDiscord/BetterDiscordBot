import path from "path";
import {fileURLToPath} from "url";
import Keyv from "keyv";
import Sqlite from "@keyv/sqlite";
import type {BdWebAddon, CommandStats, GuildSettings, Tag} from "./types";


const here = path.dirname(fileURLToPath(import.meta.url));
const sqliteUri = "sqlite://" + path.resolve(here, "..", "settings.sqlite3");

/**
 * The store is built on first use, not at import.
 *
 * Anything that loads a command module for its metadata — the loader, the
 * deploy script, the test suite — pulls this file in transitively. Constructing
 * the store is what opens the connection and writes settings.sqlite3, so doing
 * it eagerly meant merely listing the commands created a database. Worse, it
 * pulled the sqlite3 native addon into the test process, where it
 * intermittently aborted the runner at exit with a NAPI panic (exit code 134)
 * after every test had already passed.
 */
let store: Sqlite | undefined;

/** For tests: whether anything has actually opened the database yet. */
export const isStoreOpen = (): boolean => store !== undefined;

function lazyKeyv<T>(namespace: string): Keyv<T> {
    let instance: Keyv<T> | undefined;

    return new Proxy({} as Keyv<T>, {
        get(_target, property) {
            store ??= new Sqlite(sqliteUri);
            instance ??= new Keyv<T>(store, {namespace});

            const value: unknown = Reflect.get(instance, property);
            if (typeof value === "function") return (value as (...args: unknown[]) => unknown).bind(instance);
            return value;
        }
    });
}


// Pre-configured database instances, all sharing one store once it exists
export const guildDB = lazyKeyv<GuildSettings>("settings");
export const globalDB = lazyKeyv<string | number | boolean | BdWebAddon[]>("global");
export const selfrolesDB = lazyKeyv<string[]>("selfroles");
export const voicetextDB = lazyKeyv<string>("voicetext");
export const statsDB = lazyKeyv<CommandStats>("stats");
export const tagsDB = lazyKeyv<Record<string, Tag>>("tags");
export const userInstallNotices = lazyKeyv<unknown>("userInstallNotices");
