import {ApplicationCommandOptionType, ApplicationCommandType, ChatInputCommandInteraction, ComponentType, InteractionContextType, MessageFlags, PermissionFlagsBits, SelectMenuDefaultValueType} from "discord.js";
import {container, defineCommand, defineComponent, row, text, type ComponentMessage} from "../framework";
import {humanReadableUptime} from "../util/time";
import {Accents} from "../util/colors";
import * as notices from "../util/notices";
import {guildDB} from "../db";
import {hasDisallowedChars} from "../util/names";


interface CleanProgress {
    members: number;
    fixed: number;
    failed: number;
    blurb: string;
    stamp: {label: string; at: number;};
    done: boolean;
}

/**
 * Replaces the progress embed. Components V2 has no inline field grid, so the
 * three counters render as one line, and the embed timestamp becomes Discord's
 * own <t:...> markup so it still localises per viewer.
 */
function progress(state: CleanProgress): ComponentMessage {
    return {
        flags: MessageFlags.IsComponentsV2,
        components: [container([
            text("## Fixing Display Names"),
            text(state.blurb),
            text(`**Members** ${state.members.toLocaleString()}\u2003**Fixed** ${state.fixed.toLocaleString()}\u2003**Failed** ${state.failed.toLocaleString()}`),
            text(`-# ${state.stamp.label} <t:${Math.floor(state.stamp.at / 1000)}:f>`)
        ], {accentColor: state.done ? Accents.Success : Accents.Info})]
    };
}


async function server(interaction: ChatInputCommandInteraction<"cached">) {
    const controls = row({
        type: ComponentType.RoleSelect,
        customId: chooseBypassRoles.customId({}),
        minValues: 0,
        maxValues: 25,
        defaultValues: [{id: interaction.guild.roles.highest.id, type: SelectMenuDefaultValueType.Role}]
    });
    await interaction.reply(notices.info("Please select which roles should bypass this cleaning.", {components: [controls]}));
}




async function user(interaction: ChatInputCommandInteraction<"cached">) {
    const targetUser = interaction.options.getUser("user", true);
    const member = interaction.guild.members.cache.get(targetUser.id);
    if (!member) return await interaction.reply(notices.error("This user is not in the server.", {ephemeral: true}));
    const isClean = !hasDisallowedChars(member.displayName);
    if (isClean) return await interaction.reply(notices.info("This member's display name already conforms to the username standards."));
    try {
        await member.setNickname(member.user.username);
        await interaction.reply(notices.success("Successfully cleaned this member's display name."));
    }
    catch {
        await interaction.reply(notices.error("Could not clean this member's display name. Double check that I have permission to do so."));
    }
}


async function join(interaction: ChatInputCommandInteraction<"cached">) {
    const toEnable = !!interaction.options.getBoolean("enabled");
    const guildSettings = await guildDB.get(interaction.guild.id) ?? {};
    const current = guildSettings.cleanOnJoin;
    if (current === toEnable) return await interaction.reply(notices.info(`This setting was already ${current ? "enabled" : "disabled"}.`));
    guildSettings.cleanOnJoin = toEnable;
    await guildDB.set(interaction.guild.id, guildSettings);
    await interaction.reply(notices.success(`This setting is now ${toEnable ? "enabled" : "disabled"}.`));
}


/** The bypass-role picker shown by `/cleanname server`. */
const chooseBypassRoles = defineComponent({
    id: "cleanname.bypass",
    kind: "roleSelect",
    guildOnly: true,
    params: {},

    async run(interaction) {
        const roleIds = [...interaction.roles.keys()];

        const start = Date.now();

        await interaction.update(progress({
            members: interaction.guild.memberCount,
            fixed: 0,
            failed: 0,
            blurb: `This will take approximately ${humanReadableUptime(interaction.guild.memberCount * 10)}. Please be patient.`,
            stamp: {label: "Started", at: start},
            done: false
        }));

        let changed = 0;
        let failed = 0;
        await interaction.guild.members.fetch();
        const members = interaction.guild.members.cache;
        for (const [, member] of members) {
            // If their name is fine continue
            if (!hasDisallowedChars(member.displayName)) continue;

            // If they have a role that was selected as a bypass role, continue
            if (member.roles.cache.hasAny(...roleIds)) continue;

            try {
                await member.setNickname(member.user.username);
                changed++;
            }
            catch {
                // TODO: keep a log
                failed++;
            }
        }

        const finish = Date.now();

        // editReply, not update: the interaction was already acknowledged above,
        // so a second update() throws InteractionAlreadyReplied and the final
        // counts never reached the user.
        await interaction.editReply(progress({
            members: members.size,
            fixed: changed,
            failed,
            blurb: `Operation took ${humanReadableUptime(finish - start)}. Thank you for waiting.`,
            stamp: {label: "Completed", at: finish},
            done: true
        }));
    }
});


export const command = defineCommand({
    guildOnly: true,
    data: {
        type: ApplicationCommandType.ChatInput,
        name: "cleanname",
        description: "Cleans member display names to match Discord's username standards.",
        default_member_permissions: PermissionFlagsBits.ManageGuild.toString(),
        contexts: [InteractionContextType.Guild],
        options: [
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "join",
                description: "Toggles automatically cleaning new members when they join.",
                options: [{
                    type: ApplicationCommandOptionType.Boolean,
                    name: "enabled",
                    description: "Whether members should have their display name cleaned upon joining.",
                    required: true
                }]
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "user",
                description: "Fixes a display name for a single user.",
                options: [{
                    type: ApplicationCommandOptionType.User,
                    name: "user",
                    description: "Whose display name should be cleaned?",
                    required: true
                }]
            },
            {
                type: ApplicationCommandOptionType.Subcommand,
                name: "server",
                description: "Fixes all display names in the server."
            }
        ]
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        if (subcommand === "server") return await server(interaction);
        if (subcommand === "user") return await user(interaction);
        if (subcommand === "join") return await join(interaction);
    }
});

export const components = [chooseBypassRoles];
