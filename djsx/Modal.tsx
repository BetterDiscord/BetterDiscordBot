import {type ModalComponentData} from "discord.js";
import {childrenToArray} from "./utils";


export type ModalProps = Omit<ModalComponentData, "type" | "components"> & {children: ModalComponentData["components"];};

export function Modal({children, ...props}: ModalProps): ModalComponentData {
    return {
        components: childrenToArray(children),
        ...props
    } as ModalComponentData;
}