import {Events} from "discord.js";
import {defineEvent} from "../../../src/framework";

export default defineEvent({
    name: Events.MessageCreate,
    execute: () => Promise.resolve()
});
