const { put, del, list } = require('@vercel/blob');

const TOKEN = process.env.VERCEL_BLOB_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
if (!TOKEN) console.warn('⚠️ VERCEL_BLOB_READ_WRITE_TOKEN not set. Uploads will fail.');

function getBlobOptions() {
  return {
    access: 'public',   // ✅ store is public, so we must use public
    token: TOKEN,
    cacheControl: 'public, max-age=60'
  };
}

async function uploadFile(buffer, fileName, contentType = 'application/pdf') {
  const blob = await put(`certificates/${Date.now()}-${fileName}`, buffer, {
    ...getBlobOptions(),
    contentType
  });
  return blob.url;
}

async function deleteFile(url) {
  try { await del(url, { token: TOKEN }); return true; }
  catch (e) { console.error('Blob delete error:', e); return false; }
}

async function listFiles(prefix = 'certificates/') {
  const { blobs } = await list({ prefix, token: TOKEN });
  return blobs.map(b => ({ url: b.url, size: b.size, uploadedAt: b.uploadedAt }));
}

async function uploadCandles(symbol, candles, tf = 60) {
  const key = `candles_${symbol}_${tf}.json`;
  const blob = await put(key, JSON.stringify(candles), {
    ...getBlobOptions(),
    contentType: 'application/json'
  });
  return blob.url;
}

module.exports = { uploadFile, deleteFile, listFiles, uploadCandles };
