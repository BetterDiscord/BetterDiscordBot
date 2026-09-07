import {Events} from "discord.js";
import {defineEvents} from "../../../src/framework";

/**
 * The shape src/events/joinleave.ts uses. The pre-framework loader read `.name`
 * off the array, registered `client.on(undefined, ...)`, and the listeners
 * never fired.
 */
export default defineEvents(
    {name: Events.GuildMemberAdd, execute: () => Promise.resolve()},
    {name: Events.GuildMemberRemove, execute: () => Promise.resolve()}
);
