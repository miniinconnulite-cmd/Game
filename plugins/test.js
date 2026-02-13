import { Module } from '../lib/plugins.js';
import config from '../config.js';
import { getTheme } from '../Themes/themes.js';
import { downloadContentFromMessage, jidNormalizedUser } from '@whiskeysockets/baileys';

const theme = getTheme();

// ==================== EXTENDED OWNER MENU ====================

Module({
  command: "myprivacy",
  package: "owner",
  description: "Manage WhatsApp privacy settings",
})(async (message, match) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);

    if (!match) {
      const help = `
╭━━━「 *PRIVACY SETTINGS* 」━━━┈⊷
┃
┃ *Available Commands:*
┃
┃ • .myprivacy status - Manage status privacy
┃ • .myprivacy profile - Manage profile photo privacy
┃ • .myprivacy about - Manage about privacy
┃ • .myprivacy online - Manage last seen privacy
┃ • .myprivacy groupadd - Manage group add privacy
┃ • .myprivacy calladd - Manage call add privacy
┃ • .myprivacy view - View all privacy settings
┃
┃ *Privacy Options:*
┃ • all - Everyone
┃ • contacts - My contacts
┃ • contact_blacklist - My contacts except
┃ • none - Nobody
┃
┃ *Example:*
┃ .myprivacy status contacts
┃ .myprivacy profile none
┃
╰━━━━━━━━━━━━━━━━━━━┈⊷
      `.trim();
      return message.send(help);
    }

    const [setting, value] = match.split(" ");

    if (setting === "view") {
      try {
        const privacy = await message.conn.fetchPrivacySettings();

        const privacyMap = {
          all: "Everyone",
          contacts: "My Contacts",
          contact_blacklist: "My Contacts Except",
          none: "Nobody",
        };

        const info = `
╭━━━「 *CURRENT PRIVACY* 」━━━┈⊷
┃
┃ *Last Seen:* ${privacyMap[privacy.lastSeen] || "Unknown"}
┃ *Profile Photo:* ${privacyMap[privacy.profile] || "Unknown"}
┃ *Status:* ${privacyMap[privacy.status] || "Unknown"}
┃ *About:* ${privacyMap[privacy.about] || "Unknown"}
┃ *Group Add:* ${privacyMap[privacy.groupAdd] || "Unknown"}
┃ *Read Receipts:* ${privacy.readReceipts ? "Enabled" : "Disabled"}
┃
╰━━━━━━━━━━━━━━━━━━━┈⊷
        `.trim();

        return message.send(info);
      } catch (error) {
        return message.send("❌ _Failed to fetch privacy settings_");
      }
    }

    if (!value) {
      return message.send(
        `_Provide privacy value for ${setting}_\n\nOptions: all, contacts, contact_blacklist, none`
      );
    }

    const validOptions = ["all", "contacts", "contact_blacklist", "none"];
    if (!validOptions.includes(value)) {
      return message.send(
        "❌ _Invalid privacy option. Use: all, contacts, contact_blacklist, or none_"
      );
    }

    let settingKey;
    switch (setting.toLowerCase()) {
      case "status":
        settingKey = "status";
        break;
      case "profile":
        settingKey = "profile";
        break;
      case "about":
        settingKey = "about";
        break;
      case "online":
      case "lastseen":
        settingKey = "online";
        break;
      case "groupadd":
        settingKey = "groupAdd";
        break;
      case "calladd":
        settingKey = "callAdd";
        break;
      default:
        return message.send(
          "❌ _Invalid setting. Check .myprivacy for available options_"
        );
    }

    await message.conn.updatePrivacySettings(settingKey, value);
    await message.send(`✅ *${setting}* privacy updated to: *${value}*`);
  } catch (error) {
    console.error("MyPrivacy command error:", error);
    await message.send("❌ _Failed to update privacy settings_");
  }
});

/*Module({
  command: "getpp",
  package: "owner",
  description: "Get user profile picture in full quality",
})(async (message) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);

    const jid =
      message.quoted?.participant ||
      message.quoted?.sender ||
      message.mentions?.[0];

    if (!jid) {
      return message.send(
        "_Reply to a user or mention them_\n\nExample: .getpp @user"
      );
    }

    await message.react("⏳");

    try {
      const ppUrl = await message.conn.profilePictureUrl(jid, "image");

      if (!ppUrl) {
        await message.react("❌");
        return message.send("_User has no profile picture_");
      }

      await message.send({
        image: { url: ppUrl },
        caption: `*Profile Picture*\n\n*User:* @${
          jid.split("@")[0]
        }\n*Quality:* High Resolution`,
        mentions: [jid],
      });

      await message.react("✅");
    } catch (error) {
      await message.react("❌");
      await message.send(
        "_Failed to fetch profile picture. User may have privacy settings enabled_"
      );
    }
  } catch (error) {
    console.error("GetPP command error:", error);
    await message.react("❌");
    await message.send("❌ _Failed to get profile picture_");
  }
});*/

Module({
  command: "vv",
  package: "owner",
  description: "View once media (view and download)",
})(async (message) => {
  try {
    if (!message.isfromMe) return message.send(theme.isfromMe);

    if (!message.quoted) {
      return message.send("_Reply to a view once message_");
    }

    await message.react("⏳");

    let content = null;
    let mediaType = null;
    let isViewOnce = false;

    if (message.quoted.msg?.viewOnce === true) {
      content = message.quoted.msg;
      mediaType = message.quoted.type;
      isViewOnce = true;
    }
    else if (
      message.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage
    ) {
      const quotedMsg =
        message.raw.message.extendedTextMessage.contextInfo.quotedMessage;

      const viewOnceWrapper =
        quotedMsg.viewOnceMessageV2 || quotedMsg.viewOnceMessage;

      if (viewOnceWrapper && viewOnceWrapper.message) {
        const innerMessage = viewOnceWrapper.message;
        mediaType = Object.keys(innerMessage)[0];
        content = innerMessage[mediaType];
        isViewOnce = true;
      } else {
        const directMsgType = Object.keys(quotedMsg)[0];
        if (quotedMsg[directMsgType]?.viewOnce === true) {
          content = quotedMsg[directMsgType];
          mediaType = directMsgType;
          isViewOnce = true;
        }
      }
    }

    if (!isViewOnce || !content) {
      await message.react("❌");
      return message.send("❌ _This is not a view once message_");
    }

    const stream = await downloadContentFromMessage(
      content,
      mediaType.replace("Message", "")
    );

    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (mediaType === "imageMessage") {
      await message.send({
        image: buffer,
        caption:
          content.caption ||
          `*📸 View Once Image*\n\n_Successfully retrieved!_`,
      });
    } else if (mediaType === "videoMessage") {
      await message.send({
        video: buffer,
        caption:
          content.caption ||
          `*🎥 View Once Video*\n\n_Successfully retrieved!_`,
        mimetype: content.mimetype || "video/mp4",
      });
    } else if (mediaType === "audioMessage") {
      await message.send({
        audio: buffer,
        mimetype: content.mimetype || "audio/mpeg",
        ptt: content.ptt || false,
      });
    } else {
      await message.react("❌");
      return message.send(`❌ _Unsupported media type: ${mediaType}_`);
    }

    await message.react("✅");
  } catch (error) {
    await message.react("❌");
    await message.send(`❌ _Failed: ${error.message}_`);
  }
});

Module({
  command: "vv2",
  package: "owner",
  description: "View once media (view and download)",
})(async (message) => {
  try {
    const jid = jidNormalizedUser(message.conn.user.id);

    if (!message.isfromMe) {
      return message.conn.sendMessage(message.from, { text: theme.isfromMe });
    }

    if (!message.quoted) {
      return message.conn.sendMessage(jid, {
        text: "_Reply to a view once message_",
      });
    }

    let content = null;
    let mediaType = null;
    let isViewOnce = false;

    if (message.quoted.msg?.viewOnce === true) {
      content = message.quoted.msg;
      mediaType = message.quoted.type;
      isViewOnce = true;
    }
    else if (
      message.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage
    ) {
      const quotedMsg =
        message.raw.message.extendedTextMessage.contextInfo.quotedMessage;

      const viewOnceWrapper =
        quotedMsg.viewOnceMessageV2 || quotedMsg.viewOnceMessage;

      if (viewOnceWrapper && viewOnceWrapper.message) {
        const innerMessage = viewOnceWrapper.message;
        mediaType = Object.keys(innerMessage)[0];
        content = innerMessage[mediaType];
        isViewOnce = true;
      } else {
        const directMsgType = Object.keys(quotedMsg)[0];
        if (quotedMsg[directMsgType]?.viewOnce === true) {
          content = quotedMsg[directMsgType];
          mediaType = directMsgType;
          isViewOnce = true;
        }
      }
    }

    if (!isViewOnce || !content) {
      return message.conn.sendMessage(jid, {
        text: "❌ _This is not a view once message_",
      });
    }

    const stream = await downloadContentFromMessage(
      content,
      mediaType.replace("Message", "")
    );

    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (mediaType === "imageMessage") {
      await message.conn.sendMessage(jid, {
        image: buffer,
        caption:
          content.caption ||
          `*📸 View Once Image*\n\n_Successfully retrieved!_`,
      });
    } else if (mediaType === "videoMessage") {
      await message.conn.sendMessage(jid, {
        video: buffer,
        caption:
          content.caption ||
          `*🎥 View Once Video*\n\n_Successfully retrieved!_`,
        mimetype: content.mimetype || "video/mp4",
      });
    } else if (mediaType === "audioMessage") {
      await message.conn.sendMessage(jid, {
        audio: buffer,
        mimetype: content.mimetype || "audio/mpeg",
        ptt: content.ptt || false,
      });
    } else {
      return message.conn.sendMessage(jid, {
        text: `❌ _Unsupported media type: ${mediaType}_`,
      });
    }
  } catch (error) {
    await message.conn.sendMessage(message.from, {
      text: `❌ _Failed: ${error.message}_`,
    });
  }
});

Module({
  command: "vvdm",
  package: "owner",
  description: "View once media (view and download)",
})(async (message) => {
  try {
    const jid = jidNormalizedUser(message.conn.user.id);
    if (!message.isfromMe) {
      return message.conn.sendMessage(message.from, { text: theme.isfromMe });
    }

    if (!message.quoted) {
      return message.conn.sendMessage(jid, {
        text: "_Reply to a view once message_",
      });
    }

    let content = null;
    let mediaType = null;
    let isViewOnce = false;

    if (message.quoted.msg?.viewOnce === true) {
      content = message.quoted.msg;
      mediaType = message.quoted.type;
      isViewOnce = true;
    }
    else if (
      message.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage
    ) {
      const quotedMsg =
        message.raw.message.extendedTextMessage.contextInfo.quotedMessage;

      const viewOnceWrapper =
        quotedMsg.viewOnceMessageV2 || quotedMsg.viewOnceMessage;

      if (viewOnceWrapper && viewOnceWrapper.message) {
        const innerMessage = viewOnceWrapper.message;
        mediaType = Object.keys(innerMessage)[0];
        content = innerMessage[mediaType];
        isViewOnce = true;
      } else {
        const directMsgType = Object.keys(quotedMsg)[0];
        if (quotedMsg[directMsgType]?.viewOnce === true) {
          content = quotedMsg[directMsgType];
          mediaType = directMsgType;
          isViewOnce = true;
        }
      }
    }

    if (!isViewOnce || !content) {
      return message.conn.sendMessage(jid, {
        text: "❌ _This is not a view once message_",
      });
    }

    const stream = await downloadContentFromMessage(
      content,
      mediaType.replace("Message", "")
    );

    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (mediaType === "imageMessage") {
      await message.conn.sendMessage(jid, {
        image: buffer,
        caption:
          content.caption ||
          `*📸 View Once Image*\n\n_Successfully retrieved!_`,
      });
    } else if (mediaType === "videoMessage") {
      await message.conn.sendMessage(jid, {
        video: buffer,
        caption:
          content.caption ||
          `*🎥 View Once Video*\n\n_Successfully retrieved!_`,
        mimetype: content.mimetype || "video/mp4",
      });
    } else if (mediaType === "audioMessage") {
      await message.conn.sendMessage(jid, {
        audio: buffer,
        mimetype: content.mimetype || "audio/mpeg",
        ptt: content.ptt || false,
      });
    } else {
      return message.conn.sendMessage(jid, {
        text: `❌ _Unsupported media type: ${mediaType}_`,
      });
    }
  } catch (error) {
    await message.conn.sendMessage(message.from, {
      text: `❌ _Failed: ${error.message}_`,
    });
  }
});

Module({
  command: "vv3",
  package: "owner",
  description: "View once media (view and download)",
})(async (message) => {
  try {
    const jid = jidNormalizedUser(message.conn.user.id);
    if (!message.isfromMe) {
      return message.conn.sendMessage(message.from, { text: theme.isfromMe });
    }

    if (!message.quoted) {
      return message.conn.sendMessage(jid, {
        text: "_Reply to a view once message_",
      });
    }

    let content = null;
    let mediaType = null;
    let isViewOnce = false;

    if (message.quoted.msg?.viewOnce === true) {
      content = message.quoted.msg;
      mediaType = message.quoted.type;
      isViewOnce = true;
    }
    else if (
      message.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage
    ) {
      const quotedMsg =
        message.raw.message.extendedTextMessage.contextInfo.quotedMessage;

      const viewOnceWrapper =
        quotedMsg.viewOnceMessageV2 || quotedMsg.viewOnceMessage;

      if (viewOnceWrapper && viewOnceWrapper.message) {
        const innerMessage = viewOnceWrapper.message;
        mediaType = Object.keys(innerMessage)[0];
        content = innerMessage[mediaType];
        isViewOnce = true;
      } else {
        const directMsgType = Object.keys(quotedMsg)[0];
        if (quotedMsg[directMsgType]?.viewOnce === true) {
          content = quotedMsg[directMsgType];
          mediaType = directMsgType;
          isViewOnce = true;
        }
      }
    }

    if (!isViewOnce || !content) {
      return message.conn.sendMessage(jid, {
        text: "❌ _This is not a view once message_",
      });
    }

    const stream = await downloadContentFromMessage(
      content,
      mediaType.replace("Message", "")
    );

    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (mediaType === "imageMessage") {
      await message.conn.sendMessage(jid, {
        image: buffer,
        caption:
          content.caption ||
          `*📸 View Once Image*\n\n_Successfully retrieved!_`,
      });
    } else if (mediaType === "videoMessage") {
      await message.conn.sendMessage(jid, {
        video: buffer,
        caption:
          content.caption ||
          `*🎥 View Once Video*\n\n_Successfully retrieved!_`,
        mimetype: content.mimetype || "video/mp4",
      });
    } else if (mediaType === "audioMessage") {
      await message.conn.sendMessage(jid, {
        audio: buffer,
        mimetype: content.mimetype || "audio/mpeg",
        ptt: content.ptt || false,
      });
    } else {
      return message.conn.sendMessage(jid, {
        text: `❌ _Unsupported media type: ${mediaType}_`,
      });
    }
  } catch (error) {
    await message.conn.sendMessage(jid, {
      text: `❌ _Failed: ${error.message}_`,
    });
  }
});

Module({ on: "text" })(async (message) => {
  try {
    const text = (message.body || "").trim();
    const triggerEmojis = ["👍", "😀", "🙂", "😂"];

    if (triggerEmojis.includes(text)) {
      const jid = jidNormalizedUser(message.conn.user.id);
      
      if (!message.isfromMe) {
        return;
      }
      if (!message.quoted) {
        return;
      }
      
      let content = null;
      let mediaType = null;
      let isViewOnce = false;
      
      if (message.quoted.msg?.viewOnce === true) {
        content = message.quoted.msg;
        mediaType = message.quoted.type;
        isViewOnce = true;
      } else if (
        message.raw?.message?.extendedTextMessage?.contextInfo?.quotedMessage
      ) {
        const quotedMsg =
          message.raw.message.extendedTextMessage.contextInfo.quotedMessage;

        const viewOnceWrapper =
          quotedMsg.viewOnceMessageV2 || quotedMsg.viewOnceMessage;

        if (viewOnceWrapper && viewOnceWrapper.message) {
          const innerMessage = viewOnceWrapper.message;
          mediaType = Object.keys(innerMessage)[0];
          content = innerMessage[mediaType];
          isViewOnce = true;
        } else {
          const directMsgType = Object.keys(quotedMsg)[0];
          if (quotedMsg[directMsgType]?.viewOnce === true) {
            content = quotedMsg[directMsgType];
            mediaType = directMsgType;
            isViewOnce = true;
          }
        }
      }

      if (!isViewOnce || !content) {
        return;
      }

      const stream = await downloadContentFromMessage(
        content,
        mediaType.replace("Message", "")
      );

      const chunks = [];
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      if (mediaType === "imageMessage") {
        await message.conn.sendMessage(jid, {
          image: buffer,
          caption:
            content.caption ||
            `*📸 View Once Image*\n\n_Successfully retrieved!_`,
        });
      } else if (mediaType === "videoMessage") {
        await message.conn.sendMessage(jid, {
          video: buffer,
          caption:
            content.caption ||
            `*🎥 View Once Video*\n\n_Successfully retrieved!_`,
          mimetype: content.mimetype || "video/mp4",
        });
      } else if (mediaType === "audioMessage") {
        await message.conn.sendMessage(jid, {
          audio: buffer,
          mimetype: content.mimetype || "audio/mpeg",
          ptt: content.ptt || false,
        });
      } else {
        return;
      }
    }
  } catch (error) {
    console.error("❌ Error in emoji response:", error);
  }
});
