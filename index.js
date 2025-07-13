require('dotenv').config();
const { Telegraf } = require('telegraf');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);

async function getMediaUrlFromIgramLink(igramUrl) {
  // Puppeteer launch with flags suitable for Railway or cloud
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
    ],
  });

  try {
    const page = await browser.newPage();

    // Go to the igram URL (the "get" link you have)
    await page.goto(igramUrl, { waitUntil: 'networkidle2' });

    // Wait a bit if necessary for JS to load media URL
    // Example: grab all video or audio tags src attributes
    const mediaUrl = await page.evaluate(() => {
      // Look for <video> or <source> tags
      const video = document.querySelector('video');
      if (video && video.src) return video.src;

      const source = document.querySelector('source');
      if (source && source.src) return source.src;

      // Or look for meta tags, scripts, etc — adjust as needed
      return null;
    });

    await browser.close();

    if (!mediaUrl) {
      throw new Error('Media URL not found on page');
    }

    return mediaUrl;
  } catch (err) {
    await browser.close();
    throw err;
  }
}

async function downloadMedia(url, filename) {
  const writer = fs.createWriteStream(filename);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

bot.start((ctx) => ctx.reply('Send me your igram.world media link, and I will fetch the media for you!'));

bot.on('text', async (ctx) => {
  const text = ctx.message.text.trim();

  if (!text.includes('igram.world/get')) {
    return ctx.reply('Please send a valid igram.world/get URL.');
  }

  await ctx.reply('Processing your media, please wait...');

  try {
    const mediaUrl = await getMediaUrlFromIgramLink(text);

    const filename = `downloaded_media_${Date.now()}.mp4`; // or .jpg for images if needed
    const filepath = path.join(__dirname, filename);

    await downloadMedia(mediaUrl, filepath);

    // Send the downloaded file to Telegram chat
    await ctx.replyWithVideo({ source: fs.createReadStream(filepath) });

    // Clean up local file after sending
    fs.unlinkSync(filepath);
  } catch (err) {
    console.error('Error:', err);
    await ctx.reply('Failed to fetch or send the media. Make sure the link is fresh and valid.');
  }
});

bot.launch();

console.log('Telegram bot is up and running!');
