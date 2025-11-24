import {ComponentType, type LabelModalData, type ModalData} from "discord.js";
import {singleChild} from "./utils";


export type LabelProps = Omit<LabelModalData, "type" | "component"> & {children: LabelModalData["component"];};

export function ModalLabel({children, ...restProps}: LabelProps): LabelModalData {
    return {
        type: ComponentType.Label,
        component: singleChild("ModalLabel", children) as ModalData,
        ...restProps
    };
}