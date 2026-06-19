import {MessageFlags, type ContainerComponentData, type InteractionEditReplyOptions, type InteractionReplyOptions} from "discord.js";
import {Container} from "../Container";
import {TextDisplay} from "../TextDisplay";
import {hexToDecimal} from "../utils";


export type MessageOptions = InteractionReplyOptions & InteractionEditReplyOptions;
export interface BasicMessageProps {
    children: string | string[];
    flags?: number;
    ephemeral?: boolean;
    color?: string | number;
}

export function Basic({children, flags, ephemeral, color}: BasicMessageProps): MessageOptions {
    flags ??= 0;
    if (ephemeral) flags |= MessageFlags.Ephemeral;
    if (typeof color === "string") color = hexToDecimal(color);

    return {
        flags: MessageFlags.IsComponentsV2 | flags,
        components: [
            <Container accentColor={color}>
                <TextDisplay>{children}</TextDisplay>
            </Container> as ContainerComponentData]
    };
}


export function Success(props: BasicMessageProps): MessageOptions {
    return <Basic color="#3ac172" {...props} children={[`:white_check_mark:   `, props.children].flat()} /> as MessageOptions;
}

export function Info(props: BasicMessageProps): MessageOptions {
    return <Basic color="#5a88ce" {...props} children={[`:information_source:   `, props.children].flat()} /> as MessageOptions;
}

export function Warn(props: BasicMessageProps): MessageOptions {
    return <Basic color="#fbbf24" {...props} children={[`:warning:   `, props.children].flat()} /> as MessageOptions;
}

export function Error(props: BasicMessageProps): MessageOptions {
    return <Basic color="#c13a3a" {...props} children={[`:no_entry:   `, props.children].flat()} /> as MessageOptions;
}

export function Danger(props: BasicMessageProps): MessageOptions {
    return <Basic color="#c13a3a" {...props} children={[`:no_entry:   `, props.children].flat()} /> as MessageOptions;
}