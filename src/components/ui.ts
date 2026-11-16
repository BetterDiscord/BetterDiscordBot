import {ComponentType, MessageFlags, resolveColor, type ActionRowData, type ButtonComponentData, type ComponentInContainerData, type ContainerComponentData, type InteractionButtonComponentData, type InteractionEditReplyOptions, type InteractionReplyOptions, type LabelComponentData, type LinkButtonComponentData, type MessageActionRowComponentData, type ModalComponentData, type RoleSelectMenuComponentData, type SectionComponentData, type StringSelectMenuComponentData, type TextDisplayComponentData, type TextInputComponentData, type ThumbnailComponentData} from "discord.js";
import Colors from "../util/colors";


type Falsy = false | null | undefined | "" | 0;

/**
 * The children of a component. Falsy values are dropped and nested arrays are flattened, so a child can be
 * written as `condition && Component(...)` or as a list built elsewhere.
 */
export type Children<T> = Array<T | Falsy | Children<T>>;

function flatten<T>(children: Children<T>): T[] {
    return (children.flat(Infinity as 1) as Array<T | Falsy>).filter(Boolean) as T[];
}

/** A message that can be passed to `reply`, `editReply`, `followUp` or `update`. */
export type MessageOptions = InteractionReplyOptions & InteractionEditReplyOptions;


export function TextDisplay(content: string): TextDisplayComponentData {
    return {type: ComponentType.TextDisplay, content};
}

export function Thumbnail(url: string, props: Omit<ThumbnailComponentData, "type" | "media"> = {}): ThumbnailComponentData {
    return {type: ComponentType.Thumbnail, media: {url}, ...props};
}

export function Button(props: Omit<InteractionButtonComponentData, "type"> | Omit<LinkButtonComponentData, "type">): ButtonComponentData {
    return {type: ComponentType.Button, ...props};
}

export function StringSelect(props: Omit<StringSelectMenuComponentData, "type">): StringSelectMenuComponentData {
    return {type: ComponentType.StringSelect, ...props};
}

export function RoleSelect(props: Omit<RoleSelectMenuComponentData, "type">): RoleSelectMenuComponentData {
    return {type: ComponentType.RoleSelect, ...props};
}

/** A text input for a modal. Its label comes from the `Label` that wraps it. */
export function TextInput(props: Omit<TextInputComponentData, "type" | "label">): TextInputComponentData {
    return {type: ComponentType.TextInput, ...props} as TextInputComponentData;
}

export function ActionRow<T extends MessageActionRowComponentData>(...children: Children<T>): ActionRowData<T> {
    return {type: ComponentType.ActionRow, components: flatten(children)};
}

// TODO: decide whether required fields stay positional (`Section(accessory, ...)`, `Label(label, input)`,
// `Thumbnail(url)`) or whether every helper takes one props object first, the way `Button` and `TextInput` do.
export function Section(accessory: SectionComponentData["accessory"], ...children: Children<TextDisplayComponentData>): SectionComponentData {
    return {type: ComponentType.Section, accessory, components: flatten(children)};
}

type ContainerProps = Omit<ContainerComponentData, "type" | "components"> & {type?: never;};
type ContainerChild = ComponentInContainerData;

// TODO: decide whether the props object stays optional for `Container` and `Message`. They tell props from a
// child by checking for a `type` field, because component data always has one and props never do. The
// alternative is a required first argument, which is simpler but means writing `Container({}, ...)`.
export function Container(...children: Children<ContainerChild>): ContainerComponentData<ContainerChild>;
export function Container(props: ContainerProps, ...children: Children<ContainerChild>): ContainerComponentData<ContainerChild>;
export function Container(first?: ContainerProps | Children<ContainerChild>[number], ...rest: Children<ContainerChild>): ContainerComponentData<ContainerChild> {
    const hasProps = !!first && !Array.isArray(first) && !("type" in first);
    const props = hasProps ? first : {};
    const children = hasProps ? rest : [first as Children<ContainerChild>[number], ...rest];
    return {type: ComponentType.Container, components: flatten(children), ...props};
}

/** Wraps one modal input and gives it the label shown above it. */
export function Label(label: string, component: LabelComponentData["component"], props: {description?: string;} = {}): LabelComponentData {
    return {type: ComponentType.Label, label, component, ...props};
}

export function Modal(props: Omit<ModalComponentData, "components">, ...children: Children<ModalComponentData["components"][number]>): ModalComponentData {
    return {...props, components: flatten(children)};
}

type MessageChild = ContainerComponentData | ComponentInContainerData;
type MessageProps = Omit<MessageOptions, "components" | "flags"> & {ephemeral?: boolean; type?: never;};

/** A message made of components. It sets the flag that Discord requires for containers and text displays. */
export function Message(...children: Children<MessageChild>): MessageOptions;
export function Message(props: MessageProps, ...children: Children<MessageChild>): MessageOptions;
export function Message(first?: MessageProps | Children<MessageChild>[number], ...rest: Children<MessageChild>): MessageOptions {
    const hasProps = !!first && !Array.isArray(first) && !("type" in first);
    const {ephemeral, ...props} = hasProps ? first : {};
    const children = hasProps ? rest : [first as Children<MessageChild>[number], ...rest];
    return {
        flags: MessageFlags.IsComponentsV2 | (ephemeral ? MessageFlags.Ephemeral : 0),
        components: flatten(children),
        ...props,
    };
}


/** Builds a one-line message in a colored container, with an emoji in front of the text. */
function notice(color: number, emoji: string) {
    return (text: string, props: {ephemeral?: boolean;} = {}): MessageOptions =>
        Message(props, Container({accentColor: color}, TextDisplay(`${emoji}   ${text}`)));
}

export const Success = notice(resolveColor(Colors.Success), ":white_check_mark:");
export const Info = notice(resolveColor(Colors.Info), ":information_source:");
export const Warn = notice(resolveColor(Colors.Warn), ":warning:");
export const Error = notice(resolveColor(Colors.Error), ":no_entry:");
