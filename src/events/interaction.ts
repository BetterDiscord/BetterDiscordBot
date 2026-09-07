import {Events} from "discord.js";
import {defineEvent} from "../framework";


/**
 * Routing lives in the dispatcher (`src/framework/dispatch.ts`), which is built
 * once at startup so it can validate every command and component up front.
 */
export default defineEvent({
    name: Events.InteractionCreate,

    async execute(interaction) {
        await interaction.client.dispatcher.dispatch(interaction);
    }
});
