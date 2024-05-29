const {EmbedBuilder} = require("discord.js");
const Colors = require("./colors");

module.exports = class Messages {
    static embed({description, color, ephemeral, components}) {
        // return new EmbedBuilder().setColor(color).setDescription(description);
        const embed = new EmbedBuilder().setColor(color).setDescription(description);
        return {embeds: [embed], components, ephemeral: ephemeral};
    }

    static success(description, {ephemeral, components}) {
        return this.embed({color: Colors.Success, description, ephemeral, components});
    }

    static error(description, {ephemeral, components}) {
        return this.embed({color: Colors.Error, description, ephemeral, components});
    }

    static info(description, {ephemeral, components}) {
        return this.embed({color: Colors.Info, description, ephemeral, components});
    }

    static warn(description, {ephemeral, components}) {
        return this.embed({color: Colors.Warn, description, ephemeral, components});
    }
};