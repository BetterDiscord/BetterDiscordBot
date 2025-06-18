import {EmbedBuilder, type BaseMessageOptions, type ColorResolvable} from "discord.js";
import Colors from "./colors";


interface EmbedOptions {
    description: string;
    color: ColorResolvable;
    ephemeral?: boolean;
    components?: BaseMessageOptions["components"];
}

export default class Messages {
    static embed({description, color, ephemeral, components}: EmbedOptions) {
        // return new EmbedBuilder().setColor(color).setDescription(description);
        const embed = new EmbedBuilder().setColor(color).setDescription(description);
        return {embeds: [embed], components, ephemeral: ephemeral};
    }

    static success(description: string, {ephemeral, components}: Partial<Omit<EmbedOptions, "description">> = {}) {
        return this.embed({color: Colors.Success, description, ephemeral, components});
    }

    static error(description: string, {ephemeral, components}: Partial<Omit<EmbedOptions, "description">> = {}) {
        return this.embed({color: Colors.Error, description, ephemeral, components});
    }

    static info(description: string, {ephemeral, components}: Partial<Omit<EmbedOptions, "description">> = {}) {
        return this.embed({color: Colors.Info, description, ephemeral, components});
    }

    static warn(description: string, {ephemeral, components}: Partial<Omit<EmbedOptions, "description">> = {}) {
        return this.embed({color: Colors.Warn, description, ephemeral, components});
    }
}