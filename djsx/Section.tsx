import {childrenToArray} from "./utils";
import {ComponentType, type SectionComponentData} from "discord.js";


export type SectionProps = Omit<SectionComponentData, "type" | "components"> & {children: SectionComponentData["components"][0];};

export function Section({children, ...props}: SectionProps): SectionComponentData {
    return {
        type: ComponentType.Section,
        components: childrenToArray(children),
        ...props
    };
}