import dotenv from 'dotenv';
import { Telegraf } from 'telegraf';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

// Load environment variables from the .env file
dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// 🧠 Extract video URL using Puppeteer if needed
async function getMediaUrlFromIgramLink(igramUrl) {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.1 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    await page.goto(igramUrl, { waitUntil: 'networkidle2', timeout: 0 });
    await page.waitForTimeout(2000);

    const mediaUrl = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video?.src) return video.src;

      const source = document.querySelector('source');
      if (source?.src) return source.src;

      const link = document.querySelector('a[download]');
      if (link?.href) return link.href;

      return null;
    });

    await browser.close();

    if (!mediaUrl || !mediaUrl.startsWith('http')) {
      throw new Error('Media URL not found.');
    }

    return mediaUrl;
  } catch (err) {
    await browser.close();
    throw err;
  }
}

// 📥 Download video to temp file
async function downloadMedia(url, filename) {
  const writer = fs.createWriteStream(filename);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream'
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

// 🤖 Bot command logic
bot.start((ctx) => ctx.reply('Send me a media link from igram.world or sf-converter.com and I\'ll send you the video.'));

bot.on('text', async (ctx) => {
  const url = ctx.message.text.trim();

  if (
    !url.includes('igram.world') &&
    !url.includes('sf-converter.com') &&
    !url.includes('media.igram.world')
  ) {
    return ctx.reply('❌ Please send a valid media link from igram.world or sf-converter.com.');
  }

  const replyMessage = await ctx.reply('⏳ Fetching media, please wait...');

  setTimeout(() => {
    // Delete the fetching message after 3 seconds
    ctx.telegram.deleteMessage(ctx.chat.id, replyMessage.message_id);
  }, 3000);

  try {
    let mediaUrl;

    // 👀 Direct media link: skip Puppeteer
    if (url.includes('sf-converter.com') || url.includes('media.igram.world')) {
      mediaUrl = url;
    } else {
      mediaUrl = await getMediaUrlFromIgramLink(url);
    }

    const filename = `media_${Date.now()}.mp4`;
    const filepath = path.join(__dirname, filename);

    await downloadMedia(mediaUrl, filepath);

    await ctx.replyWithVideo({ source: fs.createReadStream(filepath) });

    fs.unlinkSync(filepath); // cleanup
  } catch (err) {
    console.error('❌ Error fetching media:', err.message);
    ctx.reply('⚠️ Error: Could not retrieve media. Make sure the link is valid, fresh, and contains video.');
  }
});

// 🚀 Launch the bot
bot.launch();
console.log('🤖 Telegram bot is running...');
