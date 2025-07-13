import { Telegraf } from "telegraf";
import puppeteer from "puppeteer-core";
import express from "express";

const bot = new Telegraf(process.env.BOT_TOKEN);

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
      if (video && video.src) return video.src;
      const source = document.querySelector("video source");
      if (source && source.src) return source.src;
      return null;
    });
    await browser.close();
    if (!mediaUrl) throw new Error("Media URL not found on page");
    return mediaUrl;
  } catch (err) {
    await browser.close();
    throw err;
  }
}

bot.on("text", async (ctx) => {
  const url = ctx.message.text;
  const loadingMsg = await ctx.reply("Fetching media, please wait...");
  try {
    const mediaUrl = await fetchMedia(url);
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
    await ctx.replyWithVideo(mediaUrl);
  } catch (error) {
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);
    await ctx.reply("❌ Error: Could not retrieve media. Make sure the link is valid and fresh.");
  }
});

const app = express();
app.get("/", (req, res) => {
  res.send("🤖 Bot is alive!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Server running on port ${PORT}`);
});

bot.launch().then(() => {
  console.log("🤖 Telegram bot is running");
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
