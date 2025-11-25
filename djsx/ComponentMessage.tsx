import {MessageFlags, type BaseMessageOptions, type InteractionEditReplyOptions, type InteractionReplyOptions} from "discord.js";
import {childrenToArray} from "./utils";


export type MessageOptions = InteractionReplyOptions & InteractionEditReplyOptions;
export type ComponentMessageProps = Omit<MessageOptions, "components" | "flags"> & {children: Required<BaseMessageOptions>["components"]; flags?: number;};

export function ComponentMessage({children, flags, ...props}: ComponentMessageProps): MessageOptions {
    return {
        flags: MessageFlags.IsComponentsV2 | (flags ?? 0),
        components: childrenToArray(children),
        ...props
    };
}