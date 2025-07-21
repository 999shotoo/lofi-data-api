const fs = require('fs');
const path = require('path');
const https = require('https');
const fetch = require('node-fetch');
const youtubedl = require('youtube-dl-exec');

const imgDir = path.join(__dirname, 'images');
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir);

// Helper to download image from URL
function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(dest, () => {});
        return reject(new Error('Failed to get image: ' + response.statusCode));
      }
      response.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      file.close();
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Helper to fetch a wallpaper from Wallhaven for a mood
async function fetchMoodWallpaper(mood, dest) {
  try {
    // Use Wallhaven API to search for wallpapers by mood keyword
    const url = `https://wallhaven.cc/api/v1/search?q=${encodeURIComponent(mood)}&sorting=random&categories=111&purity=100&atleast=1920x1080&ratios=16x9`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.data && data.data.length > 0) {
      const imgUrl = data.data[0].path;
      await downloadImage(imgUrl, dest);
      return imgUrl;
    }
  } catch (err) {
    console.error(`Failed to fetch wallpaper for mood ${mood}:`, err.message);
  }
  return null;
}

// Define some basic mood keywords and their tags
const moodKeywords = [
  { tag: 'sad', keywords: ['sad', 'cry', 'tears', 'alone', 'broken', 'heartbreak'] },
  { tag: 'chill', keywords: ['chill', 'relax', 'calm', 'smooth', 'laid back'] },
  { tag: 'happy', keywords: ['happy', 'smile', 'joy', 'sun', 'bright', 'good vibes'] },
  { tag: 'romantic', keywords: ['love', 'romance', 'kiss', 'heart', 'forever'] },
  { tag: 'study', keywords: ['study', 'focus', 'concentration', 'work', 'productive'] },
  { tag: 'sleep', keywords: ['sleep', 'dream', 'night', 'midnight', 'rest'] },
  { tag: 'rainy', keywords: ['rain', 'rainy', 'storm', 'cloud', 'drizzle'] },
  { tag: 'jazzy', keywords: ['jazz', 'jazzy', 'sax', 'blues'] },
  { tag: 'beats', keywords: ['beat', 'beats', 'instrumental', 'groove'] },
  { tag: 'nostalgic', keywords: ['nostalgia', 'nostalgic', 'memory', 'memories', 'old'] },
  { tag: 'anime', keywords: ['anime', 'otaku', 'japan', 'japanese'] },
  { tag: 'ambient', keywords: ['ambient', 'atmosphere', 'space', 'ethereal'] }
];

function detectMood(title) {
  const lower = title.toLowerCase();
  for (const mood of moodKeywords) {
    for (const kw of mood.keywords) {
      if (lower.includes(kw)) return mood.tag;
    }
  }
  return 'lofi'; // default mood
}

(async () => {
  // Read playlist.json (array of URLs)
  let urls;
  try {
    urls = JSON.parse(fs.readFileSync('playlist.json', 'utf8'));
    if (!Array.isArray(urls)) throw new Error();
  } catch {
    console.error('Could not read playlist.json or format is invalid');
    process.exit(1);
  }

  const total = urls.length;

  // Prepare lofi.json
  let lofi = [];
  if (fs.existsSync('lofi.json')) {
    try {
      lofi = JSON.parse(fs.readFileSync('lofi.json', 'utf8'));
      if (!Array.isArray(lofi)) lofi = [];
    } catch {
      lofi = [];
    }
  }
  const existingIds = new Set(lofi.map(e => e.id));
  const moodMap = {};
  const moodMeta = {};

  // Process each video sequentially with progress
  for (let i = 0; i < total; i++) {
  // Wait 1 second between requests to avoid timeouts
  await new Promise(res => setTimeout(res, 1000));

    const url = urls[i];
    // Skip if URL already exists in lofi.json
    if (lofi.some(entry => entry.file === url)) {
      console.log(`[${i + 1}/${total}] Skipping (already exists): ${url}`);
      continue;
    }
    // Generate unique ID FIRST
    let id;
    do {
      id = Math.floor(10000 + Math.random() * 90000).toString();
    } while (existingIds.has(id));
    existingIds.add(id);
    try {
      console.log(`[${i + 1}/${total}] Fetching info: ${url}`);
      const info = await youtubedl(url, {
        dumpSingleJson: true,
        noCheckCertificates: true,
        noWarnings: true,
        preferFreeFormats: true,
        addHeader: [
          'referer:youtube.com',
          'user-agent:googlebot'
        ]
      });


  
      const imgRelPath = `images/${id}.jpg`;
      if (!fs.existsSync(imgRelPath)) {
        try {
          await downloadImage(info.thumbnail, imgRelPath);
        } catch {
          console.error(`Failed to download thumbnail from info.thumbnail for video ${videoId}`);
        }
      }

      // Detect mood
      const mood = detectMood(info.title);

      // Save minimal metadata with local image path (by id)
      const entry = {
        id,
        title: info.title,
        description: info.description,
        file: url,
        image: imgRelPath,
        duration: info.duration,
        mood
      };
      lofi.push(entry);

      // Map mood to song id
      if (!moodMap[mood]) moodMap[mood] = [];
      moodMap[mood].push(id);

      // If mood metadata not set, fetch a wallpaper and save meta
      if (!moodMeta[mood]) {
        const moodWallpaperPath = path.join(imgDir, `mood_${mood}.jpg`);
        let wallpaperUrl = null;
        if (!fs.existsSync(moodWallpaperPath)) {
          wallpaperUrl = await fetchMoodWallpaper(mood, moodWallpaperPath);
        } else {
          wallpaperUrl = null;
        }
        moodMeta[mood] = {
          mood,
          wallpaper: `images/mood_${mood}.jpg`,
          wallpaperSource: wallpaperUrl,
          description: `Wallpaper for mood '${mood}' fetched from Wallhaven.`
        };
      }

      console.log(`[${i + 1}/${total}] Saved: ${info.title} [${mood}]`);
    } catch (err) {
      console.error(`[${i + 1}/${total}] Error: ${url}:`, err.message || err);
    }

    // Save after every fetch
    fs.writeFileSync('lofi.json', JSON.stringify(lofi, null, 2));
    fs.writeFileSync('mood.json', JSON.stringify(moodMap, null, 2));
    fs.writeFileSync('mood_meta.json', JSON.stringify(moodMeta, null, 2));
    console.log(`Progress: ${i + 1}/${total} videos processed, ${total - (i + 1)} remaining.`);
  }

  fs.writeFileSync('lofi.json', JSON.stringify(lofi, null, 2));
  fs.writeFileSync('mood.json', JSON.stringify(moodMap, null, 2));
  fs.writeFileSync('mood_meta.json', JSON.stringify(moodMeta, null, 2));
  console.log('All videos processed. Info saved to lofi.json and mood.json');
})();