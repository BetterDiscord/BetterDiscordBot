import {ComponentType, type LabelComponentData} from "discord.js";
import {singleChild} from "./utils";


export type LabelProps = Omit<LabelComponentData, "type" | "component"> & {children: LabelComponentData["component"];};

export function ModalLabel({children, ...restProps}: LabelProps): LabelComponentData {
    console.log("ModalLabel called with children:", children);
    return {
        type: ComponentType.Label,
        component: singleChild("ModalLabel", children) as LabelComponentData["component"],
        ...restProps
    };
}