import { Events, GuildMember, Message, MessageFlags } from "discord.js";
import Messages from "../util/messages";

const URL_REGEX =
  /(?:http[s]?:\/\/.)?(?:www\.)?[-a-zA-Z0-9@%._\+~#=]{2,256}\.[a-z]{2,6}\b(?:[-a-zA-Z0-9@:%_\+.~#?&\/\/=]*)/g;

export default {
  name: Events.MessageCreate,

  async execute(message: Message) {
    const content = message.content;

    const linkAmount = Array.from(content.matchAll(URL_REGEX));
    if (linkAmount.length == 4) {
      await message.reply(
        Messages.error("This message contains potential scam material.", {
          ephemeral: true,
        })
      );
      await message.delete();
    }
  },
};
