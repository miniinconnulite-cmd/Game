// plugins/antitag.js
import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";

// Fonction utilitaire pour convertir en booléen
function toBool(v) {
  if (v === true || v === 1) return true;
  if (v === false || v === 0) return false;
  if (typeof v === "string")
    return ["true", "1", "yes", "on"].includes(v.toLowerCase());
  return Boolean(v);
}

// Récupérer la config antitag d'un groupe
async function getConfig(groupJid, botNumber) {
  const key = `antitag:config:${groupJid}`;
  const cfg = await db.getAsync(botNumber, key, null);
  if (!cfg) {
    return { enabled: false, action: "delete", warnLimit: 3 };
  }
  return {
    enabled: toBool(cfg.enabled),
    action: cfg.action || "delete",
    warnLimit: parseInt(cfg.warnLimit) || 3,
  };
}

// Sauvegarder la config
async function setConfig(groupJid, botNumber, config) {
  const key = `antitag:config:${groupJid}`;
  await db.set(botNumber, key, config);
}

// Récupérer les warns d'un utilisateur dans un groupe
async function getWarns(groupJid, userId, botNumber) {
  const key = `antitag:warns:${groupJid}:${userId}`;
  const warns = await db.getAsync(botNumber, key, 0);
  return parseInt(warns) || 0;
}

// Incrémenter les warns
async function addWarn(groupJid, userId, botNumber) {
  const current = await getWarns(groupJid, userId, botNumber);
  const newWarns = current + 1;
  const key = `antitag:warns:${groupJid}:${userId}`;
  await db.set(botNumber, key, newWarns);
  return newWarns;
}

// Réinitialiser les warns
async function resetWarns(groupJid, userId, botNumber) {
  const key = `antitag:warns:${groupJid}:${userId}`;
  await db.set(botNumber, key, 0);
}

// Supprimer un message
async function deleteMessage(conn, groupJid, messageId) {
  try {
    await conn.sendMessage(groupJid, { delete: { remoteJid: groupJid, fromMe: false, id: messageId, participant: undefined } });
  } catch (e) {
    console.error("[antitag] delete error:", e);
  }
}

// Expulser un utilisateur
async function kickUser(conn, groupJid, userId) {
  try {
    if (typeof conn.groupParticipantsUpdate === "function") {
      await conn.groupParticipantsUpdate(groupJid, [userId], "remove");
    }
  } catch (e) {
    console.error("[antitag] kick error:", e);
  }
}

// ==================== COMMANDES DE CONFIGURATION ====================

Module({
  command: "antitag",
  package: "group",
  description: "Anti-tag system for groups (only admins can mention others)",
})(async (message, match) => {
  try {
    // Vérifier que c'est un groupe
    if (!message.isGroup) {
      return message.send("❌ This command can only be used in groups.");
    }

    const groupJid = message.from;
    const botNumber = (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) || "bot";

    // Charger la config actuelle
    let config = await getConfig(groupJid, botNumber);

    // Si pas d'argument, afficher l'état
    if (!match || match.trim() === "") {
      const status = config.enabled ? "✅ ON" : "❌ OFF";
      const actionMap = {
        delete: "Delete only",
        warn: `Warn (limit: ${config.warnLimit})`,
        kick: "Kick directly"
      };
      return message.send(
        `🔖 *Anti-tag configuration*\n` +
        `Status: ${status}\n` +
        `Action: ${actionMap[config.action] || "Delete"}\n\n` +
        `*Subcommands:*\n` +
        `• .antitag on/off\n` +
        `• .antitag action delete/warn/kick\n` +
        `• .antitag warnlimit <number>\n` +
        `• .antitag status`
      );
    }

    const args = match.trim().toLowerCase().split(/\s+/);
    const subcmd = args[0];

    if (subcmd === "on" || subcmd === "off") {
      // Activer/désactiver
      config.enabled = (subcmd === "on");
      await setConfig(groupJid, botNumber, config);
      await message.react("✅");
      return message.send(`✅ Anti-tag ${subcmd === "on" ? "enabled" : "disabled"} for this group.`);
    }

    if (subcmd === "action") {
      if (args.length < 2) {
        return message.send("❌ Specify action: delete, warn, or kick");
      }
      const action = args[1];
      if (!["delete", "warn", "kick"].includes(action)) {
        return message.send("❌ Invalid action. Use delete, warn, or kick.");
      }
      config.action = action;
      await setConfig(groupJid, botNumber, config);
      await message.react("✅");
      return message.send(`✅ Anti-tag action set to: ${action}`);
    }

    if (subcmd === "warnlimit") {
      if (args.length < 2) {
        return message.send("❌ Provide a number for warn limit.");
      }
      const limit = parseInt(args[1]);
      if (isNaN(limit) || limit < 1) {
        return message.send("❌ Warn limit must be a positive number.");
      }
      config.warnLimit = limit;
      await setConfig(groupJid, botNumber, config);
      await message.react("✅");
      return message.send(`✅ Warn limit set to ${limit}.`);
    }

    if (subcmd === "status") {
      const status = config.enabled ? "✅ ON" : "❌ OFF";
      const actionMap = {
        delete: "Delete only",
        warn: `Warn (limit: ${config.warnLimit})`,
        kick: "Kick directly"
      };
      return message.send(
        `🔖 *Anti-tag configuration*\n` +
        `Status: ${status}\n` +
        `Action: ${actionMap[config.action] || "Delete"}`
      );
    }

    return message.send("❌ Unknown subcommand. Use .antitag for help.");
  } catch (error) {
    console.error("[antitag] command error:", error);
    await message.react("❌");
    await message.send("❌ An error occurred.");
  }
});

// ==================== GESTIONNAIRE DE MESSAGES ====================

Module({ on: "text" })(async (message) => {
  try {
    // Ignorer si pas dans un groupe
    if (!message.isGroup) return;

    // Ignorer les messages du bot lui-même
    if (message.isfromMe) return;

    const groupJid = message.from;
    const senderJid = message.sender;
    const botNumber = (message.conn?.user?.id && String(message.conn.user.id).split(":")[0]) || "bot";

    // Récupérer la configuration
    const config = await getConfig(groupJid, botNumber);
    if (!config.enabled) return; // Antitag désactivé

    // Vérifier si l'utilisateur est admin (ne pas agir sur les admins)
    if (message.isAdmin) return;

    // Vérifier si le message contient des mentions
    const hasMentions = message.mentions && message.mentions.length > 0;
    if (!hasMentions) return;

    // Action selon la configuration
    const action = config.action;

    // Si action "delete" : supprimer le message
    if (action === "delete") {
      await deleteMessage(message.conn, groupJid, message.key.id);
      // Optionnel : envoyer un avertissement discret ? Non, juste suppression.
      return;
    }

    // Si action "kick" : kick direct
    if (action === "kick") {
      // Vérifier que le bot est admin pour kick
      if (!message.isBotAdmin) {
        console.warn("[antitag] Bot not admin, cannot kick.");
        return;
      }
      await deleteMessage(message.conn, groupJid, message.key.id); // Supprimer d'abord
      await kickUser(message.conn, groupJid, senderJid);
      // Optionnel : message de notification
      // await message.send(`@${senderJid.split('@')[0]} has been kicked for mentioning others.`, { mentions: [senderJid] });
      return;
    }

    // Si action "warn" : système de warns
    if (action === "warn") {
      // Supprimer le message contenant les mentions
      await deleteMessage(message.conn, groupJid, message.key.id);

      // Incrémenter le warn
      const warnCount = await addWarn(groupJid, senderJid, botNumber);
      const warnLimit = config.warnLimit;

      // Envoyer un avertissement
      await message.send(
        `⚠️ @${senderJid.split('@')[0]}, only admins can tag others in this group.\n` +
        `You have received warn ${warnCount}/${warnLimit}.`,
        { mentions: [senderJid] }
      );

      // Si atteint la limite, kick
      if (warnCount >= warnLimit) {
        if (message.isBotAdmin) {
          await kickUser(message.conn, groupJid, senderJid);
          await message.send(`@${senderJid.split('@')[0]} has been kicked for exceeding warn limit.`, { mentions: [senderJid] });
        } else {
          console.warn("[antitag] Bot not admin, cannot kick after warns.");
        }
        // Réinitialiser les warns après kick (optionnel)
        await resetWarns(groupJid, senderJid, botNumber);
      }
    }
  } catch (error) {
    console.error("[antitag] handler error:", error);
  }
});
