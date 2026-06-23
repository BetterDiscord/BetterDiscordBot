import path from "path";
import {fileURLToPath} from "url";
import Keyv from "keyv";
import Sqlite from "@keyv/sqlite";
import type {AutoResponderEntry, BdWebAddon, CommandStats, GuildSettings, ReactionRole, Tag, Warning} from "./types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Single SQLite connection string
const sqliteUri = "sqlite://" + path.resolve(__dirname, "..", "settings.sqlite3");

// Create one Sqlite store instance
const sqliteStore = new Sqlite(sqliteUri);

// Export pre-configured database instances sharing the same store
export const guildDB = new Keyv<GuildSettings>(sqliteStore, {namespace: "settings"});
export const globalDB = new Keyv<string | number | boolean | BdWebAddon[]>(sqliteStore, {namespace: "global"});
export const selfrolesDB = new Keyv<string[]>(sqliteStore, {namespace: "selfroles"});
export const voicetextDB = new Keyv<string>(sqliteStore, {namespace: "voicetext"});
export const statsDB = new Keyv<CommandStats>(sqliteStore, {namespace: "stats"});
export const tagsDB = new Keyv<Record<string, Tag>>(sqliteStore, {namespace: "tags"});
export const userInstallNotices = new Keyv(sqliteStore, {namespace: "userInstallNotices"});
export const reactionrolesDB = new Keyv<ReactionRole[]>(sqliteStore, {namespace: "reactionroles"});
export const autoresponderDB = new Keyv<AutoResponderEntry[]>(sqliteStore, {namespace: "autoresponder"});
export const warningsDB = new Keyv<Warning[]>(sqliteStore, {namespace: "warnings"});