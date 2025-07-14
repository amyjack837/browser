require('dotenv').config();
const { Telegraf } = require('telegraf');
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Initialize the bot with your token
const bot = new Telegraf(process.env.BOT_TOKEN);

// 🧠 Extract media URL (image or video) from the provided link
async function getMediaUrlFromIgramLink(igramUrl) {
  const browser = await puppeteer.connect({
    browserWSEndpoint: `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}`,
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.1 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
    });

    await page.goto(igramUrl, { waitUntil: 'networkidle2', timeout: 0 });
    await page.waitForTimeout(2000);

    // Check for video or image links
    const mediaUrl = await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video?.src) return { type: 'video', url: video.src };

      const image = document.querySelector('img');
      if (image?.src) return { type: 'image', url: image.src };

      const source = document.querySelector('source');
      if (source?.src) return { type: 'video', url: source.src };

      const link = document.querySelector('a[download]');
      if (link?.href) return { type: 'video', url: link.href };

      return null;
    });

    await browser.close();

    if (!mediaUrl || !mediaUrl.url.startsWith('http')) {
      throw new Error('Media URL not found.');
    }

    return mediaUrl;
  } catch (err) {
    await browser.close();
    throw err;
  }
}

// 📥 Download media (image or video) to a temporary file
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

  await ctx.reply('⏳ Fetching media, please wait...');

  try {
    let mediaData;

    // 👀 Direct media link: skip Puppeteer
    if (url.includes('sf-converter.com') || url.includes('media.igram.world')) {
      mediaData = { type: 'video', url: url };
    } else {
      mediaData = await getMediaUrlFromIgramLink(url);
    }

    const filename = `media_${Date.now()}.${mediaData.type === 'video' ? 'mp4' : 'jpg'}`;
    const filepath = path.join(__dirname, filename);

    // Download the media file (video or image)
    await downloadMedia(mediaData.url, filepath);

    // Respond with the appropriate media type
    if (mediaData.type === 'video') {
      await ctx.replyWithVideo({ source: fs.createReadStream(filepath) });
    } else if (mediaData.type === 'image') {
      await ctx.replyWithPhoto({ source: fs.createReadStream(filepath) });
    }

    fs.unlinkSync(filepath); // cleanup
  } catch (err) {
    console.error('❌ Error fetching media:', err.message);
    ctx.reply('⚠️ Error: Could not retrieve media. Make sure the link is valid, fresh, and contains video or image.');
  }
});

// 🚀 Launch the bot
bot.launch();
console.log('🤖 Telegram bot is running...');
