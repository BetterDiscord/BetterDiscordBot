import {ComponentType, type ButtonComponentData, type InteractionButtonComponentData, type LinkButtonComponentData} from "discord.js";
import {childrenToString} from "./utils";


export {ButtonStyle} from "discord.js";

type Button = Omit<InteractionButtonComponentData, "type" | "label"> | Omit<LinkButtonComponentData, "type" | "label">;
export type ButtonProps = Button & {children: string;};

export function Button({children, ...props}: ButtonProps): ButtonComponentData {
    return {
        type: ComponentType.Button,
        label: childrenToString("Button", children) ?? undefined,
        ...props
    };
}