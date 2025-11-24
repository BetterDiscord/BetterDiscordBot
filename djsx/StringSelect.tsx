

import {ComponentType, type SelectMenuComponentOptionData, type StringSelectMenuComponentData} from "discord.js";
import {childrenToArray} from "./utils";


export type StringSelectProps = Omit<StringSelectMenuComponentData, "type" | "options"> & {children: StringSelectMenuComponentData["options"];};
export function StringSelect({children, ...props}: StringSelectProps): StringSelectMenuComponentData {
    return {
        type: ComponentType.StringSelect,
        options: childrenToArray(children),
        ...props
    };
}

export function StringOption(props: SelectMenuComponentOptionData): SelectMenuComponentOptionData {
    return props;
}