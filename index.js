import { Telegraf } from "telegraf";
import puppeteer from "puppeteer-core";
import chromium from "chrome-aws-lambda"; // lightweight chromium for Render/AWS env

const bot = new Telegraf(process.env.BOT_TOKEN);

async function fetchMedia(url) {
  let browser = null;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath,
      headless: chromium.headless,
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2" });

    // Dummy selector: update this based on your actual page & media extraction logic
    const mediaUrl = await page.evaluate(() => {
      // Example: get first video src
      const video = document.querySelector("video");
      return video ? video.src : null;
    });

    return mediaUrl;
  } catch (err) {
    console.error("Puppeteer fetch error:", err);
    return null;
  } finally {
    if (browser) await browser.close();
  }
}

bot.start((ctx) => ctx.reply("Send me an Instagram media link to fetch!"));

bot.on("text", async (ctx) => {
  const url = ctx.message.text.trim();
  await ctx.reply("Fetching media, please wait...");

  const mediaLink = await fetchMedia(url);

  if (!mediaLink) {
    return ctx.reply("❌ Could not retrieve media. Make sure the link is valid and fresh.");
  }

  // Send video or photo (adapt as needed)
  if (mediaLink.endsWith(".mp4")) {
    await ctx.replyWithVideo(mediaLink);
  } else {
    await ctx.replyWithPhoto(mediaLink);
  }
});

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
