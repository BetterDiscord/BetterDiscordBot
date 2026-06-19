import {ApplicationCommandOptionType, ApplicationCommandType, ApplicationIntegrationType, InteractionContextType, type APIApplicationCommandAttachmentOption, type APIApplicationCommandBasicOption, type APIApplicationCommandBooleanOption, type APIApplicationCommandChannelOption, type APIApplicationCommandIntegerOption, type APIApplicationCommandMentionableOption, type APIApplicationCommandNumberOption, type APIApplicationCommandOption, type APIApplicationCommandRoleOption, type APIApplicationCommandStringOption, type APIApplicationCommandSubcommandGroupOption, type APIApplicationCommandSubcommandOption, type APIApplicationCommandUserOption, type RESTPostAPIChatInputApplicationCommandsJSONBody} from "discord.js";


interface SlashCommandShortcuts {
    guildContext?: boolean;
    botDMContext?: boolean;
    privateContext?: boolean;
    guildInstall?: boolean;
    userInstall?: boolean;
}

export type SlashCommandProps = RESTPostAPIChatInputApplicationCommandsJSONBody & {children?: APIApplicationCommandOption | APIApplicationCommandOption[];} & SlashCommandShortcuts;

export function SlashCommand({children, ...props}: SlashCommandProps): RESTPostAPIChatInputApplicationCommandsJSONBody {
    const data = props;

    // Add options if any children were provided
    if (Array.isArray(children)) data.options = children;
    else if (children) data.options = [children];

    // console.log(children);

    // Use shortcuts to set contexts
    const contexts = [];
    if (props.guildContext) contexts.push(InteractionContextType.Guild);
    if (props.botDMContext) contexts.push(InteractionContextType.BotDM);
    if (props.privateContext) contexts.push(InteractionContextType.PrivateChannel);

    // Use shortcuts to set integration_types
    const integration_types = [];
    if (props.guildInstall) integration_types.push(ApplicationIntegrationType.GuildInstall);
    if (props.userInstall) integration_types.push(ApplicationIntegrationType.UserInstall);

    // Clean up the shortcut properties
    delete data.guildContext;
    delete data.botDMContext;
    delete data.privateContext;
    delete data.guildInstall;
    delete data.userInstall;

    // Apply contexts and integration_types if any were set
    if (contexts.length) data.contexts = contexts;
    if (integration_types.length) data.integration_types = integration_types;

    return {
        type: ApplicationCommandType.ChatInput,
        ...data,
    };
}


export type SubcommandGroupProps = Omit<APIApplicationCommandSubcommandGroupOption, "type"> & {children?: APIApplicationCommandSubcommandOption | APIApplicationCommandSubcommandOption[];};

export function SubcommandGroup({children, ...props}: SubcommandGroupProps): APIApplicationCommandSubcommandGroupOption {
    const data = props;

    // Add options if any children were provided
    if (Array.isArray(children)) data.options = children;
    else if (children) data.options = [children];

    return {
        type: ApplicationCommandOptionType.SubcommandGroup,
        ...data,
    };
}


export type SubcommandProps = Omit<APIApplicationCommandSubcommandOption, "type"> & {children?: APIApplicationCommandBasicOption | APIApplicationCommandBasicOption[];};

export function Subcommand({children, ...props}: SubcommandProps): APIApplicationCommandSubcommandOption {
    const data = props;

    // Add options if any children were provided
    if (Array.isArray(children)) data.options = children;
    else if (children) data.options = [children];

    return {
        type: ApplicationCommandOptionType.Subcommand,
        ...data,
    };
}

/**
 * Still left to implement:
 * APIApplicationCommandAttachmentOption
 * APIApplicationCommandBooleanOption
 * APIApplicationCommandChannelOption
 * APIApplicationCommandIntegerOption
 * APIApplicationCommandMentionableOption
 * APIApplicationCommandNumberOption
 * APIApplicationCommandRoleOption
 * APIApplicationCommandStringOption
 * APIApplicationCommandUserOption
 */


export type AttachmentOptionProps = Omit<APIApplicationCommandAttachmentOption, "type">;
export function AttachmentOption(props: AttachmentOptionProps): APIApplicationCommandAttachmentOption {
    return {
        type: ApplicationCommandOptionType.Attachment,
        ...props,
    };
}

export type BooleanOptionProps = Omit<APIApplicationCommandBooleanOption, "type">;
export function BooleanOption(props: BooleanOptionProps): APIApplicationCommandBooleanOption {
    return {
        type: ApplicationCommandOptionType.Boolean,
        ...props,
    };
}

export type ChannelOptionProps = Omit<APIApplicationCommandChannelOption, "type">;
export function ChannelOption(props: ChannelOptionProps): APIApplicationCommandChannelOption {
    return {
        type: ApplicationCommandOptionType.Channel,
        ...props,
    };
}

export type IntegerOptionProps = Omit<APIApplicationCommandIntegerOption, "type">;
export function IntegerOption(props: IntegerOptionProps): APIApplicationCommandIntegerOption {
    if (props.choices && props.choices.length) {
        return {
            type: ApplicationCommandOptionType.Integer,
            ...props,
            autocomplete: false
        };
    }

    return {
        type: ApplicationCommandOptionType.Integer,
        ...props,
        choices: undefined,
        autocomplete: props.autocomplete
    };
}

export type MentionableOptionProps = Omit<APIApplicationCommandMentionableOption, "type">;
export function MentionableOption(props: MentionableOptionProps): APIApplicationCommandMentionableOption {
    return {
        type: ApplicationCommandOptionType.Mentionable,
        ...props,
    };
}

export type NumberOptionProps = Omit<APIApplicationCommandNumberOption, "type">;
export function NumberOption(props: NumberOptionProps): APIApplicationCommandNumberOption {
    if (props.choices && props.choices.length) {
        return {
            type: ApplicationCommandOptionType.Number,
            ...props,
            autocomplete: false
        };
    }

    return {
        type: ApplicationCommandOptionType.Number,
        ...props,
        choices: undefined,
        autocomplete: props.autocomplete
    };
}

export type RoleOptionProps = Omit<APIApplicationCommandRoleOption, "type">;
export function RoleOption(props: RoleOptionProps): APIApplicationCommandRoleOption {
    return {
        type: ApplicationCommandOptionType.Role,
        ...props,
    };
}

export type StringOptionProps = Omit<APIApplicationCommandStringOption, "type">;
export function StringOption(props: StringOptionProps): APIApplicationCommandStringOption {
    if (props.choices && props.choices.length) {
        return {
            type: ApplicationCommandOptionType.String,
            ...props,
            autocomplete: false
        };
    }

    return {
        type: ApplicationCommandOptionType.String,
        ...props,
        choices: undefined,
        autocomplete: props.autocomplete
    };
}

export type UserOptionProps = Omit<APIApplicationCommandUserOption, "type">;
export function UserOption(props: UserOptionProps): APIApplicationCommandUserOption {
    return {
        type: ApplicationCommandOptionType.User,
        ...props,
    };
}




















export function test() {
    return <SlashCommand name="test" description="A test command">
        <SubcommandGroup name="group1" description="First group of subcommands">
            <Subcommand name="sub1" description="First subcommand in group 1" />
            <Subcommand name="sub2" description="Second subcommand in group 1" />
        </SubcommandGroup>
        <SubcommandGroup name="group2" description="Second group of subcommands">
            <Subcommand name="sub1" description="First subcommand in group 2" />
            <Subcommand name="sub2" description="Second subcommand in group 2">
                <StringOption name="option1" description="An example string option" />
            </Subcommand>
        </SubcommandGroup>
        <Subcommand name="standalone" description="A standalone subcommand" />
    </SlashCommand> as RESTPostAPIChatInputApplicationCommandsJSONBody;
}


export function test2() {
    return <SlashCommand name="permissions" description="Get or edit permissions for a user or a role">
        <SubcommandGroup name="user" description="Get or edit permissions for a user">
            <Subcommand name="get" description="Get permissions for a user" />
            <Subcommand name="edit" description="Edit permissions for a user" />
        </SubcommandGroup>
        <SubcommandGroup name="role" description="Get or edit permissions for a role">
            <Subcommand name="get" description="Get permissions for a role" />
            <Subcommand name="edit" description="Edit permissions for a role" />
        </SubcommandGroup>
    </SlashCommand> as RESTPostAPIChatInputApplicationCommandsJSONBody;
}

export function test3() {
    return <SlashCommand name="permissions" description="Get or edit permissions for a user or a role">
        <SubcommandGroup name="user" description="Get or edit permissions for a user">
            <Subcommand name="get" description="Get permissions for a user">
                <UserOption name="target" description="The user to get" required />
                <ChannelOption name="channel" description="The channel permissions to get. If omitted, the guild permissions will be returned" />
            </Subcommand>
            <Subcommand name="edit" description="Edit permissions for a user" />
        </SubcommandGroup>
        <SubcommandGroup name="role" description="Get or edit permissions for a role">
            <Subcommand name="get" description="Get permissions for a role" />
            <Subcommand name="edit" description="Edit permissions for a role" />
        </SubcommandGroup>
    </SlashCommand> as RESTPostAPIChatInputApplicationCommandsJSONBody;
}


export function debug() {
    return <SlashCommand name="debug" description="This is just a debug command" guildInstall guildContext botDMContext privateContext>
        <Subcommand name="messages" description="Test various message types" />
    </SlashCommand> as RESTPostAPIChatInputApplicationCommandsJSONBody;
}


// const result = debug();

// console.log(JSON.stringify(result, null, 4));