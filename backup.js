const fs = require('fs');
const path = require('path');
const youtubedl = require('youtube-dl-exec');
const fetch = require('node-fetch');

const mp3Dir = path.join(__dirname, 'mp3');
const imgDir = path.join(__dirname, 'images');
if (!fs.existsSync(mp3Dir)) fs.mkdirSync(mp3Dir);
if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir);

// Generate a unique 5-digit ID
function generateId(existingIds) {
  let id;
  do {
    id = Math.floor(10000 + Math.random() * 90000).toString();
  } while (existingIds.has(id));
  return id;
}

async function processLink(video, existingIds, lofi, index, total) {
  try {
    console.log(`[${index + 1}/${total}] Processing: ${video.url}`);
    console.log(`[${index + 1}/${total}] Fetching video info...`);
    const info = await youtubedl(video.url, {
      dumpSingleJson: true,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:googlebot'
      ]
    });
    console.log(`[${index + 1}/${total}] Video info fetched.`);

    // Generate unique ID
    const id = generateId(existingIds);
    existingIds.add(id);

    // Download thumbnail
    const imgUrl = info.thumbnail;
    const imgPath = path.join('images', `${id}.png`);
    console.log(`[${index + 1}/${total}] Downloading thumbnail...`);
    const imgRes = await fetch(imgUrl);
    if (!imgRes.ok) throw new Error('Failed to download thumbnail');
    const imgBuffer = await imgRes.buffer();
    fs.writeFileSync(path.join(__dirname, imgPath), imgBuffer);
    console.log(`[${index + 1}/${total}] Thumbnail saved.`);

    // Download audio as mp3
    const mp3Path = path.join('mp3', `${id}.mp3`);
    console.log(`[${index + 1}/${total}] Downloading audio...`);
    await youtubedl(video.url, {
      extractAudio: true,
      audioFormat: 'mp3',
      audioQuality: 0,
      output: path.join(__dirname, mp3Path)
    });
    console.log(`[${index + 1}/${total}] Audio saved.`);

    // Save metadata
    const entry = {
      id,
      title: info.title,
      description: info.description,
      thumbnail: imgPath.replace(/\\/g, '/'),
      mp3: mp3Path.replace(/\\/g, '/'),
      url: video.url,
      duration: video.duration,
      seconds: video.seconds,
      date: new Date().toISOString()
    };
    lofi.push(entry);
    console.log(`[${index + 1}/${total}] Done: ${video.url} -> ID: ${id}`);
  } catch (err) {
    console.error(`[${index + 1}/${total}] Error processing ${video.url}:`, err.message || err);
  }
}

(async () => {
  // Read playlist.json
  let playlistData;
  try {
    playlistData = JSON.parse(fs.readFileSync('playlist.json', 'utf8'));
  } catch {
    console.error('Could not read playlist.json');
    process.exit(1);
  }

  const videos = Array.isArray(playlistData.videos) ? playlistData.videos : [];
  const total = videos.length;

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

  // Process each video sequentially with progress
  for (let i = 0; i < total; i++) {
    const video = videos[i];
    await processLink(video, existingIds, lofi, i, total);
    fs.writeFileSync('lofi.json', JSON.stringify(lofi, null, 2));
    console.log(`Progress: ${i + 1}/${total} videos processed, ${total - (i + 1)} remaining.`);
  }

  console.log('All videos processed. Metadata saved to lofi.json');
})();