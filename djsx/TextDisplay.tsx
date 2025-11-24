

import {ComponentType, type TextDisplayComponentData} from "discord.js";
import {childrenToString} from "./utils";


export type TextDisplayProps = Omit<TextDisplayComponentData, "type" | "content"> & {children: string | string[];};

export function TextDisplay({children, id}: TextDisplayProps): TextDisplayComponentData {
    const content = childrenToString("TextDisplay", children)!;
    if (!content) {
        throw new Error("TextDisplay requires at least one child");
    }

    return {
        type: ComponentType.TextDisplay,
        content,
        id,
    };
}