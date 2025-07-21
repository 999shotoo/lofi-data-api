const fs = require('fs');
const puppeteer = require('puppeteer');

function getPlaylistId(url) {
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : 'playlist';
}

async function autoScroll(page) {
  let lastCount = 0;
  let sameCount = 0;
  while (sameCount < 5) {
    const currCount = await page.evaluate(() =>
      document.querySelectorAll('ytd-playlist-video-renderer').length
    );
    await page.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
    await new Promise(r => setTimeout(r, 1200));
    const newCount = await page.evaluate(() =>
      document.querySelectorAll('ytd-playlist-video-renderer').length
    );
    if (newCount === currCount) {
      sameCount++;
    } else {
      sameCount = 0;
    }
    lastCount = newCount;
  }
}

async function extractUrlsFromPlaylist(page) {
  return await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('ytd-playlist-video-renderer'));
    return items.map(item => {
      const href = item.querySelector('#video-title')?.getAttribute('href');
      if (!href) return null;
      // Extract v=VIDEO_ID
      const match = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      return match ? `https://www.youtube.com/watch?v=${match[1]}` : null;
    }).filter(Boolean);
  });
}

(async () => {
  // Read playlist URLs from playlists.txt
  let playlistUrls;
  try {
    playlistUrls = fs.readFileSync('playlists.txt', 'utf8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));
  } catch {
    console.error('Could not read playlists.txt');
    process.exit(1);
  }

  const browser = await puppeteer.launch({ headless: "new" });
  let allUrls = [];

  for (const url of playlistUrls) {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2' });
    await autoScroll(page);
    const urls = await extractUrlsFromPlaylist(page);
    allUrls.push(...urls);
    console.log(`Extracted ${urls.length} URLs from playlist: ${url}`);
    await page.close();
  }

  await browser.close();

  // Remove duplicates
  allUrls = Array.from(new Set(allUrls));

  fs.writeFileSync('playlist.json', JSON.stringify(allUrls, null, 2));
  console.log(`Saved ${allUrls.length} unique video URLs to playlist.json`);
})();