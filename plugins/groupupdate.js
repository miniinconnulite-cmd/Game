// plugins/groupupdate.js
import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";
import axios from "axios";
import { jidNormalizedUser } from "@whiskeysockets/baileys";
import config from "../config.js";

const DEFAULT_GOODBYE = `
╭───────────────⭓
│ bot : &botname
│ dev : inconnu boy
│ ᴠᴇʀꜱɪᴏɴ : 2.0.0
╰───────────────⭓

╭─ GOODBYE
│ • user : &mention
│ • group : &name
│ • members : &size
│ • admin : &admins
│ • date : &date
╰───────────────⭓`;

const DEFAULT_WELCOME = `
╭───────────────⭓
│ bot : &botname
│ dev : inconnu boy
│ ᴠᴇʀꜱɪᴏɴ : 2.0.0
╰───────────────⭓

╭─ WELCOME
│ • user : &mention
│ • group : &name
│ • members : &size
│ • admin : &admins
│ • date : &date
╰───────────────⭓`;

/* ---------------- helpers ---------------- */
function toBool(v) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (typeof v === "string")
    return ["true", "1", "yes", "on"].includes(v.toLowerCase());
  return Boolean(v);
}

function formatDate() {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

function buildText(template = "", replacements = {}) {
  let text = template || "";
  text = text.replace(/&mention/g, replacements.mentionText || "");
  text = text.replace(/&name/g, replacements.name || "");
  text = text.replace(/&size/g, String(replacements.size ?? ""));
  text = text.replace(/&admins/g, String(replacements.adminCount ?? "0"));
  text = text.replace(/&date/g, replacements.date || formatDate());
  text = text.replace(/&botname/g, replacements.botname || config.BOT_NAME || "Bot");
  return text;
}

async function getAdminCount(conn, groupJid) {
  try {
    const metadata = await conn.groupMetadata(groupJid);
    if (metadata && Array.isArray(metadata.participants)) {
      return metadata.participants.filter(p => 
        p.admin === "admin" || p.admin === "superadmin"
      ).length;
    }
  } catch (e) {
    console.error("[groupupdate] getAdminCount error:", e?.message || e);
  }
  return 0;
}

async function getBotImageBuffer() {
  try {
    const res = await axios.get(config.MENU_IMAGE_URL, {
      responseType: "arraybuffer",
      timeout: 20000,
    });
    return Buffer.from(res.data);
  } catch (e) {
    console.error("[groupupdate] getBotImageBuffer error:", e?.message || e);
    return null;
  }
}

async function sendWelcomeMsg(conn, groupJid, text, mentions = [], imgBuffer = null) {
  const baseOptions = {
    mentions,
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: "120363403408693274@newsletter",
        newsletterName: config.BOT_NAME || "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
        serverMessageId: 6,
      },
    }
  };

  try {
    const messageOptions = imgBuffer
      ? { ...baseOptions, image: imgBuffer, caption: text }
      : { ...baseOptions, text };

    await conn.sendMessage(groupJid, messageOptions);
  } catch (err) {
    console.error("[groupupdate] sendWelcomeMsg primary error:", err?.message || err);
    
    // Fallback without newsletter context
    try {
      if (imgBuffer) {
        await conn.sendMessage(groupJid, { image: imgBuffer, caption: text, mentions });
      } else {
        await conn.sendMessage(groupJid, { text, mentions });
      }
    } catch (e) {
      console.error("[groupupdate] sendWelcomeMsg fallback error:", e?.message || e);
    }
  }
}

/* ---------------- CHECK IF USER IS BOT ---------------- */
function isBot(conn, userJid) {
  if (!userJid || !conn?.user?.id) return false;
  const botJid = jidNormalizedUser(conn.user.id);
  return userJid === botJid;
}

// Welcome on/off
Module({
  command: "welcome",
  package: "group",
  description: "Turn per-group welcome ON or OFF (must be used inside the group).",
})(async (message, match) => {
  const groupJid = message.from || message.chat || message.key?.remoteJid || message.isGroup;
  if (!groupJid || !groupJid.includes("@g.us")) {
    return await message.send?.("❌ Use this command inside the group to toggle welcome messages.");
  }

  const raw = (match || "").trim().toLowerCase();
  if (!raw) {
    const botNumber = (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) || "bot";
    const key = `group:${groupJid}:welcome`;
    const cfg = await db.getAsync(botNumber, key, null);
    const status = cfg && typeof cfg === "object" ? toBool(cfg.status) : true;
    return await message.sendreply?.(`Welcome is ${status ? "✅ ON" : "❌ OFF"} for this group.`);
  }

  if (raw !== "on" && raw !== "off") {
    return await message.send?.("❌ Invalid option. Use on or off.");
  }

  const botNumber = (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) || "bot";
  const key = `group:${groupJid}:welcome`;
  const cfg = { status: raw === "on" };
  await db.set(botNumber, key, cfg);
  await message.react?.("✅");
  return await message.send(cfg.status ? "✅ Welcome ENABLED for this group" : "❌ Welcome DISABLED for this group");
});

// Goodbye on/off
Module({
  command: "goodbye",
  package: "group",
  description: "Turn per-group goodbye ON or OFF (must be used inside the group).",
})(async (message, match) => {
  const groupJid = message.from || message.chat || message.key?.remoteJid || message.isGroup;
  if (!groupJid || !groupJid.includes("@g.us")) {
    return await message.send?.("❌ Use this command inside the group to toggle goodbye messages.");
  }

  const raw = (match || "").trim().toLowerCase();
  if (!raw) {
    const botNumber = (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) || "bot";
    const key = `group:${groupJid}:goodbye`;
    const cfg = await db.getAsync(botNumber, key, null);
    const status = cfg && typeof cfg === "object" ? toBool(cfg.status) : true;
    return await message.sendreply?.(`Goodbye is ${status ? "✅ ON" : "❌ OFF"} for this group.`);
  }

  if (raw !== "on" && raw !== "off") {
    return await message.send?.("❌ Invalid option. Use on or off.");
  }

  const botNumber = (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) || "bot";
  const key = `group:${groupJid}:goodbye`;
  const cfg = { status: raw === "on" };
  await db.set(botNumber, key, cfg);
  await message.react?.("✅");
  return await message.send(cfg.status ? "✅ Goodbye ENABLED for this group" : "❌ Goodbye DISABLED for this group");
});

// SETWELCOME command
Module({
  command: "setwelcome",
  package: "group",
  description: "Set custom welcome message template for this group.\nAvailable variables: &mention, &name, &size, &admins, &date, &botname",
})(async (message, match) => {
  const groupJid = message.from || message.chat || message.key?.remoteJid || message.isGroup;
  if (!groupJid || !groupJid.includes("@g.us")) {
    return await message.send?.("❌ Use this command inside the group to set welcome message.");
  }

  const botNumber = (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) || "bot";
  const key = `group:${groupJid}:welcome_template`;

  const raw = (match || "").trim();

  if (!raw) {
    // Show current template
    const currentTemplate = await db.getAsync(botNumber, key, null);
    const templateToShow = currentTemplate || DEFAULT_WELCOME;
    
    const helpText = `📝 *Current Welcome Template:*\n\`\`\`${templateToShow}\`\`\`\n\n*Available variables:*\n• &mention - Mentions new member\n• &name - Group name\n• &size - Total members count\n• &admins - Number of admins\n• &date - Current date & time\n• &botname - Bot name\n\nTo change it, use: .setwelcome your template here`;
    return await message.send(helpText);
  }

  // Save custom template
  await db.set(botNumber, key, raw);
  await message.react("✅");
  
  // Show preview
  const metadata = await message.conn.groupMetadata(groupJid);
  const groupSize = metadata?.participants?.length || 0;
  const adminCount = metadata?.participants?.filter(p => p.admin)?.length || 0;
  
  const previewText = buildText(raw, {
    mentionText: `@${message.sender?.split("@")[0] || "user"}`,
    name: metadata?.subject || "Group",
    size: groupSize,
    adminCount: adminCount,
    date: formatDate(),
    botname: config.BOT_NAME
  });
  
  await message.send(`✅ *Welcome template saved!*\n\n*Preview:*\n${previewText}`);
});

// SETGOODBYE command
Module({
  command: "setgoodbye",
  package: "group",
  description: "Set custom goodbye message template for this group.\nAvailable variables: &mention, &name, &size, &admins, &date, &botname",
})(async (message, match) => {
  const groupJid = message.from || message.chat || message.key?.remoteJid || message.isGroup;
  if (!groupJid || !groupJid.includes("@g.us")) {
    return await message.send?.("❌ Use this command inside the group to set goodbye message.");
  }

  const botNumber = (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) || "bot";
  const key = `group:${groupJid}:goodbye_template`;

  const raw = (match || "").trim();

  if (!raw) {
    // Show current template
    const currentTemplate = await db.getAsync(botNumber, key, null);
    const templateToShow = currentTemplate || DEFAULT_GOODBYE;
    
    const helpText = `📝 *Current Goodbye Template:*\n\`\`\`${templateToShow}\`\`\`\n\n*Available variables:*\n• &mention - Mentions leaving member\n• &name - Group name\n• &size - Total members count\n• &admins - Number of admins\n• &date - Current date & time\n• &botname - Bot name\n\nTo change it, use: .setgoodbye your template here`;
    return await message.send(helpText);
  }

  // Save custom template
  await db.set(botNumber, key, raw);
  await message.react("✅");
  
  // Show preview
  const metadata = await message.conn.groupMetadata(groupJid);
  const groupSize = metadata?.participants?.length || 0;
  const adminCount = metadata?.participants?.filter(p => p.admin)?.length || 0;
  
  const previewText = buildText(raw, {
    mentionText: `@${message.sender?.split("@")[0] || "user"}`,
    name: metadata?.subject || "Group",
    size: groupSize,
    adminCount: adminCount,
    date: formatDate(),
    botname: config.BOT_NAME
  });
  
  await message.send(`✅ *Goodbye template saved!*\n\n*Preview:*\n${previewText}`);
});

// RESET WELCOME command
Module({
  command: "resetwelcome",
  package: "group",
  description: "Reset welcome message to default for this group.",
})(async (message) => {
  const groupJid = message.from || message.chat || message.key?.remoteJid || message.isGroup;
  if (!groupJid || !groupJid.includes("@g.us")) {
    return await message.send?.("❌ Use this command inside the group.");
  }

  const botNumber = (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) || "bot";
  const key = `group:${groupJid}:welcome_template`;

  await db.delete(botNumber, key);
  await message.react("✅");
  await message.send("✅ Welcome template reset to default!");
});

// RESET GOODBYE command
Module({
  command: "resetgoodbye",
  package: "group",
  description: "Reset goodbye message to default for this group.",
})(async (message) => {
  const groupJid = message.from || message.chat || message.key?.remoteJid || message.isGroup;
  if (!groupJid || !groupJid.includes("@g.us")) {
    return await message.send?.("❌ Use this command inside the group.");
  }

  const botNumber = (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) || "bot";
  const key = `group:${groupJid}:goodbye_template`;

  await db.delete(botNumber, key);
  await message.react("✅");
  await message.send("✅ Goodbye template reset to default!");
});

/* ---------------- EVENT: group-participants.update ---------------- */
Module({ on: "group-participants.update" })(async (_msg, event, conn) => {
  try {
    if (!event || !event.id || !event.action || !Array.isArray(event.participants)) return;
    
    const groupJid = event.id;
    const groupName = 
      event.groupName || 
      (event.groupMetadata && event.groupMetadata.subject) || 
      "Unknown Group";
    
    // Get group metadata
    let groupSize = 0;
    let adminCount = 0;
    try {
      const metadata = await conn.groupMetadata(groupJid);
      if (metadata) {
        groupSize = Array.isArray(metadata.participants) ? metadata.participants.length : 0;
        adminCount = Array.isArray(metadata.participants) ? 
          metadata.participants.filter(p => p.admin === "admin" || p.admin === "superadmin").length : 0;
      }
    } catch (e) {
      console.error("[groupupdate] metadata fetch error:", e?.message || e);
    }

    const botNumber = (conn?.user?.id && String(conn.user.id).split(":")[0]) || "bot";
    const action = String(event.action).toLowerCase();
    const botJidFull = jidNormalizedUser(conn?.user?.id);
    const currentDate = formatDate();
    
    // Get bot image once for all participants
    const botImageBuffer = await getBotImageBuffer();

    for (const p of event.participants) {
      const participantJid = jidNormalizedUser(typeof p === "string" ? p : p.id || p.jid || "");
      if (!participantJid) continue;
      
      if (botJidFull && participantJid === botJidFull) continue;

      // Handle PROMOTE action
      if (action === "promote") {
        const actor = event.actor || event.author || event.by || null;
        const actorText = actor ? `@${actor.split("@")[0]}` : "Admin";
        const targetText = `@${participantJid.split("@")[0]}`;
        const sendText = `${actorText} promoted ${targetText} in ${groupName}`;
        
        try {
          const mentions = [actor, participantJid].filter(Boolean);
          await conn.sendMessage(groupJid, { 
            text: sendText, 
            mentions,
            contextInfo: {
              forwardingScore: 999,
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterJid: "120363403408693274@newsletter",
                newsletterName: config.BOT_NAME || "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
                serverMessageId: 6,
              },
            }
          });
        } catch (e) {
          console.error("[groupupdate] promote send error:", e?.message || e);
          try {
            await conn.sendMessage(groupJid, { text: sendText });
          } catch (_) {}
        }
      }
      
      // Handle DEMOTE action
      else if (action === "demote") {
        const actor = event.actor || event.author || event.by || null;
        const actorText = actor ? `@${actor.split("@")[0]}` : "Admin";
        const targetText = `@${participantJid.split("@")[0]}`;
        const sendText = `${actorText} demoted ${targetText} in ${groupName}`;
        
        try {
          const mentions = [actor, participantJid].filter(Boolean);
          await conn.sendMessage(groupJid, { 
            text: sendText, 
            mentions,
            contextInfo: {
              forwardingScore: 999,
              isForwarded: true,
              forwardedNewsletterMessageInfo: {
                newsletterJid: "120363403408693274@newsletter",
                newsletterName: config.BOT_NAME || "𝙼𝙸𝙽𝙸 𝙸𝙽𝙲𝙾𝙽𝙽𝚄 𝚇𝙳",
                serverMessageId: 6,
              },
            }
          });
        } catch (e) {
          console.error("[groupupdate] demote send error:", e?.message || e);
          try {
            await conn.sendMessage(groupJid, { text: sendText });
          } catch (_) {}
        }
      }
      
      // WELCOME (add/invite/join)
      else if (action === "add" || action === "invite" || action === "joined") {
        const key = `group:${groupJid}:welcome`;
        const cfgRaw = await db.getAsync(botNumber, key, null);
        const enabled = cfgRaw && typeof cfgRaw === "object" ? toBool(cfgRaw.status) : true;
        
        if (!enabled) continue;
        
        // Get custom template if exists
        const templateKey = `group:${groupJid}:welcome_template`;
        let template = await db.getAsync(botNumber, templateKey, null);
        if (!template) template = DEFAULT_WELCOME;
        
        const mentionText = `@${participantJid.split("@")[0]}`;
        const replacements = {
          mentionText,
          name: groupName,
          size: groupSize,
          adminCount: adminCount,
          date: currentDate,
          botname: config.BOT_NAME
        };
        
        const text = buildText(template, replacements);
        
        try {
          await sendWelcomeMsg(conn, groupJid, text, [participantJid], botImageBuffer);
        } catch (e) {
          console.error("[groupupdate] error sending welcome:", e?.message || e);
        }
      }
      
      // GOODBYE (remove/leave/left/kicked)
      else if (action === "remove" || action === "leave" || action === "left" || action === "kicked") {
        const key = `group:${groupJid}:goodbye`;
        const cfgRaw = await db.getAsync(botNumber, key, null);
        const enabled = cfgRaw && typeof cfgRaw === "object" ? toBool(cfgRaw.status) : true;
        
        if (!enabled) continue;
        
        // Get custom template if exists
        const templateKey = `group:${groupJid}:goodbye_template`;
        let template = await db.getAsync(botNumber, templateKey, null);
        if (!template) template = DEFAULT_GOODBYE;
        
        const mentionText = `@${participantJid.split("@")[0]}`;
        const replacements = {
          mentionText,
          name: groupName,
          size: groupSize - 1, // Subtract 1 for leaving member
          adminCount: adminCount,
          date: currentDate,
          botname: config.BOT_NAME
        };
        
        const text = buildText(template, replacements);
        
        try {
          await sendWelcomeMsg(conn, groupJid, text, [participantJid], botImageBuffer);
        } catch (e) {
          console.error("[groupupdate] error sending goodbye:", e?.message || e);
        }
      }
    }
  } catch (err) {
    console.error("[groupupdate] event handler error:", err?.message || err);
  }
});
