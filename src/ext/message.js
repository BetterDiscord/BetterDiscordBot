const {Constants} = require("discord.js");
const {CommandoMessage} = require("discord.js-commando");

module.exports = () => {
    CommandoMessage.prototype.success = async function(descriptionOrData) {
        if (typeof(descriptionOrData) == "string") descriptionOrData = {description: descriptionOrData};
        return await this.embed(Object.assign({}, descriptionOrData, {color: Constants.Colors.SUCCESS}));
    };
    
    CommandoMessage.prototype.failure = async function(descriptionOrData) {
        if (typeof(descriptionOrData) == "string") descriptionOrData = {description: descriptionOrData};
        return await this.embed(Object.assign({}, descriptionOrData, {color: Constants.Colors.FAILURE}));
    };
};