const {Constants} = require("discord.js");

module.exports = () => {
    Constants.Colors.SUCCESS = 0x71cd40;
    Constants.Colors.FAILURE = Constants.Colors.RED;
    Constants.Colors.generate =  function(red, green, blue) {
        return parseInt("0x{{red}}{{green}}{{blue}}".format(red, green, blue), 16);
    };
};