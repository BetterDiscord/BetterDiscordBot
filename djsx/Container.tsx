import {ComponentType, type ContainerComponentData} from "discord.js";
import {childrenToArray} from "./utils";


export type ContainerProps = Omit<ContainerComponentData, "type" | "components"> & {children: ContainerComponentData["components"][0];};

export function Container({children, ...props}: ContainerProps): ContainerComponentData {
    return {
        type: ComponentType.Container,
        components: childrenToArray(children),
        ...props
    } as ContainerComponentData;
}