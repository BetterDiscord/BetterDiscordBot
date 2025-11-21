import {Events, type Client} from "discord.js";


export default {
    name: Events.ClientReady,
    once: true,
    // eslint-disable-next-line @typescript-eslint/require-await
    async execute(client: Client<true>) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        client.cpuUsage = process.cpuUsage();
    },
};