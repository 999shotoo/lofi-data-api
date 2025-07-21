const fs = require('fs');
const path = require('path');
const youtubedl = require('youtube-dl-exec');

const imgDir = path.join(__dirname, 'images');
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir);

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

  // Process each video sequentially with progress
  for (let i = 0; i < total; i++) {
    const url = urls[i];
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

      // Generate unique ID
      let id;
      do {
        id = Math.floor(10000 + Math.random() * 90000).toString();
      } while (existingIds.has(id));
      existingIds.add(id);

      // Detect mood
      const mood = detectMood(info.title);

      // Save minimal metadata
      const entry = {
        id,
        title: info.title,
        description: info.description,
        file: url,
        image: info.thumbnail,
        duration: info.duration,
        mood
      };
      lofi.push(entry);

      // Map mood to song id
      if (!moodMap[mood]) moodMap[mood] = [];
      moodMap[mood].push(id);

      console.log(`[${i + 1}/${total}] Saved: ${info.title} [${mood}]`);
    } catch (err) {
      console.error(`[${i + 1}/${total}] Error: ${url}:`, err.message || err);
    }
    fs.writeFileSync('lofi.json', JSON.stringify(lofi, null, 2));
    fs.writeFileSync('mood.json', JSON.stringify(moodMap, null, 2));
    console.log(`Progress: ${i + 1}/${total} videos processed, ${total - (i + 1)} remaining.`);
  }

  console.log('All videos processed. Info saved to lofi.json and mood.json');
})();