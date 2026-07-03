# ============================================
# AlamQuant ATTS - Project File Generator (Light)
# ============================================

$projectRoot = Get-Location
Write-Host "Project root: $projectRoot" -ForegroundColor Cyan

# Create required folders
New-Item -ItemType Directory -Force -Path "$projectRoot\api" | Out-Null

# ============================================
# 1. index.html (placeholder)
# ============================================
@"
<!-- Replace this file with the complete final index.html code -->
"@ | Out-File -FilePath "$projectRoot\index.html" -Encoding utf8
Write-Host "Created index.html (placeholder - add your final code manually)" -ForegroundColor Yellow

# ============================================
# 2. api/setup.js (placeholder)
# ============================================
@"
// Replace this file with the complete final api/setup.js code
"@ | Out-File -FilePath "$projectRoot\api\setup.js" -Encoding utf8
Write-Host "Created api/setup.js (placeholder - add your final code manually)" -ForegroundColor Yellow

# ============================================
# 3. server.js
# ============================================
@"
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
import handler from './api/setup.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

async function serveStatic(req, res) {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = filePath.split('?')[0];
  const fullPath = join(__dirname, filePath);
  try {
    const data = await readFile(fullPath);
    const ext = extname(fullPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:3000`);

  if (url.pathname.startsWith('/api/')) {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      const body = Buffer.concat(chunks).toString();
      const webReq = new Request(url, {
        method: req.method,
        headers: req.headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
      });

      try {
        const webRes = await handler(webReq);
        res.writeHead(webRes.status, Object.fromEntries(webRes.headers.entries()));
        if (webRes.body) {
          const reader = webRes.body.getReader();
          const pump = () => reader.read().then(({ done, value }) => {
            if (done) {
              res.end();
            } else {
              res.write(value);
              pump();
            }
          });
          pump();
        } else {
          res.end();
        }
      } catch (err) {
        console.error(err);
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    });
  } else {
    await serveStatic(req, res);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
"@ | Out-File -FilePath "$projectRoot\server.js" -Encoding utf8
Write-Host "Created server.js" -ForegroundColor Green

# ============================================
# 4. sw.js
# ============================================
@"
const CACHE_NAME = 'atts-v5';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  if (event.request.method === 'GET') {
    if (event.request.url.includes('/api/')) {
      event.respondWith(
        fetch(event.request)
          .then(response => {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
            return response;
          })
          .catch(() => caches.match(event.request))
      );
    } else {
      event.respondWith(
        caches.match(event.request).then(cached => cached || fetch(event.request))
      );
    }
  }
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('push', event => {
  let data = { title: 'AlamQuant ATTS', body: 'তোমার আজকের ট্রেডিং জার্নাল তৈরি করো!' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/icon-72.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
"@ | Out-File -FilePath "$projectRoot\sw.js" -Encoding utf8
Write-Host "Created sw.js" -ForegroundColor Green

# ============================================
# 5. manifest.json
# ============================================
@"
{
  "name": "AlamQuant ATTS",
  "short_name": "ATTS",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#030510",
  "theme_color": "#d4af37",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
"@ | Out-File -FilePath "$projectRoot\manifest.json" -Encoding utf8
Write-Host "Created manifest.json" -ForegroundColor Green

# ============================================
# 6. package.json
# ============================================
@"
{
  "name": "atts-project",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js",
    "deploy": "echo 'Deploy to Vercel'"
  },
  "dependencies": {
    "@neondatabase/serverless": "^0.9.0",
    "bcryptjs": "^2.4.3",
    "canvas-confetti": "^1.9.0",
    "chart.js": "^4.4.0",
    "google-auth-library": "^9.0.0",
    "jsonwebtoken": "^9.0.0",
    "uuid": "^9.0.0"
  }
}
"@ | Out-File -FilePath "$projectRoot\package.json" -Encoding utf8
Write-Host "Created package.json" -ForegroundColor Green

# ============================================
# 7. vercel.json
# ============================================
@"
{
  "functions": {
    "api/setup.js": {
      "runtime": "edge"
    }
  },
  "outputDirectory": ".",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/setup" }
  ]
}
"@ | Out-File -FilePath "$projectRoot\vercel.json" -Encoding utf8
Write-Host "Created vercel.json" -ForegroundColor Green

# ============================================
# 8. .env.local (example)
# ============================================
@"
DATABASE_URL=postgresql://neondb_owner:yourpassword@ep-dawn-grass-ahoh2dpq-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=Khushidul@Alam@8596#
ADMIN_SECRET=admin123
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
"@ | Out-File -FilePath "$projectRoot\.env.local" -Encoding utf8
Write-Host "Created .env.local (example)" -ForegroundColor Green

Write-Host "`n✅ All project files generated successfully!" -ForegroundColor Cyan
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Replace index.html and api/setup.js with the final complete versions."
Write-Host "2. Place icon-192.png and icon-512.png in the project root."
Write-Host "3. Run 'npm install' then 'npm start'"