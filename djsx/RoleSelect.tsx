import {ComponentType, type RoleSelectMenuComponentData} from "discord.js";


export type RoleSelectProps = Omit<RoleSelectMenuComponentData, "type">;

export function RoleSelect(props: RoleSelectProps): RoleSelectMenuComponentData {
    return {
        type: ComponentType.RoleSelect,
        ...props
    };
}