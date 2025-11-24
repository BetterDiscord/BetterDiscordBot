import {ComponentType, type UserSelectMenuComponentData} from "discord.js";


export type UserSelectProps = Omit<UserSelectMenuComponentData, "type">;

export function UserSelect(props: UserSelectProps): UserSelectMenuComponentData {
    return {
        type: ComponentType.UserSelect,
        ...props
    };
}