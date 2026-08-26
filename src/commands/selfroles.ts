import {
    ApplicationCommandType, ButtonStyle, ComponentType, EmbedBuilder, InteractionContextType,
    MessageFlags, PermissionFlagsBits, SelectMenuDefaultValueType,
    type InteractionReplyOptions, type InteractionUpdateOptions, type MessageActionRowComponentData
} from "discord.js";
import {defineCommand, defineComponent, oneOf, row} from "../framework";
import {selfrolesDB} from "../db";
import Messages from "../util/messages";
import Colors from "../util/colors";


const RETURN_TO_PANEL_DELAY = 3000;
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


/** The listing plus its controls. Shared by the command and every component. */
function panel(roleIds: string[], canManage: boolean): InteractionReplyOptions & InteractionUpdateOptions {
    const listing = new EmbedBuilder().setColor(Colors.Info).setTitle("Available Roles")
        .setDescription(roleIds.length ? roleIds.map(id => `- <@&${id}>`).join("\n") : "No roles have been configured by the admins.");

    const controls: MessageActionRowComponentData[] = [
        {type: ComponentType.Button, customId: openPicker.customId({mode: "user"}), label: "Manage Your Roles", style: ButtonStyle.Success}
    ];
    if (canManage) {
        controls.push({type: ComponentType.Button, customId: openPicker.customId({mode: "admin"}), label: "Set Assignable Roles", style: ButtonStyle.Primary});
    }

    return {embeds: [listing], components: [row(...controls)]};
}


/**
 * One definition for both buttons. `mode` is a typed param, so the switch below
 * is exhaustive by construction and `customId({mode: "usr"})` will not compile.
 * This replaces the old `customId.split("-")[1]` dispatch inside `button()`.
 */
const openPicker = defineComponent({
    id: "selfroles.open",
    kind: "button",
    guildOnly: true,
    params: {mode: oneOf("user", "admin")},

    async run(interaction, {mode}) {
        const assignable = await selfrolesDB.get(interaction.guild.id) ?? [];

        if (mode === "admin") {
            if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)) {
                return await interaction.reply(Messages.error("You need the `Manage Roles` permission to do that.", {ephemeral: true}));
            }

            return await interaction.update(Messages.info("Please select which roles should be self-assignable.", {
                components: [row({
                    type: ComponentType.RoleSelect,
                    customId: setAssignable.customId({}),
                    minValues: 0,
                    maxValues: 25,
                    defaultValues: assignable.map(id => ({id, type: SelectMenuDefaultValueType.Role}))
                })]
            }));
        }

        // The previous version called setMaxValues(0) here, which Discord rejects,
        // so the first press on a server with no configured roles always failed.
        if (!assignable.length) {
            return await interaction.reply(Messages.info("No self-assignable roles have been set up yet.", {ephemeral: true}));
        }

        return await interaction.update(Messages.info("Please select which roles you want.", {
            components: [row({
                type: ComponentType.StringSelect,
                customId: chooseRoles.customId({}),
                minValues: 0,
                maxValues: assignable.length,
                options: assignable.map(id => ({
                    "label": interaction.guild.roles.cache.get(id)?.name ?? id,
                    "value": id,
                    "default": interaction.member.roles.cache.has(id)
                }))
            })]
        }));
    }
});


const chooseRoles = defineComponent({
    id: "selfroles.choose",
    kind: "stringSelect",
    guildOnly: true,
    params: {},

    async run(interaction) {
        const assignable = await selfrolesDB.get(interaction.guild.id) ?? [];

        try {
            const toRemove = assignable.filter(id => !interaction.values.includes(id));
            if (toRemove.length) await interaction.member.roles.remove(toRemove, "Self-roles");
            if (interaction.values.length) await interaction.member.roles.add(interaction.values, "Self-roles");
            await interaction.update(Messages.success("Successfully assigned your roles!", {components: []}));
        }
        catch {
            await interaction.update(Messages.error("Could not assign your roles. It may be a permission issue.", {components: []}));
        }

        await wait(RETURN_TO_PANEL_DELAY);
        await interaction.editReply(panel(assignable, interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles)));
    }
});


const setAssignable = defineComponent({
    id: "selfroles.set",
    kind: "roleSelect",
    guildOnly: true,
    params: {},

    async run(interaction) {
        const roleIds = [...interaction.roles.keys()];
        await selfrolesDB.set(interaction.guild.id, roleIds);
        await interaction.update(Messages.success("Self-assignable roles set successfully.", {components: []}));

        await wait(RETURN_TO_PANEL_DELAY);
        await interaction.editReply(panel(roleIds, true));
    }
});


export const command = defineCommand({
    guildOnly: true,
    data: {
        type: ApplicationCommandType.ChatInput,
        name: "selfroles",
        description: "Allows users to self-assign roles.",
        contexts: [InteractionContextType.Guild]
    },

    async execute(interaction) {
        const assignable = await selfrolesDB.get(interaction.guild.id) ?? [];
        const canManage = interaction.memberPermissions.has(PermissionFlagsBits.ManageRoles);
        return await interaction.reply({...panel(assignable, canManage), flags: MessageFlags.Ephemeral});
    }
});

export const components = [openPicker, chooseRoles, setAssignable];
