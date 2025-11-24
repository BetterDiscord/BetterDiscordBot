import {ComponentType, type ActionRowComponentData, type ActionRowData} from "discord.js";
import {childrenToArray} from "./utils";


export type ActionRowProps = Omit<ActionRowData<ActionRowComponentData>, "type" | "components"> & {children: ActionRowComponentData | ActionRowComponentData[];};

export function ActionRow({children, ...props}: ActionRowProps): ActionRowData<ActionRowComponentData> {
    return {
        type: ComponentType.ActionRow,
        components: childrenToArray(children),
        ...props
    };
}