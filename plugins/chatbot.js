import { Module } from "../lib/plugins.js";
import { db } from "../lib/client.js";
import axios from "axios";

Module({
  command: "chatbot",
  package: "ai",
  description: "Toggle AI chatbot ON/OFF",
})(async (message, match) => {
  try {
    const userId = message.sender;
    const args = (match || "").trim().toLowerCase();
    
    if (args === "on" || args === "off") {
      const status = args === "on";
      await db.set(userId, "chatbot_enabled", status);
      return await message.send(`Chatbot ${args.toUpperCase()}`);
    }
    
    const currentStatus = await db.get(userId, "chatbot_enabled", false);
    return await message.send(`Chatbot: ${currentStatus ? "ON" : "OFF"}`);
    
  } catch (err) {
    console.error("Chatbot command error:", err);
    await message.send("Error");
  }
});

// Text-based plugin for AI responses
Module({
  on: "text",
  package: "ai",
  description: "AI chatbot responses",
})(async (message) => {
  try {
    if (message.isFromMe || message.body.startsWith(".")) return;
    
    const userId = message.sender;
    const chatbotEnabled = await db.get(userId, "chatbot_enabled", false);
    if (!chatbotEnabled) return;
    
    const prompt = encodeURIComponent(`am inconnu xd ${message.body}`);
    const apiUrl = `https://api-faa.my.id/faa/jeeves-ai?prompt=${prompt}`;
    
    const response = await axios.get(apiUrl, { timeout: 30000 });
    
    if (response.data && response.data.reply) {
      await message.sendreply(response.data.reply);
    }
    
  } catch (err) {
    console.error("AI chatbot error:", err?.message || err);
  }
});
