plugins/setmenu.js

import { Module } from "../lib/plugins.js";
import config from "../config.js";

// Stockage des préférences de menu (en mémoire)
const userMenuPreferences = new Map();
const groupMenuPreferences = new Map();

Module({
  command: "setmenu",
  package: "general",
  description: "Change menu style (v1 or v2)"
})(async (message, match) => {
  try {
    const style = match?.trim()?.toLowerCase();
    
    if (!style || !["v1", "v2"].includes(style)) {
      return await message.reply(
        `❌ *Invalid menu style!*\n\n` +
        `*Usage:* ${config.prefix}setmenu v1 or ${config.prefix}setmenu v2\n\n` +
        `*v1:* Compact horizontal layout\n` +
        `*v2:* Classic vertical layout`
      );
    }
    
    const chatId = message.from;
    const isGroup = chatId.includes("@g.us");
    
    if (isGroup) {
      groupMenuPreferences.set(chatId, style);
    } else {
      userMenuPreferences.set(chatId, style);
    }
    
    await message.reply(`✅ *Menu style set to ${style.toUpperCase()}!*\nUse ${config.prefix}menu to see the new style.`);
    
  } catch (err) {
    console.error("❌ setmenu command error:", err);
    await message.reply(`❌ Error: ${err?.message || err}`);
  }
});

// Fonction pour obtenir le style de menu
export function getMenuStyle(chatId) {
  if (chatId.includes("@g.us")) {
    return groupMenuPreferences.get(chatId) || "v1";
  }
  return userMenuPreferences.get(chatId) || "v1";
}

// Fonction pour v1 menu (maintenant le menu compact horizontal)
export function buildV1Menu(userName, runtimeStr, ram, time, prefix, groupedCommands) {
  let menu = `
╭───────────────⭓
│ Rᴜɴ : ${runtimeStr}
│ Uѕᴇʀ : ${userName}
│ Tɪᴍᴇ : ${time}
│ Mᴏᴅᴇ : Public
│ ᴠᴇʀꜱɪᴏɴ : 2.0.0
╰───────────────⭓\n`;

  const categories = Object.keys(groupedCommands).sort();
  
  for (const cat of categories) {
    const commandCount = groupedCommands[cat].length;
    const icon = commandCount > 3 ? "👥" : "📌";
    
    menu += `\n╭─${icon} ${cat.toUpperCase()}\n`;
    groupedCommands[cat].sort().forEach((cmdName) => {
      menu += `│ • ${cmdName}\n`;
    });
    menu += `╰───────────────⭓\n`;
  }

  menu += `\n*ᴍɪɴɪ ɪɴᴄᴏɴɴᴜ xᴅ ʙᴏᴛ*`;
  return menu;
}

// Fonction pour v2 menu (maintenant le menu classique vertical)
export function buildV2Menu(userName, runtimeStr, ram, time, prefix, groupedCommands) {
  let menu = `
╭───────────────⭓
│  👋 ʜᴇʟʟᴏ ${userName}
│
│  ╭─❖ 【 ʙᴏᴛ ɪɴꜰᴏ 】
│  │ ʙᴏᴛ : ᴍɪɴɪ ɪɴᴄᴏɴɴᴜ xᴅ
│  │ Rᴜɴ : ${runtimeStr}
│  │ Mᴏᴅᴇ : Public
│  │ Uѕᴇʀ : ${userName}
│  │ Pʀᴇғɪx : ${prefix}
│  │ ᴠᴇʀꜱɪᴏɴ : 2.0.0
│  ╰─────────────⧈
│
╰───────────────⭓\n`;

  const categories = Object.keys(groupedCommands).sort();
  
  for (const cat of categories) {
    menu += `\n⭓───────────────⭓『 ${cat.toUpperCase()} 』\n\n`;
    groupedCommands[cat].sort().forEach((cmdName) => {
      menu += `│ ⬡ ${cmdName}\n`;
    });
    menu += `╰──────────────────⭓\n`;
  }

  menu += `\n*ᴍɪɴɪ ɪɴᴄᴏɴɴᴜ xᴅ ʙᴏᴛ*`;
  return menu;
}
