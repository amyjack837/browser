require('dotenv').config();
const { Telegraf } = require('telegraf');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);

// 🧠 Extract media URL using Puppeteer if needed
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
      // Try video first
      const video = document.querySelector('video');
      if (video?.src) return video.src;

      const source = document.querySelector('source');
      if (source?.src) return source.src;

      // Try gif animation or image
      const gif = document.querySelector('img[src$=".gif"]');
      if (gif?.src) return gif.src;

      const image = document.querySelector('img');
      if (image?.src) return image.src;

      // Link with download attribute
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

// 📥 Download media to temp file
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

// Helper to get file extension from URL
function getFileExtensionFromUrl(url) {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase();
    return ext.split('?')[0]; // Remove any query params
  } catch {
    return ''; // Invalid URL
  }
}

// 🤖 Bot command logic
bot.start((ctx) => ctx.reply('Send me a media link from igram.world or sf-converter.com and I\'ll send you the media.'));

bot.on('text', async (ctx) => {
  const url = ctx.message.text.trim();

  if (
    !url.includes('igram.world') &&
    !url.includes('sf-converter.com') &&
    !url.includes('media.igram.world')
  ) {
    return ctx.reply('❌ Please send a valid media link from igram.world or sf-converter.com.');
  }

  // Send the "fetching" message and store the message ID
  const fetchingMessage = await ctx.reply('⏳ Fetching media, please wait...');

  // Delete the "fetching" message after 3 seconds
  setTimeout(() => {
    ctx.deleteMessage(fetchingMessage.message_id).catch(() => {}); // catch if already deleted
  }, 3000);

  try {
    let mediaUrl;

    // 👀 Direct media link: skip Puppeteer
    if (url.includes('sf-converter.com') || url.includes('media.igram.world')) {
      mediaUrl = url;
    } else {
      mediaUrl = await getMediaUrlFromIgramLink(url);
    }

    const fileExt = getFileExtensionFromUrl(mediaUrl);

    const videoExts = ['.mp4', '.mov', '.avi', '.mkv', '.webm'];
    const imageExts = ['.jpg', '.jpeg', '.png', '.bmp', '.webp'];
    const audioExts = ['.mp3', '.m4a', '.ogg', '.wav', '.flac', '.aac'];
    const animationExts = ['.gif'];

    const allSupported = [...videoExts, ...imageExts, ...audioExts, ...animationExts];

    if (!allSupported.includes(fileExt)) {
      return ctx.reply(`⚠️ Unsupported media type: ${fileExt || 'unknown'}`);
    }

    const filename = `media_${Date.now()}${fileExt}`;
    const filepath = path.join(__dirname, filename);

    await downloadMedia(mediaUrl, filepath);

    const mediaStream = { source: fs.createReadStream(filepath) };

    try {
      if (videoExts.includes(fileExt)) {
        await ctx.replyWithVideo(mediaStream);
      } else if (imageExts.includes(fileExt)) {
        await ctx.replyWithPhoto(mediaStream);
      } else if (animationExts.includes(fileExt)) {
        await ctx.replyWithAnimation(mediaStream);
      } else if (audioExts.includes(fileExt)) {
        await ctx.replyWithAudio(mediaStream);
      } else {
        await ctx.reply('⚠️ Media type detected but not handled.');
      }
    } finally {
      fs.unlinkSync(filepath); // Cleanup
    }

  } catch (err) {
    console.error('❌ Error fetching media:', err.message);
    ctx.reply('⚠️ Error: Could not retrieve media. Make sure the link is valid, fresh, and contains supported media.');
  }
});

// 🚀 Launch the bot
bot.launch();
console.log('🤖 Telegram bot is running...');
