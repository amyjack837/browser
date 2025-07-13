import { Telegraf } from "telegraf";
import puppeteer from "puppeteer-core";
import express from "express";

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN; // e.g. https://your-service.onrender.com

app.use(bot.webhookCallback("/bot"));

bot.on("text", async (ctx) => {
  const url = ctx.message.text;
  const loadingMsg = await ctx.reply("Fetching media, please wait...");
  try {
    const mediaUrl = await fetchMedia(url);
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
    await ctx.replyWithVideo(mediaUrl);
  } catch {
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
    await ctx.reply("❌ Error: Could not retrieve media. Make sure the link is valid and fresh.");
  }
});

async function launchBrowser() {
  return puppeteer.launch({
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--single-process",
      "--no-zygote",
      "--disable-gpu"
    ],
    executablePath:
      process.env.CHROME_EXECUTABLE_PATH || "/usr/bin/chromium-browser"
  });
}

async function fetchMedia(url) {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    const mediaUrl = await page.evaluate(() => {
      const video = document.querySelector("video");
      return video?.src || document.querySelector("video source")?.src || null;
    });
    await browser.close();
    if (!mediaUrl) throw new Error("Media not found");
    return mediaUrl;
  } catch (err) {
    await browser.close();
    throw err;
  }
}

app.get("/", (req, res) => res.send("🤖 Bot is alive"));

app.listen(PORT, async () => {
  console.log(`🌐 Server running on port ${PORT}`);
  if (DOMAIN) {
    const webhookUrl = `${DOMAIN}/bot`;
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`📡 Webhook set to: ${webhookUrl}`);
  } else {
    console.log("⚠️ DOMAIN not set. Webhook not registered.");
  }
});
