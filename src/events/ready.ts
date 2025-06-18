import {Events, type Client} from "discord.js";


export default {
    name: Events.ClientReady,
    once: true,
    async execute(client: Client<true>) {
        console.log(`Ready! Logged in as ${client.user.tag}`);
        client.cpuUsage = process.cpuUsage();
    },
};