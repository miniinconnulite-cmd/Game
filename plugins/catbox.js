import fs from 'fs';
import path from 'path';
import os from 'os';
import axios from 'axios';
import FormData from 'form-data';
import { Module } from '../lib/plugins.js';

// ==================== CATBOX / RABBIT URL ====================

Module({
  command: "url",
  package: "Tools",
  description: "Convert media to URL (upload to Catbox/Rabbit)",
})(async (message) => {
  try {
    const quotedMsg = message.quoted || message;
    const mimeType = quotedMsg.content?.mimetype || quotedMsg.type;

    if (!mimeType) {
      return message.send("_Reply to a media file_");
    }

    const supportedTypes = [
      "imageMessage",
      "videoMessage",
      "audioMessage",
      "documentMessage",
      "stickerMessage",
    ];

    if (!supportedTypes.includes(quotedMsg.type)) {
      return message.send("❌ _Unsupported media type_");
    }

    const mediaBuffer = await quotedMsg.download();
    if (!mediaBuffer || mediaBuffer.length === 0) {
      throw new Error("Failed to download media");
    }

    const tempFilePath = path.join(os.tmpdir(), `rabbit_${Date.now()}`);
    fs.writeFileSync(tempFilePath, mediaBuffer);

    let extension = ".bin";
    const mime = quotedMsg.content?.mimetype || "";

    if (mime.includes("image/jpeg")) extension = ".jpg";
    else if (mime.includes("image/png")) extension = ".png";
    else if (mime.includes("image/webp")) extension = ".webp";
    else if (mime.includes("video/mp4")) extension = ".mp4";
    else if (mime.includes("audio/mpeg")) extension = ".mp3";

    const fileName = `file_${Date.now()}${extension}`;

    const form = new FormData();
    form.append("fileToUpload", fs.createReadStream(tempFilePath), fileName);
    form.append("reqtype", "fileupload");

    const response = await axios.post(
      "https://catbox.moe/user/api.php",
      form,
      { headers: form.getHeaders() }
    );

    fs.unlinkSync(tempFilePath);

    if (!response.data || response.data.includes("error")) {
      throw new Error("Upload failed");
    }

    const link = response.data
      .trim()
      .replace("files.catbox.moe", "www.rabbit.zone.id");

    await message.send(link);

  } catch (err) {
    console.error("URL command error:", err);
    await message.send("❌ Upload failed");
  }
});

// ==================== TELEGRAPH IMAGE ====================

Module({
  command: "telegraph",
  package: "Tools",
  description: "Upload image to Telegraph",
})(async (message) => {
  try {
    const quotedMsg = message.quoted || message;

    if (quotedMsg.type !== "imageMessage") {
      return message.send("_Reply to an image_");
    }

    const buffer = await quotedMsg.download();
    const tempFilePath = path.join(os.tmpdir(), `telegraph_${Date.now()}.jpg`);
    fs.writeFileSync(tempFilePath, buffer);

    const form = new FormData();
    form.append("file", fs.createReadStream(tempFilePath));

    const response = await axios.post(
      "https://telegra.ph/upload",
      form,
      { headers: form.getHeaders() }
    );

    fs.unlinkSync(tempFilePath);

    if (!response.data?.[0]?.src) {
      throw new Error("Upload failed");
    }

    const url = "https://telegra.ph" + response.data[0].src;
    await message.send(`✅ *Uploaded*\n${url}`);

  } catch (err) {
    console.error("Telegraph error:", err);
    await message.send("❌ Upload failed");
  }
});
