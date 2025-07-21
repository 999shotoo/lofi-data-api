const youtubedl = require('youtube-dl-exec');

const url = 'https://www.youtube.com/watch?v=jfKfPfyJRdk'; // Replace with a live stream URL if needed

const startTime = process.hrtime.bigint();

youtubedl(url, {
  getUrl: true,
  format: 'best[ext=m3u8]/best',
  noPlaylist: true,
  noCheckCertificates: true,
  noWarnings: true,
  addHeader: [
    'referer:youtube.com',
    'user-agent:googlebot'
  ]
}).then(hlsUrl => {
  const endTime = process.hrtime.bigint();
  const timeTakenMs = Number(endTime - startTime) / 1e6;
  console.log(`HLS (m3u8) URL: ${hlsUrl.trim()}`);
  console.log(`Time taken: ${timeTakenMs.toFixed(0)} ms`);
}).catch(err => {
  console.error('Failed to get HLS URL:', err);
});