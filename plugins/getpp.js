import { Module } from "../lib/plugins.js";
import { getTheme } from "../Themes/themes.js";
const theme = getTheme();

/**
 * Extract JID from message (quoted, mentioned, or number in text)
 */
const extractJid = (message) => {
  // Check quoted message first
  if (message.quoted?.participant) return message.quoted.participant;
  if (message.quoted?.sender) return message.quoted.sender;

  // Check mentions
  if (message.mentions?.[0]) return message.mentions[0];

  // Extract from text (if user typed a number)
  const text = message.body.split(" ").slice(1).join(" ").trim();
  if (text) {
    // Remove any non-numeric characters
    const number = text.replace(/[^0-9]/g, "");
    if (number && number.length >= 10) {
      // Check if it's a group JID
      if (text.includes("-") && text.includes("@g.us")) {
        return text;
      }
      // Add @s.whatsapp.net if it's a phone number
      return `${number}@s.whatsapp.net`;
    }
  }

  return null;
};

/**
 * Get profile picture URL with fallback
 */
const getProfilePicture = async (message, jid) => {
  try {
    // Try to get high quality profile picture
    const ppUrl = await message.conn.profilePictureUrl(jid, "image");
    return { success: true, url: ppUrl };
  } catch (error) {
    // Check specific error messages
    if (error.message?.includes("403") || error.message?.includes("401")) {
      return { 
        success: false, 
        error: "PRIVACY", 
        message: "User has privacy settings enabled" 
      };
    }
    if (error.message?.includes("404")) {
      return { 
        success: false, 
        error: "NO_PP", 
        message: "User has no profile picture" 
      };
    }
    return { 
      success: false, 
      error: "UNKNOWN", 
      message: error.message 
    };
  }
};

/**
 * Get user info (name) from WhatsApp
 */
const getUserInfo = async (message, jid) => {
  try {
    const [result] = await message.conn.onWhatsApp(jid);
    return result || null;
  } catch {
    return null;
  }
};

Module({
  command: "getpp",
  package: "owner",
  aliases: ["profilepic", "pp", "dp", "profilephoto"],
  description: "Get profile picture of a user",
  usage: ".getpp <@user|reply|number>",
})(async (message) => {
  try {
    // Restrict to owner only
    if (!message.isfromMe) {
      return message.send(theme.isfromMe || "_This command is for owner only_");
    }

    await message.react("⏳");

    // Extract target JID
    let targetJid = extractJid(message);

    // If no target specified, use sender's own JID
    if (!targetJid) {
      targetJid = message.sender;
    }

    if (!targetJid) {
      await message.react("❌");
      return message.send(
        "❌ _Could not identify target_\n\n" +
        "*Usage:*\n" +
        "• `.getpp` - Get your own profile picture\n" +
        "• `.getpp @user` - Get mentioned user's profile picture\n" +
        "• `.getpp` (reply to user) - Get replied user's profile picture\n" +
        "• `.getpp 1234567890` - Get profile picture by number"
      );
    }

    // Get user info (name)
    const userInfo = await getUserInfo(message, targetJid);
    
    // Get profile picture
    const result = await getProfilePicture(message, targetJid);

    if (!result.success) {
      await message.react("❌");
      
      let errorMessage = "";
      const number = targetJid.split("@")[0];
      
      switch (result.error) {
        case "PRIVACY":
          errorMessage = `🔒 _@${number} has privacy settings enabled_\n_Cannot fetch profile picture_`;
          break;
        case "NO_PP":
          errorMessage = `📷 _@${number} does not have a profile picture_`;
          break;
        default:
          errorMessage = `❌ _Failed to fetch profile picture for @${number}_`;
      }
      
      return message.send(errorMessage, {
        mentions: [targetJid]
      });
    }

    // Success - send the profile picture
    const number = targetJid.split("@")[0];
    const name = userInfo?.name || userInfo?.notify || number;
    
    await message.send({
      image: { url: result.url },
      caption: `┏━━「 *PROFILE PICTURE* 」━━┓\n` +
               `┃\n` +
               `┃ *User:* ${name}\n` +
               `┃ *Number:* ${number}\n` +
               `┃ *Quality:* High Resolution\n` +
               `┃ *Type:* Profile Photo\n` +
               `┃\n` +
               `┗━━━━━━━━━━━━━━━━━━━━┛`,
      mentions: [targetJid]
    });

    await message.react("✅");

  } catch (error) {
    console.error("GetPP command error:", error);
    await message.react("❌");
    await message.send("❌ _An error occurred while fetching profile picture_");
  }
});

/**
 * Alternative version: Get profile picture and save/download
 */
Module({
  command: "getpphd",
  package: "owner",
  aliases: ["pphd", "hdpp"],
  description: "Get profile picture in HD and send as document",
  usage: ".getpphd <@user|reply|number>",
})(async (message) => {
  try {
    if (!message.isfromMe) {
      return message.send(theme.isfromMe || "_This command is for owner only_");
    }

    await message.react("⏳");

    let targetJid = extractJid(message) || message.sender;

    if (!targetJid) {
      await message.react("❌");
      return message.send("❌ _Could not identify target_");
    }

    const result = await getProfilePicture(message, targetJid);

    if (!result.success) {
      await message.react("❌");
      const number = targetJid.split("@")[0];
      
      if (result.error === "NO_PP") {
        return message.send(`📷 _@${number} has no profile picture_`, {
          mentions: [targetJid]
        });
      }
      
      return message.send(`❌ _Failed: ${result.message}_`);
    }

    // Fetch image as buffer
    const response = await fetch(result.url);
    const buffer = await response.arrayBuffer();
    
    const number = targetJid.split("@")[0];
    const filename = `profile_${number}_${Date.now()}.jpg`;

    await message.send({
      document: Buffer.from(buffer),
      mimetype: "image/jpeg",
      fileName: filename,
      caption: `┏━━「 *HD PROFILE PICTURE* 」━━┓\n` +
               `┃\n` +
               `┃ *User:* ${number}\n` +
               `┃ *File:* ${filename}\n` +
               `┃ *Size:* ${(buffer.byteLength / 1024).toFixed(2)} KB\n` +
               `┃\n` +
               `┗━━━━━━━━━━━━━━━━━━━━━━━━┛`
    });

    await message.react("✅");

  } catch (error) {
    console.error("GetPPHD command error:", error);
    await message.react("❌");
    await message.send("❌ _Failed to get HD profile picture_");
  }
});

/**
 * Get group profile picture
 */
Module({
  command: "getgpp",
  package: "owner",
  aliases: ["grouppp", "gpp"],
  description: "Get group profile picture",
  usage: ".getgpp [group link or leave empty for current group]",
})(async (message) => {
  try {
    if (!message.isfromMe) {
      return message.send(theme.isfromMe || "_This command is for owner only_");
    }

    await message.react("⏳");

    // Determine which group to get
    let groupJid = message.from;
    const text = message.body.split(" ").slice(1).join(" ").trim();

    // If group link provided, try to extract JID
    if (text && text.includes("chat.whatsapp.com")) {
      try {
        // Extract invite code
        const inviteCode = text.split("/").pop();
        const groupInfo = await message.conn.groupGetInviteInfo(inviteCode);
        groupJid = groupInfo.id;
      } catch {
        return message.send("❌ _Invalid group link or bot not in group_");
      }
    }

    // Get group profile picture
    try {
      const ppUrl = await message.conn.profilePictureUrl(groupJid, "image");
      
      // Get group metadata
      let groupName = "Unknown Group";
      try {
        const metadata = await message.conn.groupMetadata(groupJid);
        groupName = metadata.subject || "Unknown Group";
      } catch {}

      await message.send({
        image: { url: ppUrl },
        caption: `┏━━「 *GROUP PROFILE PICTURE* 」━━┓\n` +
                 `┃\n` +
                 `┃ *Group:* ${groupName}\n` +
                 `┃ *JID:* ${groupJid}\n` +
                 `┃\n` +
                 `┗━━━━━━━━━━━━━━━━━━━━━━━━━━┛`
      });

      await message.react("✅");

    } catch (error) {
      if (error.message?.includes("404")) {
        await message.send("📷 _This group has no profile picture_");
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error("GetGPP command error:", error);
    await message.react("❌");
    await message.send("❌ _Failed to get group profile picture_");
  }
});
