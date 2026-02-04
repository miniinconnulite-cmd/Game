
import os from "os";
import { Module, getCommands } from "../lib/plugins.js";
import config from "../config.js";
import { getMenuStyle, buildV1Menu, buildV2Menu } from "./setmenu.js";

const readMore = String.fromCharCode(8206).repeat(4001);

function runtime(secs) {
  const pad = (s) => s.toString().padStart(2, "0");
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

function buildGroupedCommands() {
  const cmds = getCommands();
  return cmds
    .filter((cmd) => cmd && cmd.command && cmd.command !== "undefined")
    .reduce((acc, cmd) => {
      const pkg = (cmd.package || "uncategorized").toString().toLowerCase();
      if (!acc[pkg]) acc[pkg] = [];
      acc[pkg].push(cmd.command);
      return acc;
    }, {});
}

Module({
  command: "menu",
  package: "general",
  description: "Show all commands with selected menu style"
})(async (message, match) => {
  try {
    await message.react("📜");

    const time = new Date().toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
    });
    const userName = message.pushName || "User";
    const usedGB = ((os.totalmem() - os.freemem()) / 1073741824).toFixed(2);
    const totGB = (os.totalmem() / 1073741824).toFixed(2);
    const ram = `${usedGB} / ${totGB} GB`;
    const runtimeStr = runtime(process.uptime());

    const grouped = buildGroupedCommands();
    const chatId = message.from;
    const menuStyle = getMenuStyle(chatId);

    let menuText = "";
    
    // Si une catégorie spécifique est demandée
    if (match && grouped[match.toLowerCase()]) {
      const pack = match.toLowerCase();
      menuText += `\n*╭────❒ ${pack.toUpperCase()} ❒*\n`;
      grouped[pack].sort().forEach((cmdName) => {
        menuText += `*├◈ ${cmdName}*\n`;
      });
      menuText += `*┕──────────────────❒*\n`;
    } else {
      // Construire le menu selon le style choisi
      if (menuStyle === "v2") {
        menuText = buildV2Menu(userName, runtimeStr, ram, time, config.prefix, grouped);
      } else {
        menuText = buildV1Menu(userName, runtimeStr, ram, time, config.prefix, grouped);
      }
    }

    const opts = {
      image: { url: "https://i.postimg.cc/XvsZgKCb/IMG-20250731-WA0527.jpg" },
      caption: menuText,
      mimetype: "image/jpeg",
      contextInfo: {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
          newsletterJid: "120363403408693274@newsletter",
          newsletterName: "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
          serverMessageId: 6,
        },
      },
    };

    await message.conn.sendMessage(message.from, opts);
  } catch (err) {
    console.error("❌ Menu command error:", err);
    await message.conn.sendMessage(message.from, {
      text: `❌ Error: ${err?.message || err}`,
    });
  }
});
