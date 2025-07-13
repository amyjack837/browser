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
      "--disable-gpu",
    ],
    executablePath:
      process.env.CHROME_EXECUTABLE_PATH || "/usr/bin/chromium-browser",
  });
}

// Fetch media URL from given page using Puppeteer
async function fetchMedia(url) {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    // Adjust the selector here to find the media URL correctly
    const mediaUrl = await page.evaluate(() => {
      // Example: find <video> src
      const video = document.querySelector("video");
      if (video && video.src) return video.src;

      // fallback: find <source> inside video
      const source = document.querySelector("video source");
      if (source && source.src) return source.src;

      return null;
    });

    await browser.close();

    if (!mediaUrl) throw new Error("Media URL not found on page");
    return mediaUrl;
  } catch (error) {
    await browser.close();
    throw error;
  }
}

bot.on("text", async (ctx) => {
  const url = ctx.message.text;

  // Send initial fetching message
  const loadingMsg = await ctx.reply("Fetching media, please wait...");

  try {
    const mediaUrl = await fetchMedia(url);

    // Delete loading message
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

    // Send media to user as video
    await ctx.replyWithVideo(mediaUrl);
  } catch (err) {
    // Delete loading message
    await ctx.telegram.deleteMessage(ctx.chat.id, loadingMsg.message_id);

    // Send error message
    await ctx.reply(
      "❌ Error: Could not retrieve media. Make sure the link is valid and fresh."
    );
  }
});

// Express server to keep bot alive on Render
const app = express();
app.get("/", (req, res) => {
  res.send("🤖 Bot is alive!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Server listening on port ${PORT}`);
});

bot.launch().then(() => {
  console.log("🤖 Telegram bot started");
});

// Graceful shutdown
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
