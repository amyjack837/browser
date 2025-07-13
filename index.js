require('dotenv').config();
const { Telegraf } = require('telegraf');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);

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
    ],
  });

  try {
    const page = await browser.newPage();
    await page.goto(igramUrl, { waitUntil: 'networkidle2' });

    const mediaUrl = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video?.src) return video.src;

      const source = document.querySelector('source');
      if (source?.src) return source.src;

      return null;
    });

    await browser.close();

    if (!mediaUrl) throw new Error('Media URL not found');

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

bot.start((ctx) => ctx.reply('Send me an igram.world link and I will fetch the media for you.'));

bot.on('text', async (ctx) => {
  const url = ctx.message.text.trim();

  if (!url.includes('igram.world/get')) {
    return ctx.reply('Please send a valid igram.world media URL.');
  }

  await ctx.reply('Fetching media, please wait...');

  try {
    const mediaUrl = await getMediaUrlFromIgramLink(url);
    const filename = `media_${Date.now()}.mp4`;
    const filepath = path.join(__dirname, filename);

    await downloadMedia(mediaUrl, filepath);
    await ctx.replyWithVideo({ source: fs.createReadStream(filepath) });
    fs.unlinkSync(filepath);
  } catch (err) {
    console.error(err);
    ctx.reply('Error: Could not retrieve media. Make sure the link is valid and fresh.');
  }
});

bot.launch();
console.log('🤖 Telegram bot is running');
