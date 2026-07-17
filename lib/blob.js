const { put, del, list } = require('@vercel/blob');

const TOKEN = process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
if (!TOKEN) console.warn('⚠️ VERCEL_BLOB_READ_WRITE_TOKEN not set. Uploads will fail.');

async function uploadFile(buffer, fileName, contentType = 'application/pdf') {
  const blob = await put(`certificates/${Date.now()}-${fileName}`, buffer, {
    access: 'public',
    contentType
  });
  return blob.url;
}

async function deleteFile(url) {
  try { await del(url); return true; }
  catch (e) { console.error('Blob delete error:', e); return false; }
}

async function listFiles(prefix = 'certificates/') {
  const { blobs } = await list({ prefix });
  return blobs.map(b => ({ url: b.url, size: b.size, uploadedAt: b.uploadedAt }));
}

module.exports = { uploadFile, deleteFile, listFiles };
