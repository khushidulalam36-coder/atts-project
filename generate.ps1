# ============================================
# AlamQuant ATTS - Production-Ready File Generator
# ============================================
# This script creates all necessary project files.
# IMPORTANT: After running this script, you must set environment variables
# and initialize the database.
# ============================================

$projectRoot = Get-Location
Write-Host "Project root: $projectRoot" -ForegroundColor Cyan

# Create required folders
New-Item -ItemType Directory -Force -Path "$projectRoot\api" | Out-Null

# ============================================
# 1. vercel.json (with charset headers & verify route)
# ============================================
$vercelJson = @'
{
  "headers": [
    {
      "source": "/(.*).html",
      "headers": [
        { "key": "Content-Type", "value": "text/html; charset=utf-8" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/setup" },
    { "source": "/admin", "destination": "/admin.html" },
    { "source": "/verify", "destination": "/verify.html" }
  ]
}
'@
$vercelJson | Out-File -FilePath "$projectRoot\vercel.json" -Encoding utf8
Write-Host "Created vercel.json" -ForegroundColor Green

# ============================================
# 2. package.json
# ============================================
$packageJson = @'
{
  "name": "atts-project",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "@neondatabase/serverless": "^0.9.0",
    "bcryptjs": "^2.4.3",
    "canvas-confetti": "^1.9.0",
    "chart.js": "^4.4.0",
    "google-auth-library": "^9.0.0",
    "jsonwebtoken": "^9.0.0",
    "uuid": "^9.0.0",
    "dotenv": "^16.3.1",
    "@vercel/blob": "^0.15.0",
    "openai": "^4.0.0",
    "busboy": "^1.6.0"
  }
}
'@
$packageJson | Out-File -FilePath "$projectRoot\package.json" -Encoding utf8
Write-Host "Created package.json" -ForegroundColor Green

# ============================================
# 3. styles.css (Enterprise Premium Theme)
# ============================================
$stylesCss = @'
/* AlamQuant ATTS Premium Enterprise Styles */
:root {
  --bg: #020617;
  --surface: rgba(15, 23, 42, 0.85);
  --gold: #eab308;
  --gold-bright: #facc15;
  --gold-light: #fef08a;
  --accent: #38bdf8;
  --accent-bright: #7dd3fc;
  --accent2: #f43f5e;
  --purple: #a78bfa;
  --cyan: #22d3ee;
  --orange: #fb923c;
  --text: #f1f5f9;
  --text-secondary: #94a3b8;
  --danger: #ef4444;
  --success: #22c55e;
  --warning: #f59e0b;
  --border-gold: rgba(234,179,8,0.5);
  --border-accent: rgba(56,189,248,0.4);
  --radius: 16px;
  --radius-sm: 10px;
  --transition: 0.25s cubic-bezier(0.4,0,0.2,1);
  --glow-gold: 0 0 30px rgba(234,179,8,0.5);
  --glow-accent: 0 0 25px rgba(56,189,248,0.5);
  --bg-gradient: linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%);
  --font-en: 'Inter', sans-serif;
}

* { margin:0; padding:0; box-sizing:border-box; }

/* Keyframes */
@keyframes spin { 100% { transform:rotate(360deg); } }
@keyframes bounceIn {
  0% { transform:scale(0); opacity:0; }
  60% { transform:scale(1.15); opacity:1; }
  100% { transform:scale(1); }
}
@keyframes pulse {
  0% { transform:scale(1); }
  50% { transform:scale(1.08); text-shadow:0 0 20px #ff9100; }
  100% { transform:scale(1); }
}
@keyframes float {
  0%,100% { transform:translateY(0px); }
  50% { transform:translateY(-10px); }
}
@keyframes bgSlide {
  0% { background-position:0% 50%; }
  50% { background-position:100% 50%; }
  100% { background-position:0% 50%; }
}
@keyframes shine {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes floatUp {
  0% { opacity:1; transform:translate(-50%,0) scale(0.5); }
  100% { opacity:0; transform:translate(-50%,-80px) scale(1.2); }
}
@keyframes ripple {
  to { transform: scale(4); opacity: 0; }
}
@keyframes shootStar {
  0% { opacity:0; transform: translate(0,0) scale(0.5); }
  50% { opacity:1; }
  100% { opacity:0; transform: translate(200px,-200px) scale(0); }
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

body {
  font-family: var(--font-en), 'Inter', 'Hind Siliguri', sans-serif;
  background: var(--bg-gradient);
  background-size: 400% 400%;
  animation: bgSlide 30s ease infinite;
  color: var(--text);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100vh;
  padding-bottom: 130px;
  overflow-x: hidden;
  position: relative;
}

.container { width:100%; max-width:960px; padding:16px; z-index:1; position:relative; }

.glass {
  background: rgba(15, 23, 42, 0.7);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid var(--border-gold);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 0 15px rgba(255,255,255,0.02);
  border-radius: var(--radius);
  padding: 20px;
  margin-bottom: 18px;
  transition: all var(--transition);
}
.glass:hover {
  border-color: var(--gold-bright);
  box-shadow: 0 12px 40px rgba(0,0,0,0.6), var(--glow-gold);
  transform: translateY(-2px);
}

h1, h2, h3, h4 {
  background: linear-gradient(135deg, var(--gold-bright), var(--gold));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: none;
  font-weight: 800;
  margin-bottom: 12px;
}
h2 { font-size:1.6rem; }
h3 { font-size:1.25rem; }

.btn {
  background: linear-gradient(135deg, var(--gold), #ca8a04);
  color: #020617;
  border:none;
  padding:10px 22px;
  border-radius:30px;
  font-weight:600;
  cursor:pointer;
  transition: all 0.25s ease;
  font-size:0.9rem;
  box-shadow: 0 4px 15px rgba(234,179,8,0.4);
  letter-spacing:0.5px;
  position:relative;
  overflow:hidden;
  z-index:1;
  font-family:var(--font-en), 'Inter', sans-serif;
}
.btn:hover {
  box-shadow: 0 6px 20px rgba(234,179,8,0.7);
  transform:translateY(-1px);
}
.btn:active { transform:scale(0.97); }

.btn-outline { background:transparent; border:2px solid var(--gold); color:var(--gold); box-shadow:none; }
.btn-outline:hover { background:rgba(242,199,68,0.1); }

.btn-accent {
  background: linear-gradient(135deg, var(--accent), #0284c7);
  box-shadow:0 4px 15px rgba(56,189,248,0.4);
}
.btn-danger {
  background: linear-gradient(135deg, var(--danger), #b91c1c);
  box-shadow:0 4px 15px rgba(239,68,68,0.4);
}
.btn-sm { padding:6px 16px; font-size:0.8rem; border-radius:20px; }
.btn-lg { padding:16px 32px; font-size:1.1rem; border-radius:40px; }

input, textarea, select {
  background: rgba(255,255,255,0.08);
  border: 1px solid var(--border-gold);
  color: var(--text);
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  width:100%;
  margin:6px 0;
  font-family:inherit;
  transition: var(--transition);
  outline:none;
  font-size:0.95rem;
}
input:focus, textarea:focus, select:focus {
  border-color: var(--gold-bright);
  box-shadow: 0 0 0 3px rgba(234,179,8,0.2), var(--glow-gold);
  background: rgba(255,255,255,0.12);
}

textarea { resize:vertical; min-height:60px; }

.grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.flex { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.hidden { display:none !important; }

.bottom-nav {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(25px);
  border-radius: 50px; padding: 8px 25px; display: flex; gap: 10px;
  border: 1px solid var(--border-gold);
  box-shadow: 0 10px 40px rgba(0,0,0,0.8);
  z-index: 100;
}
.nav-item {
  flex-direction: column; align-items: center; font-size: 10px; color: var(--text-secondary);
  transition: 0.3s; cursor: pointer; padding: 4px 6px;
}
.nav-item span { font-size: 20px; transition: 0.3s; }
.nav-item.active { color: var(--gold-bright); text-shadow: 0 0 10px var(--gold-bright); }
.nav-item.active span { transform: translateY(-4px) scale(1.2); }
.nav-item.active::after {
  content: ''; position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%);
  width: 24px; height: 3px; background: var(--gold-bright); border-radius: 3px; box-shadow: 0 0 12px var(--gold-bright);
}

.badge {
  background:linear-gradient(135deg, var(--gold), var(--gold-bright));
  color:#020617;
  padding:4px 12px;
  border-radius:20px;
  font-weight:700;
  font-size:12px;
  display:inline-flex;
  align-items:center;
  gap:4px;
}
.badge-accent { background:linear-gradient(135deg, var(--accent), var(--accent-bright)); }

.progress-bar {
  background: rgba(255,255,255,0.1);
  border-radius:20px;
  height:14px;
  overflow:hidden;
  margin:10px 0;
}
.progress-fill {
  height:100%;
  background: linear-gradient(90deg, var(--gold), #ffaa00);
  border-radius: 20px;
  box-shadow: 0 0 10px var(--gold);
  width:0%;
  transition: width 1.2s cubic-bezier(0.4,0,0.2,1);
}

.chart-container { margin-top:20px; max-height:280px; position:relative; z-index:1; }

.phase-tag {
  background:var(--gold); color:#020617;
  padding:5px 16px; border-radius:20px; font-weight:700; font-size:0.85rem;
  display:inline-block;
}

.modal-overlay {
  position:fixed; top:0; left:0; right:0; bottom:0;
  background:rgba(0,0,0,0.85); display:flex;
  align-items:center; justify-content:center;
  z-index:10000; backdrop-filter:blur(4px);
}
.modal-content { max-width:90vw; max-height:85vh; overflow-y:auto; width:500px; }

.gold-text {
  background:linear-gradient(135deg, var(--gold-bright) 0%, var(--gold-light) 100%);
  -webkit-background-clip:text;
  background-clip: text;
  -webkit-text-fill-color:transparent;
}

.skeleton {
  background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius-sm);
  height: 80px;
}

/* Quiz alignment */
.quiz-option { display: flex; align-items: center; gap: 10px; padding: 4px 0; }
.quiz-option input[type="radio"] { width: auto; margin: 0; accent-color: var(--gold); }
.quiz-option label { flex: 1; cursor: pointer; color: var(--text); }
.question-block { background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 16px; }

/* Tables */
.admin-table {
  width: 100%;
  border-collapse: collapse;
  background: rgba(255,255,255,0.03);
  border-radius: var(--radius-sm);
  overflow: hidden;
  margin-top: 16px;
}
.admin-table th {
  background: rgba(234,179,8,0.15);
  color: var(--gold-bright);
  font-weight: 600;
  padding: 12px;
  text-align: left;
}
.admin-table td {
  padding: 10px 12px;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  color: var(--text);
}
.admin-table tr:hover td {
  background: rgba(255,255,255,0.05);
}

@media (max-width:640px) {
  .grid-2 { grid-template-columns:1fr; }
  .glass { padding:16px; }
  h2 { font-size:1.3rem; }
  .bottom-nav { padding: 4px 10px; gap: 6px; }
  .nav-item span { font-size: 18px; }
}
'@
$stylesCss | Out-File -FilePath "$projectRoot\styles.css" -Encoding utf8
Write-Host "Created styles.css (Enterprise Premium Theme)" -ForegroundColor Green

# ============================================
# 4. sw.js (Service Worker)
# ============================================
$swJs = @'
const CACHE_NAME = 'atts-v8';
const STATIC_ASSETS = ['/', '/index.html', '/styles.css', '/manifest.json'];

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
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener('push', event => {
  let data = { title: 'AlamQuant ATTS', body: 'Remember your trading journal!' };
  if (event.data) {
    try { data = event.data.json(); } catch(e) { data.body = event.data.text(); }
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
'@
$swJs | Out-File -FilePath "$projectRoot\sw.js" -Encoding utf8
Write-Host "Created sw.js" -ForegroundColor Green

# ============================================
# 5. manifest.json (PWA Manifest)
# ============================================
$manifestJson = @'
{
  "name": "AlamQuant ATTS",
  "short_name": "ATTS",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#020617",
  "theme_color": "#eab308",
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
'@
$manifestJson | Out-File -FilePath "$projectRoot\manifest.json" -Encoding utf8
Write-Host "Created manifest.json" -ForegroundColor Green

# ============================================
# 6. server.js (Local Development Server)
# ============================================
$serverJs = @'
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname, join } from 'path';
import { fileURLToPath } from 'url';
import handler from './api/setup.js';   // import default export (toNodeHandler(apiHandler))

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
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
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost:3000');

  if (url.pathname.startsWith('/api/')) {
    handler(req, res);
  } else {
    await serveStatic(req, res);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('Server running at http://localhost:' + PORT);
});
'@
$serverJs | Out-File -FilePath "$projectRoot\server.js" -Encoding utf8
Write-Host "Created server.js" -ForegroundColor Green

# ============================================
# 7. .env.local (Placeholder)
# ============================================
$envLocal = @'
# AlamQuant ATTS - Environment Variables
# IMPORTANT: Replace these placeholder values with your real credentials.
# Never commit this file to public repositories.

DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
JWT_SECRET=replace_with_strong_random_secret
ADMIN_SECRET=admin123
GOOGLE_CLIENT_ID=replace_with_google_client_id
OPENAI_API_KEY=sk-your-openai-api-key

# ===== Database Initialization =====
# After first deploy, set ALLOW_INIT_DB=true in Vercel Environment Variables,
# then run: Invoke-RestMethod -Uri https://your-project.vercel.app/api/setup/init-db -Method POST -ContentType "application/json" -Body '{"admin_secret":"your_admin_secret"}'
# Default admin login: admin@alamquant.com / Admin@2024!Secure
# Change password immediately after first login!
'@
$envLocal | Out-File -FilePath "$projectRoot\.env.local" -Encoding utf8
Write-Host "Created .env.local (placeholder with init instructions)" -ForegroundColor Yellow

# ============================================
# 8. .gitignore
# ============================================
$gitignore = @'
node_modules/
.env.local
.env
.DS_Store
*.log
'@
$gitignore | Out-File -FilePath "$projectRoot\.gitignore" -Encoding utf8
Write-Host "Created .gitignore" -ForegroundColor Green

# ============================================
# 9. admin.html (Complete Admin Dashboard - Enterprise Grade)
# ============================================
$adminHtml = @'
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AlamQuant ATTS - Admin Panel</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #020617;
      --surface: rgba(15, 23, 42, 0.85);
      --gold: #eab308;
      --gold-bright: #facc15;
      --gold-light: #fef08a;
      --accent: #38bdf8;
      --accent-bright: #7dd3fc;
      --accent2: #f43f5e;
      --purple: #a78bfa;
      --cyan: #22d3ee;
      --orange: #fb923c;
      --text: #f1f5f9;
      --text-secondary: #94a3b8;
      --danger: #ef4444;
      --success: #22c55e;
      --warning: #f59e0b;
      --border-gold: rgba(234,179,8,0.5);
      --border-accent: rgba(56,189,248,0.4);
      --radius: 16px;
      --radius-sm: 10px;
      --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      --glow-gold: 0 0 30px rgba(234,179,8,0.5);
      --glow-accent: 0 0 25px rgba(56,189,248,0.5);
      --bg-gradient: linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%);
    }

    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Inter', sans-serif;
      background: var(--bg-gradient);
      background-size: 400% 400%;
      animation: bgSlide 25s ease infinite;
      color: var(--text);
      display: flex;
      min-height: 100vh;
    }
    ::-webkit-scrollbar { width: 8px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: var(--gold); border-radius: 4px; }

    .admin-sidebar {
      width: 260px;
      background: rgba(2,6,23,0.98);
      border-right: 1px solid var(--border-gold);
      padding: 24px 0;
      position: fixed;
      height: 100vh;
      overflow-y: auto;
      z-index: 100;
      backdrop-filter: blur(12px);
    }
    .admin-sidebar .logo {
      padding: 0 24px 20px;
      border-bottom: 1px solid var(--border-gold);
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--gold-bright);
      letter-spacing: -0.5px;
    }
    .admin-sidebar ul li {
      padding: 12px 24px;
      color: var(--text-secondary);
      cursor: pointer;
      transition: var(--transition);
      display: flex;
      align-items: center;
      gap: 12px;
      border-left: 3px solid transparent;
      font-weight: 500;
    }
    .admin-sidebar ul li:hover,
    .admin-sidebar ul li.active {
      background: rgba(234,179,8,0.15);
      color: var(--gold-bright);
      border-left-color: var(--gold);
    }
    .admin-main {
      margin-left: 260px;
      flex: 1;
      padding: 30px;
      min-height: 100vh;
    }
    .admin-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 30px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border-gold);
    }

    .glass {
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(16px) saturate(180%);
      -webkit-backdrop-filter: blur(16px) saturate(180%);
      border: 1px solid var(--border-gold);
      box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 0 15px rgba(255,255,255,0.02);
      border-radius: var(--radius);
      padding: 24px;
      margin-bottom: 18px;
      transition: all var(--transition);
    }
    .glass:hover {
      border-color: var(--gold-bright);
      box-shadow: 0 12px 40px rgba(0,0,0,0.6), var(--glow-gold);
      transform: translateY(-2px);
    }

    h2, h3, h4 {
      background: linear-gradient(135deg, var(--gold-bright), var(--gold));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 700;
      margin-bottom: 14px;
    }

    .btn {
      background: linear-gradient(135deg, var(--gold), #ca8a04);
      color: #020617;
      border: none;
      padding: 10px 22px;
      border-radius: 30px;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition);
      font-size: 0.9rem;
      box-shadow: 0 4px 15px rgba(234,179,8,0.4);
      letter-spacing: 0.3px;
    }
    .btn:hover { box-shadow: 0 6px 20px rgba(234,179,8,0.7); transform: translateY(-1px); }
    .btn:active { transform: scale(0.97); }
    .btn-accent { background: linear-gradient(135deg, var(--accent), #0284c7); box-shadow: 0 4px 15px rgba(56,189,248,0.4); }
    .btn-danger { background: linear-gradient(135deg, var(--danger), #b91c1c); box-shadow: 0 4px 15px rgba(239,68,68,0.4); }
    .btn-outline { background: transparent; border: 2px solid var(--gold); color: var(--gold); box-shadow: none; }
    .btn-outline:hover { background: rgba(234,179,8,0.1); }
    .btn-sm { padding: 6px 16px; font-size: 0.8rem; border-radius: 20px; }

    input, textarea, select {
      background: rgba(255,255,255,0.08);
      border: 1px solid var(--border-gold);
      color: var(--text);
      padding: 10px 16px;
      border-radius: var(--radius-sm);
      width: 100%;
      margin: 6px 0;
      font-family: inherit;
      transition: var(--transition);
      outline: none;
    }
    input:focus, textarea:focus, select:focus {
      border-color: var(--gold-bright);
      box-shadow: 0 0 0 3px rgba(234,179,8,0.25), var(--glow-gold);
      background: rgba(255,255,255,0.12);
    }

    .admin-table {
      width: 100%;
      border-collapse: collapse;
      background: rgba(255,255,255,0.03);
      border-radius: var(--radius-sm);
      overflow: hidden;
      margin-top: 16px;
    }
    .admin-table th {
      background: rgba(234,179,8,0.15);
      color: var(--gold-bright);
      font-weight: 600;
      padding: 12px;
      text-align: left;
    }
    .admin-table td {
      padding: 10px 12px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      color: var(--text);
    }
    .admin-table tr:hover td {
      background: rgba(255,255,255,0.05);
    }

    .stat-card { background: var(--surface); backdrop-filter: blur(10px); border: 1px solid var(--border-gold); border-radius: var(--radius); padding: 20px; text-align: center; transition: var(--transition); }
    .stat-card:hover { transform: translateY(-3px); box-shadow: var(--glow-gold); }
    .stat-value { font-size: 2.2rem; font-weight: 800; color: var(--gold-bright); }
    .stat-label { color: var(--text-secondary); margin-top: 8px; font-size: 0.9rem; }

    .toast {
      position:fixed; top:20px; right:20px;
      background:linear-gradient(135deg, var(--gold), var(--gold-bright));
      color:#020617; font-weight:700;
      padding:14px 22px; border-radius:30px;
      z-index:9999; box-shadow:0 10px 30px rgba(0,0,0,0.6);
      opacity:0; transform:translateX(120%);
      transition:0.4s cubic-bezier(0.4,0,0.2,1);
    }
    .toast.show { opacity:1; transform:translateX(0); }

    .chapter-editor { background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); padding: 20px; margin: 16px 0; border: 1px solid var(--border-gold); }
    .question-item { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 16px; margin: 12px 0; border-left: 3px solid var(--accent); }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }

    .quiz-option { display: flex; align-items: center; gap: 10px; padding: 4px 0; }
    .quiz-option input[type="radio"] { width: auto; margin: 0; accent-color: var(--gold); }
    .quiz-option label { flex: 1; cursor: pointer; color: var(--text); }
    .question-block { background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 16px; }

    @media (max-width: 1024px) { .grid-3, .grid-4 { grid-template-columns: repeat(2, 1fr); } .admin-sidebar { width: 200px; } .admin-main { margin-left: 200px; } }
    @media (max-width: 768px) { .admin-sidebar { width: 70px; } .admin-sidebar ul li span { display: none; } .admin-main { margin-left: 70px; } }
  </style>
</head>
<body>
  <div id="admin-login-screen" style="display:flex; justify-content:center; align-items:center; min-height:100vh; width:100%;">
    <div class="glass" style="width:400px; text-align:center; padding:40px;">
      <h2 style="color:var(--gold-bright);">🔐 Admin Login</h2>
      <input type="email" id="admin-email" placeholder="Admin Email">
      <input type="password" id="admin-password" placeholder="Password">
      <button class="btn btn-lg" onclick="adminLogin()" style="width:100%; margin-top:16px;">Login</button>
      <p id="login-error" style="color:var(--danger); margin-top:12px; display:none;"></p>
    </div>
  </div>

  <div id="admin-dashboard" class="admin-layout" style="display:none;">
    <nav class="admin-sidebar">
      <div class="logo">⚙️ ATTS Admin</div>
      <ul>
        <li class="active" data-section="dashboard" onclick="showSection('dashboard')">📊 Dashboard</li>
        <li data-section="chapters" onclick="showSection('chapters')">📚 Chapters</li>
        <li data-section="users" onclick="showSection('users')">👥 Users</li>
        <li data-section="certificates" onclick="showSection('certificates')">🏆 Certificates</li>
        <li data-section="courses" onclick="showSection('courses')">📚 Courses</li>
        <li data-section="activity" onclick="showSection('activity')">📋 Activity Log</li>
        <li data-section="settings" onclick="showSection('settings')">⚙️ Settings</li>
      </ul>
      <div style="position:absolute; bottom:20px; left:20px; right:20px;">
        <button class="btn btn-outline btn-sm" onclick="adminLogout()" style="width:100%;">Logout</button>
      </div>
    </nav>

    <main class="admin-main">
      <div class="admin-header">
        <h2 id="section-title">📊 Dashboard</h2>
        <span id="admin-name" style="color:var(--gold-light); font-weight:600;"></span>
      </div>
      <div id="content-area"></div>
    </main>
  </div>

  <div id="toast" class="toast"></div>

  <script>
    const API_BASE = "/api/setup";
    let adminToken = localStorage.getItem("adminToken");
    let currentSection = "dashboard";
    let editingChapterId = null;

    function showToast(msg) {
      const t = document.getElementById("toast");
      t.textContent = msg;
      t.classList.add("show");
      setTimeout(() => t.classList.remove("show"), 3000);
    }

    async function adminApi(method, path, body = null) {
      const opts = {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminToken}` }
      };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`${API_BASE}${path}`, opts);
      if (res.status === 401 || res.status === 403) { adminLogout(); return null; }
      return res.json();
    }

    async function adminLogin() {
      const email = document.getElementById("admin-email").value;
      const password = document.getElementById("admin-password").value;
      const res = await fetch(`${API_BASE}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.token) {
        adminToken = data.token;
        localStorage.setItem("adminToken", adminToken);

        document.getElementById("admin-login-screen").style.display = "none";
        const dashboard = document.getElementById("admin-dashboard");
        dashboard.style.display = "flex";
        document.getElementById("content-area").innerHTML = '<p style="color:var(--text-secondary);">ড্যাশবোর্ড লোড হচ্ছে...</p>';

        const stats = await fetch(`${API_BASE}/admin/dashboard`, {
          headers: { "Authorization": `Bearer ${adminToken}` }
        }).then(res => res.json());

        if (stats && !stats.error) {
          document.getElementById("admin-name").textContent = data.name;
          loadDashboardWithData(stats);
        } else {
          document.getElementById("admin-dashboard").style.display = "none";
          document.getElementById("admin-login-screen").style.display = "flex";
          document.getElementById("login-error").textContent = stats?.error || "ড্যাশবোর্ড লোড ব্যর্থ";
          document.getElementById("login-error").style.display = "block";
          adminToken = null;
          localStorage.removeItem("adminToken");
        }
      } else {
        document.getElementById("login-error").textContent = data.error || "Login failed";
        document.getElementById("login-error").style.display = "block";
      }
    }

    function loadDashboardWithData(data) {
      document.getElementById("content-area").innerHTML = `
        <div class="grid-4">
          <div class="stat-card glass"><div class="stat-value">${data.totalUsers}</div><div class="stat-label">Total Users</div></div>
          <div class="stat-card glass"><div class="stat-value">${data.dailyActiveUsers}</div><div class="stat-label">Today Active</div></div>
          <div class="stat-card glass"><div class="stat-value">${data.totalJournals}</div><div class="stat-label">Total Journals</div></div>
          <div class="stat-card glass"><div class="stat-value">${data.completionRate}%</div><div class="stat-label">Training Completed</div></div>
        </div>
        <div class="glass" style="margin-top:24px;"><h3>Quick Stats</h3><p>Total Chapters: <strong>${data.totalChapters}</strong></p><p>Certified: <strong>${data.completedTrainings}</strong></p></div>`;
      currentSection = "dashboard";
      document.querySelectorAll(".admin-sidebar ul li").forEach(li => li.classList.remove("active"));
      document.querySelector(`[data-section="dashboard"]`)?.classList.add("active");
    }

    function adminLogout() {
      localStorage.removeItem("adminToken");
      adminToken = null;
      document.getElementById("admin-login-screen").style.display = "flex";
      document.getElementById("admin-dashboard").style.display = "none";
    }

    function showSection(section) {
      currentSection = section;
      document.querySelectorAll(".admin-sidebar ul li").forEach(li => li.classList.remove("active"));
      document.querySelector(`[data-section="${section}"]`)?.classList.add("active");
      const titles = {
        dashboard: "📊 Dashboard",
        chapters: "📚 Chapters Management",
        users: "👥 User Management",
        certificates: "🏆 Certificates",
        courses: "📚 Courses Management",
        activity: "📋 Activity Log",
        settings: "⚙️ Settings"
      };
      document.getElementById("section-title").textContent = titles[section] || "";
      switch(section) {
        case "dashboard": loadDashboard(); break;
        case "chapters": loadChapters(); break;
        case "users": loadUsers(); break;
        case "certificates": loadCertificates(); break;
        case "courses": loadCourses(); break;
        case "activity": loadActivityLog(); break;
        case "settings": loadSettings(); break;
      }
    }

    // ----- Dashboard -----
    async function loadDashboard() {
      const data = await adminApi("GET", "/admin/dashboard");
      if (!data) return;
      document.getElementById("content-area").innerHTML = `
        <div class="grid-4">
          <div class="stat-card glass"><div class="stat-value">${data.totalUsers}</div><div class="stat-label">Total Users</div></div>
          <div class="stat-card glass"><div class="stat-value">${data.dailyActiveUsers}</div><div class="stat-label">Today Active</div></div>
          <div class="stat-card glass"><div class="stat-value">${data.totalJournals}</div><div class="stat-label">Total Journals</div></div>
          <div class="stat-card glass"><div class="stat-value">${data.completionRate}%</div><div class="stat-label">Training Completed</div></div>
        </div>
        <div class="glass" style="margin-top:24px;"><h3>Quick Stats</h3><p>Total Chapters: <strong>${data.totalChapters}</strong></p><p>Certified: <strong>${data.completedTrainings}</strong></p></div>`;
    }

    // ----- Chapters CRUD -----
    async function loadChapters() {
      const chapters = await adminApi("GET", "/admin/chapters?course_id=1");
      if (!chapters) return;
      let html = `<button class="btn btn-accent" onclick="showChapterForm()" style="margin-bottom:20px;">+ New Chapter</button>
        <div id="chapter-form" class="chapter-editor hidden">
          <h4 id="chapter-form-title">New Chapter</h4>
          <div class="grid-2"><input type="text" id="ch-title" placeholder="Title"><input type="number" id="ch-order" placeholder="Order" min="1"></div>
          <textarea id="ch-content" rows="6" placeholder="HTML Content"></textarea>
          <div class="grid-2"><input type="url" id="ch-image" placeholder="Image URL"><input type="url" id="ch-video" placeholder="Video URL"></div>
          <input type="number" id="ch-passing" placeholder="Passing Score (%)" value="90" min="0" max="100">
          <div style="margin-top:12px; display:flex; gap:8px;"><button class="btn btn-accent" onclick="saveChapter()">Save</button><button class="btn btn-outline" onclick="cancelChapterEdit()">Cancel</button></div>
        </div>
        <div id="chapters-list">`;
      chapters.forEach(ch => {
        html += `<div class="glass" style="margin:12px 0; padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div><strong>#${ch.order_index} ${ch.title}</strong><div style="font-size:0.85rem; color:var(--text-secondary);">Questions: ${ch.question_count} | Passed: ${ch.passed_count} | Passing: ${ch.passing_score}%</div></div>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-sm btn-outline" onclick="editChapter(${ch.id})">Edit</button>
              <button class="btn btn-sm btn-outline" onclick="manageQuestions(${ch.id})">Questions</button>
              <button class="btn btn-sm btn-danger" onclick="deleteChapter(${ch.id})">Delete</button></div></div></div>`;
      });
      html += "</div>";
      document.getElementById("content-area").innerHTML = html;
    }

    function showChapterForm(chapter = null) {
      document.getElementById("chapter-form").classList.remove("hidden");
      if (chapter) {
        editingChapterId = chapter.id;
        document.getElementById("ch-title").value = chapter.title;
        document.getElementById("ch-order").value = chapter.order_index;
        document.getElementById("ch-content").value = chapter.content_text || "";
        document.getElementById("ch-image").value = chapter.image_url || "";
        document.getElementById("ch-video").value = chapter.video_url || "";
        document.getElementById("ch-passing").value = chapter.passing_score;
      } else {
        editingChapterId = null;
        ["ch-title","ch-order","ch-content","ch-image","ch-video"].forEach(id => document.getElementById(id).value = "");
        document.getElementById("ch-passing").value = 90;
      }
    }

    function cancelChapterEdit() { document.getElementById("chapter-form").classList.add("hidden"); editingChapterId = null; }

    async function editChapter(id) {
      const chapters = await adminApi("GET", "/admin/chapters?course_id=1");
      const ch = chapters.find(c => c.id === id);
      if (ch) showChapterForm(ch);
    }

    async function saveChapter() {
      const data = {
        course_id: 1,
        title: document.getElementById("ch-title").value,
        order_index: parseInt(document.getElementById("ch-order").value),
        content_text: document.getElementById("ch-content").value,
        image_url: document.getElementById("ch-image").value,
        video_url: document.getElementById("ch-video").value,
        passing_score: parseInt(document.getElementById("ch-passing").value)
      };
      if (!data.title || !data.order_index) return showToast("Title and order required");
      if (editingChapterId) await adminApi("PUT", `/admin/chapter/${editingChapterId}`, data);
      else await adminApi("POST", "/admin/chapter", data);
      cancelChapterEdit();
      loadChapters();
    }

    async function deleteChapter(id) {
      if (!confirm("Delete chapter?")) return;
      await adminApi("DELETE", `/admin/chapter/${id}`);
      loadChapters();
    }

    async function manageQuestions(chapterId) {
      const questions = await adminApi("GET", `/admin/chapter/${chapterId}/questions`);
      const chapters = await adminApi("GET", "/admin/chapters?course_id=1");
      const chapter = chapters.find(c => c.id === chapterId);
      let html = `<button class="btn btn-outline" onclick="loadChapters()">← Back</button>
        <h3>${chapter?.title || ""} - Quiz Questions</h3>
        <button class="btn btn-accent btn-sm" onclick="showQuestionForm(${chapterId})">+ Add Question</button>
        <div id="question-form" class="chapter-editor hidden">
          <h4 id="q-form-title">New Question</h4>
          <input type="hidden" id="q-chapter-id" value="${chapterId}">
          <input type="hidden" id="q-id" value="">
          <textarea id="q-text" rows="2" placeholder="Question"></textarea>
          <div class="grid-2"><input type="text" id="q-opt0" placeholder="Option 1"><input type="text" id="q-opt1" placeholder="Option 2"><input type="text" id="q-opt2" placeholder="Option 3"><input type="text" id="q-opt3" placeholder="Option 4"></div>
          <input type="number" id="q-correct" placeholder="Correct answer (0-3)" min="0" max="3">
          <input type="text" id="q-explanation" placeholder="Explanation (optional)">
          <button class="btn btn-accent btn-sm" onclick="saveQuestion()">Save</button>
          <button class="btn btn-outline btn-sm" onclick="document.getElementById('question-form').classList.add('hidden')">Cancel</button>
        </div>
        <div id="questions-list">`;
      questions.forEach(q => {
        html += `<div class="question-item"><p><strong>${q.question}</strong></p>
          <p style="font-size:0.85rem; color:var(--text-secondary);">${q.options.map((opt,i) => `${i===q.correct_index?"✓":"○"} ${opt}`).join(" | ")}</p>
          ${q.explanation ? `<p style="font-size:0.8rem; color:var(--accent-bright);">${q.explanation}</p>` : ""}
          <div style="margin-top:8px;"><button class="btn btn-sm btn-outline" onclick="editQuestion(${q.id}, ${chapterId})">Edit</button><button class="btn btn-sm btn-danger" onclick="deleteQuestion(${q.id}, ${chapterId})">Delete</button></div></div>`;
      });
      html += "</div>";
      document.getElementById("content-area").innerHTML = html;
    }

    function showQuestionForm(chapterId, question = null) {
      document.getElementById("question-form").classList.remove("hidden");
      document.getElementById("q-chapter-id").value = chapterId;
      if (question) {
        document.getElementById("q-id").value = question.id;
        document.getElementById("q-text").value = question.question;
        question.options.forEach((opt,i) => document.getElementById(`q-opt${i}`).value = opt);
        document.getElementById("q-correct").value = question.correct_index;
        document.getElementById("q-explanation").value = question.explanation || "";
      } else {
        document.getElementById("q-id").value = "";
        ["q-text","q-correct","q-explanation"].forEach(id => document.getElementById(id).value = "");
        for(let i=0;i<4;i++) document.getElementById(`q-opt${i}`).value = "";
      }
    }

    async function editQuestion(qId, chapterId) {
      const questions = await adminApi("GET", `/admin/chapter/${chapterId}/questions`);
      const q = questions.find(q => q.id === qId);
      if (q) showQuestionForm(chapterId, q);
    }

    async function saveQuestion() {
      const chapterId = parseInt(document.getElementById("q-chapter-id").value);
      const qId = document.getElementById("q-id").value;
      const data = {
        question: document.getElementById("q-text").value,
        options: [0,1,2,3].map(i => document.getElementById(`q-opt${i}`).value),
        correct_index: parseInt(document.getElementById("q-correct").value),
        explanation: document.getElementById("q-explanation").value
      };
      if (!data.question || data.options.some(o=>!o) || isNaN(data.correct_index)) return showToast("All fields required");
      if (qId) await adminApi("PUT", `/admin/question/${qId}`, data);
      else await adminApi("POST", `/admin/chapter/${chapterId}/question`, data);
      document.getElementById("question-form").classList.add("hidden");
      manageQuestions(chapterId);
    }

    async function deleteQuestion(qId, chapterId) {
      if (!confirm("Delete question?")) return;
      await adminApi("DELETE", `/admin/question/${qId}`);
      manageQuestions(chapterId);
    }

    // ----- Users -----
    async function loadUsers() {
      const users = await adminApi("GET", "/admin/users");
      if (!users) return;
      let html = `<input type="text" id="user-search" placeholder="Search by email or name..." oninput="searchUsers()" style="margin-bottom:16px;"><div id="users-list">`;
      users.forEach(u => {
        html += `<div class="glass" style="margin:8px 0; padding:12px;"><strong>${u.avatar_emoji||"🙂"} ${u.display_name||u.email}</strong><span class="badge">Lv.${u.level} | ${u.xp} XP</span><span class="badge badge-accent">${u.identity_level}</span></div>`;
      });
      html += "</div>";
      document.getElementById("content-area").innerHTML = html;
    }

    async function searchUsers() {
      const q = document.getElementById("user-search").value;
      const users = await adminApi("GET", `/admin/users?search=${encodeURIComponent(q)}`);
      const list = document.getElementById("users-list");
      list.innerHTML = users.map(u => `<div class="glass" style="margin:8px 0; padding:12px;"><strong>${u.avatar_emoji||"🙂"} ${u.display_name||u.email}</strong><span class="badge">Lv.${u.level} | ${u.xp} XP</span><span class="badge badge-accent">${u.identity_level}</span></div>`).join("");
    }

    // ----- Certificates -----
    function loadCertificates() {
      document.getElementById("content-area").innerHTML = `
        <div class="glass">
          <h3>🏆 Certificate Verification</h3>
          <input type="text" id="verify-code" placeholder="Verification Code">
          <button class="btn btn-accent btn-sm" onclick="verifyCertificate()">Verify</button>
          <div id="verify-result" style="margin-top:16px;"></div>
        </div>`;
    }

    async function verifyCertificate() {
      const code = document.getElementById("verify-code").value;
      const res = await fetch(`/api/setup/verify/${code}`).then(r=>r.json());
      document.getElementById("verify-result").innerHTML = res.valid
        ? `<p style="color:var(--success);">✅ Valid Certificate | User: ${res.user}</p>`
        : `<p style="color:var(--danger);">❌ Invalid Certificate</p>`;
    }

    // ----- Courses CRUD -----
    async function loadCourses() {
      const courses = await adminApi("GET", "/admin/courses");
      let html = `<button class="btn btn-accent" onclick="showCourseForm()" style="margin-bottom:20px;">+ New Course</button>
        <div id="course-form" class="chapter-editor hidden">
          <h4>New Course</h4>
          <div class="form-group"><label>Title</label><input type="text" id="course-title"></div>
          <div class="form-group"><label>Description</label><textarea id="course-desc"></textarea></div>
          <button class="btn btn-accent btn-sm" onclick="saveCourse()">Save</button>
          <button class="btn btn-outline btn-sm" onclick="cancelCourseForm()">Cancel</button>
          <input type="hidden" id="course-edit-id" value="">
        </div>
        <table class="admin-table">
          <thead><tr><th>ID</th><th>Title</th><th>Description</th><th>Actions</th></tr></thead>
          <tbody>`;
      courses.forEach(c => {
        html += `<tr>
          <td>${c.id}</td>
          <td>${escapeHtml(c.title)}</td>
          <td>${escapeHtml(c.description || '')}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="editCourse(${c.id}, '${escapeHtml(c.title)}', '${escapeHtml(c.description||'')}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="deleteCourse(${c.id})">Delete</button>
          </td>
        </tr>`;
      });
      html += '</tbody></table>';
      document.getElementById("content-area").innerHTML = html;
    }

    function showCourseForm() { document.getElementById('course-form').classList.remove('hidden'); document.getElementById('course-edit-id').value = ''; }
    function cancelCourseForm() { document.getElementById('course-form').classList.add('hidden'); }
    function editCourse(id, title, desc) {
      document.getElementById('course-form').classList.remove('hidden');
      document.getElementById('course-edit-id').value = id;
      document.getElementById('course-title').value = title;
      document.getElementById('course-desc').value = desc;
    }
    async function saveCourse() {
      const title = document.getElementById('course-title').value;
      const description = document.getElementById('course-desc').value;
      const id = document.getElementById('course-edit-id').value;
      if (!title) return showToast('Title required');
      if (id) {
        await adminApi("PUT", `/admin/course/${id}`, { title, description, is_active: true });
      } else {
        await adminApi("POST", "/admin/course", { title, description });
      }
      cancelCourseForm();
      loadCourses();
    }
    async function deleteCourse(id) {
      if (!confirm('Deleting a course will remove all its chapters!')) return;
      await adminApi("DELETE", `/admin/course/${id}`);
      loadCourses();
    }

    // ----- Activity Log -----
    async function loadActivityLog() {
      const logs = await adminApi("GET", "/admin/activity-log");
      let html = '<table class="admin-table"><thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Details</th></tr></thead><tbody>';
      logs.forEach(log => {
        html += `<tr>
          <td>${new Date(log.created_at).toLocaleString()}</td>
          <td>${log.admin_name || log.admin_email}</td>
          <td>${log.action}</td>
          <td>${JSON.stringify(log.details || {}).substring(0,60)}</td>
        </tr>`;
      });
      html += '</tbody></table>';
      document.getElementById("content-area").innerHTML = html;
    }

    // ----- Settings -----
    function loadSettings() {
      document.getElementById("content-area").innerHTML = `
        <div class="glass">
          <h3>⚙️ Admin Settings</h3>
          <div class="form-group"><label>Current Password</label><input type="password" id="current-password"></div>
          <div class="form-group"><label>New Password</label><input type="password" id="new-password"></div>
          <div class="form-group"><label>Confirm New Password</label><input type="password" id="confirm-password"></div>
          <button class="btn btn-accent" onclick="changeAdminPassword()">Change Password</button>
          <div id="settings-message" style="margin-top:12px;"></div>
        </div>`;
    }

    async function changeAdminPassword() {
      const current = document.getElementById('current-password').value;
      const newPass = document.getElementById('new-password').value;
      const confirm = document.getElementById('confirm-password').value;
      if (newPass !== confirm) return showToast('Passwords do not match');
      if (newPass.length < 6) return showToast('Password must be at least 6 characters');
      const res = await adminApi('PUT', '/admin/change-password', { current_password: current, new_password: newPass });
      if (res.success) {
        showToast('✅ Password changed successfully');
        document.getElementById('settings-message').innerHTML = '<p style="color:var(--success);">Password updated</p>';
      } else {
        document.getElementById('settings-message').innerHTML = `<p style="color:var(--danger);">${res.error || 'Error'}</p>`;
      }
    }

    function escapeHtml(text) {
      if (!text) return '';
      return String(text).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    if (adminToken) {
      document.getElementById("admin-login-screen").style.display = "none";
      document.getElementById("admin-dashboard").style.display = "flex";
      showSection("dashboard");
    }
  </script>
</body>
</html>
'@
$adminHtml | Out-File -FilePath "$projectRoot\admin.html" -Encoding utf8
Write-Host "Created admin.html (Enterprise Grade)" -ForegroundColor Green

# ============================================
# 10. verify.html (Public Certificate Verification)
# ============================================
$verifyHtml = @'
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate Verification - AlamQuant ATTS</title>
  <link rel="stylesheet" href="styles.css">
  <style>
    body { display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .verify-container { max-width: 500px; width: 90%; text-align: center; }
  </style>
</head>
<body>
  <div class="glass verify-container">
    <h2>🔍 Certificate Verification</h2>
    <input type="text" id="verify-input" placeholder="Enter verification code">
    <button class="btn" onclick="verify()">Verify</button>
    <div id="result" style="margin-top:20px;"></div>
  </div>
  <script>
    async function verify() {
      const code = document.getElementById('verify-input').value.trim();
      if (!code) return;
      const res = await fetch(`/api/setup/verify/${code}`).then(r => r.json());
      const resultDiv = document.getElementById('result');
      if (res.valid) {
        resultDiv.innerHTML = `<div style="color: var(--success);">
          <p style="font-size:3rem;">✅</p>
          <h3>Valid Certificate</h3>
          <p><strong>Name:</strong> ${res.display_name || res.user}</p>
          <p><strong>Issued:</strong> ${new Date(res.issued_at).toLocaleDateString('bn-BD')}</p>
          <p><strong>Code:</strong> ${res.verification_code}</p>
        </div>`;
      } else {
        resultDiv.innerHTML = `<div style="color: var(--danger);">
          <p style="font-size:3rem;">❌</p>
          <h3>Invalid Certificate</h3>
          <p>This code was not found in the system.</p>
        </div>`;
      }
    }
  </script>
</body>
</html>
'@
$verifyHtml | Out-File -FilePath "$projectRoot\verify.html" -Encoding utf8
Write-Host "Created verify.html" -ForegroundColor Green

# ============================================
# 11. index.html (Enterprise Grade Full Application)
# ============================================
$indexHtml = @'
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes, viewport-fit=cover">
  <meta name="theme-color" content="#020617">
  <title>AlamQuant ATTS – Professional Trader Transformation</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1"></script>
  <script src="https://accounts.google.com/gsi/client" async defer></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;600;700&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #020617;
      --surface: rgba(15, 23, 42, 0.85);
      --gold: #eab308;
      --gold-bright: #facc15;
      --gold-light: #fef08a;
      --accent: #38bdf8;
      --accent-bright: #7dd3fc;
      --accent2: #f43f5e;
      --purple: #a78bfa;
      --cyan: #22d3ee;
      --orange: #fb923c;
      --text: #f1f5f9;
      --text-secondary: #94a3b8;
      --danger: #ef4444;
      --success: #22c55e;
      --warning: #f59e0b;
      --border-gold: rgba(234,179,8,0.5);
      --border-accent: rgba(56,189,248,0.4);
      --radius: 16px;
      --radius-sm: 10px;
      --transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      --glow-gold: 0 0 30px rgba(234,179,8,0.5);
      --glow-accent: 0 0 25px rgba(56,189,248,0.5);
      --bg-gradient: linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%);
    }
    * { margin:0; padding:0; box-sizing:border-box; }

    body {
      font-family: 'Inter', 'Hind Siliguri', sans-serif;
      background: var(--bg-gradient);
      background-size: 400% 400%;
      animation: bgSlide 25s ease infinite;
      color: var(--text);
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      padding-bottom: 130px;
      overflow-x: hidden;
      position: relative;
    }
    .container { width:100%; max-width:960px; padding:16px; z-index:1; position:relative; }

    .glass {
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(16px) saturate(180%);
      -webkit-backdrop-filter: blur(16px) saturate(180%);
      border: 1px solid var(--border-gold);
      box-shadow: 0 8px 32px rgba(0,0,0,0.4), inset 0 0 15px rgba(255,255,255,0.02);
      border-radius: var(--radius);
      padding: 20px;
      margin-bottom: 18px;
      transition: all var(--transition);
    }
    .glass:hover {
      border-color: var(--gold-bright);
      box-shadow: 0 12px 40px rgba(0,0,0,0.6), var(--glow-gold);
      transform: translateY(-2px);
    }

    h1, h2, h3, h4 {
      background: linear-gradient(135deg, var(--gold-bright), var(--gold));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 700;
      margin-bottom: 14px;
    }
    h2 { font-size:1.6rem; } h3 { font-size:1.25rem; }

    .btn {
      background: linear-gradient(135deg, var(--gold), #ca8a04);
      color: #020617;
      border: none;
      padding: 10px 22px;
      border-radius: 30px;
      font-weight: 600;
      cursor: pointer;
      transition: all var(--transition);
      font-size: 0.9rem;
      box-shadow: 0 4px 15px rgba(234,179,8,0.4);
      letter-spacing: 0.3px;
      position: relative;
      overflow: hidden;
    }
    .btn:hover { box-shadow: 0 6px 20px rgba(234,179,8,0.7); transform: translateY(-1px); }
    .btn:active { transform: scale(0.97); }
    .btn-outline { background: transparent; border: 2px solid var(--gold); color: var(--gold); box-shadow: none; }
    .btn-outline:hover { background: rgba(234,179,8,0.1); }
    .btn-accent { background: linear-gradient(135deg, var(--accent), #0284c7); box-shadow: 0 4px 15px rgba(56,189,248,0.4); }
    .btn-danger { background: linear-gradient(135deg, var(--danger), #b91c1c); box-shadow: 0 4px 15px rgba(239,68,68,0.4); }
    .btn-sm { padding: 6px 16px; font-size: 0.8rem; border-radius: 20px; }
    .btn-lg { padding: 16px 32px; font-size: 1.1rem; border-radius: 40px; }

    input, textarea, select {
      background: rgba(255,255,255,0.08);
      border: 1px solid var(--border-gold);
      color: var(--text);
      padding: 10px 16px;
      border-radius: var(--radius-sm);
      width: 100%;
      margin: 6px 0;
      font-family: inherit;
      transition: var(--transition);
      outline: none;
      font-size: 0.95rem;
    }
    input:focus, textarea:focus, select:focus {
      border-color: var(--gold-bright);
      box-shadow: 0 0 0 3px rgba(234,179,8,0.25), var(--glow-gold);
      background: rgba(255,255,255,0.12);
    }

    textarea { resize:vertical; min-height:60px; }
    .grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
    .flex { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
    .hidden { display:none !important; }

    .bottom-nav {
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(25px);
      border-radius: 50px; padding: 8px 25px; display: flex; gap: 10px;
      border: 1px solid var(--border-gold);
      box-shadow: 0 10px 40px rgba(0,0,0,0.8);
      z-index: 100;
    }
    .nav-item {
      flex-direction: column; align-items: center; font-size: 10px; color: var(--text-secondary);
      transition: 0.3s; cursor: pointer; padding: 4px 6px;
    }
    .nav-item span { font-size: 20px; transition: 0.3s; }
    .nav-item.active { color: var(--gold-bright); text-shadow: 0 0 10px var(--gold-bright); }
    .nav-item.active span { transform: translateY(-4px) scale(1.2); }
    .nav-item.active::after {
      content: ''; position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%);
      width: 24px; height: 3px; background: var(--gold-bright); border-radius: 3px; box-shadow: 0 0 12px var(--gold-bright);
    }

    .badge {
      background:linear-gradient(135deg, var(--gold), var(--gold-bright));
      color:#020617;
      padding:4px 12px;
      border-radius:20px;
      font-weight:700;
      font-size:12px;
      display:inline-flex;
      align-items:center;
      gap:4px;
    }
    .badge-accent { background:linear-gradient(135deg, var(--accent), var(--accent-bright)); }

    .progress-bar {
      background: rgba(255,255,255,0.1);
      border-radius:20px;
      height:14px;
      overflow:hidden;
      margin:10px 0;
    }
    .progress-fill {
      height:100%;
      background: linear-gradient(90deg, var(--gold), #ffaa00);
      border-radius: 20px;
      box-shadow: 0 0 10px var(--gold);
      width:0%;
      transition: width 1.2s cubic-bezier(0.4,0,0.2,1);
    }
    .chart-container { margin-top:20px; max-height:280px; position:relative; z-index:1; }

    .phase-tag {
      background:var(--gold); color:#020617;
      padding:5px 16px; border-radius:20px; font-weight:700; font-size:0.85rem;
      display:inline-block;
    }
    .post {
      background:rgba(255,255,255,0.03);
      border-radius:var(--radius-sm);
      padding:16px; margin-bottom:10px;
      border:1px solid rgba(255,255,255,0.05);
      transition:var(--transition);
    }
    .post:hover { background:rgba(255,255,255,0.06); }

    .slider-item {
      display:flex; align-items:center; flex-wrap:wrap; gap:10px; margin:12px 0; padding:8px 0;
    }
    .slider-item label { flex:2; min-width:180px; color:var(--text-secondary); font-size:0.9rem; font-weight:500; }
    .slider-item input[type="range"] { flex:3; accent-color:var(--gold); }
    .slider-item span { font-weight:700; color:var(--gold-light); min-width:24px; text-align:center; }

    .xp-bar-container {
      background: rgba(255,255,255,0.05); border-radius: 30px; height: 24px; overflow: hidden;
      position: relative; margin: 10px 0;
    }
    .xp-bar-fill {
      height:100%; background: linear-gradient(90deg, var(--gold), var(--gold-bright), var(--gold)); background-size: 200% 100%;
      animation: shine 3s linear infinite; border-radius: 30px; display: flex; align-items: center; justify-content: center;
      transition: width 0.8s;
    }
    .xp-text { color: #020617; font-weight: bold; font-size: 0.75rem; z-index: 1; }

    .float-xp {
      position: fixed; top: 30%; left: 50%; transform: translate(-50%, -50%);
      font-size: 2rem; font-weight: 900; color: var(--gold-bright);
      text-shadow: 0 0 20px black; animation: floatUp 2s ease-out forwards; z-index: 9999; pointer-events: none;
    }
    .ripple { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.3); transform: scale(0); animation: ripple 0.6s linear; pointer-events: none; }

    .habit-card { transition: all 0.3s; margin-bottom:12px; }
    .habit-time-slot {
      display: inline-flex; align-items: center; gap: 4px;
      background: rgba(255,255,255,0.05); border-radius: 20px; padding: 4px 12px;
      margin: 4px; cursor: pointer; transition: 0.2s; font-size:0.9rem;
    }
    .habit-time-slot.done { background: rgba(105,240,174,0.2); border: 1px solid #69f0ae; }

    .toast {
      position:fixed; top:20px; right:20px;
      background:linear-gradient(135deg, var(--gold), var(--gold-bright));
      color:#020617; font-weight:700;
      padding:14px 22px; border-radius:30px;
      z-index:9999; box-shadow:0 10px 30px rgba(0,0,0,0.6);
      opacity:0; transform:translateX(120%);
      transition:0.4s cubic-bezier(0.4,0,0.2,1);
    }
    .toast.show { opacity:1; transform:translateX(0); }

    .mini-stat {
      background:rgba(255,255,255,0.04); border-radius:16px; padding:8px 14px;
      border:1px solid var(--border-gold); backdrop-filter:blur(5px);
      display:inline-flex; align-items:center; gap:8px; font-weight:600;
    }
    .streak-fire {
      background: linear-gradient(135deg, #ff9100, #ff3d00);
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      font-weight:900; animation: pulse 1.5s infinite;
    }
    .admin-gear {
      position:fixed; bottom:90px; right:20px; z-index:1000;
      background:var(--surface); border:1px solid var(--border-gold);
      border-radius:50%; width:48px; height:48px; display:flex;
      align-items:center; justify-content:center; cursor:pointer;
      font-size:22px; color:var(--gold); backdrop-filter:blur(12px);
      box-shadow:0 4px 20px rgba(0,0,0,0.6);
      transition:transform var(--transition);
    }
    .admin-gear:hover { transform:rotate(90deg); }

    .modal-overlay {
      position:fixed; top:0; left:0; right:0; bottom:0;
      background:rgba(0,0,0,0.85); display:flex;
      align-items:center; justify-content:center;
      z-index:10000; backdrop-filter:blur(4px);
    }
    .modal-content { max-width:90vw; max-height:85vh; overflow-y:auto; width:500px; }

    .gold-text {
      background:linear-gradient(135deg, var(--gold-bright) 0%, var(--gold-light) 100%);
      -webkit-background-clip:text;
      background-clip: text;
      -webkit-text-fill-color:transparent;
    }

    #bgCanvas { position:fixed; top:0; left:0; width:100%; height:100%; z-index:0; pointer-events:none; }

    .quest-card {
      border: 1px solid var(--gold-bright);
      background: radial-gradient(circle at top left, rgba(242,199,68,0.15), rgba(12,14,34,0.8));
    }
    .quest-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
    .xp-reward { color: var(--gold-bright); font-weight: bold; }
    .quest-progress { display: flex; align-items: center; gap: 10px; margin-top: 10px; }

    .fab {
      position: fixed; bottom: 90px; right: 80px; width: 56px; height: 56px;
      background: radial-gradient(circle at 30% 30%, var(--gold-bright), var(--gold));
      border-radius: 50%; display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 25px rgba(242,199,68,0.5); cursor: pointer; font-size: 28px; z-index: 2000;
      transition: transform 0.3s;
    }
    .fab:hover { transform: scale(1.1); }

    .drawer {
      position: fixed; bottom: 150px; right: 20px; width: 280px;
      background: rgba(12,14,34,0.95); backdrop-filter: blur(20px); border-radius: 16px;
      padding: 16px; border: 1px solid var(--gold);
      box-shadow: 0 10px 30px rgba(0,0,0,0.8); z-index: 1500;
    }

    .mood-picker { display: flex; align-items: center; gap: 8px; margin: 16px 0; background: rgba(255,255,255,0.03); padding: 12px; border-radius: 12px; }
    .mood-emoji { font-size: 28px; cursor: pointer; transition: transform 0.2s; padding: 4px; border-radius: 50%; }
    .mood-emoji.selected { transform: scale(1.3); background: rgba(242,199,68,0.2); box-shadow: 0 0 12px var(--gold); }

    .evolution-tree {
      display: flex; justify-content: space-between; margin-top: 20px; background: rgba(0,0,0,0.2); padding: 16px; border-radius: 12px;
    }
    .evolution-tree .stage { text-align: center; padding: 8px; border-radius: 8px; opacity: 0.4; transition: 0.3s; }
    .evolution-tree .stage.active { opacity: 1; background: rgba(242,199,68,0.2); box-shadow: 0 0 15px var(--gold); }

    .chapter-card { cursor:pointer; }
    .chapter-card.locked { opacity:0.5; pointer-events: none; }

    .skeleton {
      background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.05) 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: var(--radius-sm);
      height: 80px;
    }

    /* কুইজ অপশন */
    .quiz-option { display: flex; align-items: center; gap: 10px; padding: 4px 0; }
    .quiz-option input[type="radio"] { width: auto; margin: 0; accent-color: var(--gold); }
    .quiz-option label { flex: 1; cursor: pointer; color: var(--text); }
    .question-block { background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 16px; }

    /* অ্যানিমেশন */
    @keyframes spin { 100% { transform:rotate(360deg); } }
    @keyframes bounceIn {
      0% { transform:scale(0); opacity:0; }
      60% { transform:scale(1.15); opacity:1; }
      100% { transform:scale(1); }
    }
    @keyframes pulse {
      0% { transform:scale(1); }
      50% { transform:scale(1.08); text-shadow:0 0 20px #ff9100; }
      100% { transform:scale(1); }
    }
    @keyframes float {
      0%,100% { transform:translateY(0px); }
      50% { transform:translateY(-10px); }
    }
    @keyframes bgSlide {
      0% { background-position:0% 50%; }
      50% { background-position:100% 50%; }
      100% { background-position:0% 50%; }
    }
    @keyframes shine {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
    @keyframes floatUp {
      0% { opacity:1; transform:translate(-50%,0) scale(0.5); }
      100% { opacity:0; transform:translate(-50%,-80px) scale(1.2); }
    }
    @keyframes ripple {
      to { transform: scale(4); opacity: 0; }
    }
    @keyframes shootStar {
      0% { opacity:0; transform: translate(0,0) scale(0.5); }
      50% { opacity:1; }
      100% { opacity:0; transform: translate(200px,-200px) scale(0); }
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    @media (max-width:640px) {
      .grid-2 { grid-template-columns:1fr; }
      .glass { padding:16px; }
      h2 { font-size:1.3rem; }
      .bottom-nav { padding: 4px 10px; gap: 6px; }
      .nav-item span { font-size: 18px; }
    }
  </style>
</head>
<body>
  <canvas id="bgCanvas"></canvas>

  <script>
    window.GOOGLE_CLIENT_ID = "";
  </script>

  <div id="loading-screen" style="position:fixed; top:0;left:0;right:0;bottom:0; background:#020617; display:flex; flex-direction:column; justify-content:center; align-items:center; z-index:99999; gap:20px;">
    <div style="border:4px solid rgba(242,199,68,0.15); border-top:4px solid #eab308; border-radius:50%; width:52px; height:52px; animation:spin 0.8s linear infinite;"></div>
    <span style="color:var(--gold); font-weight:700; font-size:1.1rem; letter-spacing:1px;">AlamQuant ATTS</span>
  </div>

  <div id="toast" class="toast"></div>

  <div id="welcome-modal" class="hidden modal-overlay" aria-modal="true" role="dialog">
    <div class="glass modal-content" style="text-align:center; animation:bounceIn 0.5s;">
      <div style="font-size:60px; animation:float 3s infinite;">🌟</div>
      <h2 class="gold-text">স্বাগতম, <span id="welcome-name"></span>!</h2>
      <p style="color:var(--text-secondary); margin:12px 0;">তোমার ৩০ দিনের ট্রেডার ট্রান্সফরমেশন জার্নি শুরু হোক।</p>
      <p style="font-size:0.85rem; color:var(--accent-bright);">আজ তুমি প্রথম ধাপ – Awareness</p>
      <button class="btn btn-lg" onclick="closeWelcome()" style="margin-top:16px;">শুরু করো 🚀</button>
    </div>
  </div>

  <div id="level-up-modal" class="hidden modal-overlay" aria-modal="true" role="dialog">
    <div class="glass modal-content" style="text-align:center; animation:bounceIn 0.6s;">
      <div style="font-size:70px;">🎉</div>
      <h1 class="gold-text" id="level-up-title">লেভেল আপ!</h1>
      <p id="level-up-text" style="font-size:1.1rem; margin:12px 0;"></p>
      <button class="btn btn-lg" onclick="document.getElementById('level-up-modal').classList.add('hidden')">অসাধারণ! 🔥</button>
    </div>
  </div>

  <div id="mystery-box-modal" class="hidden modal-overlay" aria-modal="true" role="dialog">
    <div class="glass modal-content" style="text-align:center;">
      <div style="font-size:100px; cursor:pointer; animation:float 2s infinite;" onclick="openMysteryBox()">🎁</div>
      <p style="font-weight:600;">মিস্ট্রি বক্স খোলো!</p>
      <p style="color:var(--text-secondary); font-size:0.85rem;">কি পুরস্কার পাবে জানতে ক্লিক করো</p>
    </div>
  </div>

  <div id="streak-modal" class="hidden modal-overlay" aria-modal="true" role="dialog">
    <div class="glass modal-content" style="text-align:center; animation:bounceIn 0.5s;">
      <div style="font-size:80px;">🔥</div>
      <h2 class="gold-text" id="streak-modal-title"></h2>
      <p id="streak-modal-text" style="margin:10px 0;"></p>
      <button class="btn btn-lg" onclick="document.getElementById('streak-modal').classList.add('hidden')">চালিয়ে যাও</button>
    </div>
  </div>

  <!-- Password Reset Modal -->
  <div id="reset-pass-modal" class="modal-overlay hidden" aria-modal="true" role="dialog">
    <div class="glass modal-content" style="max-width:400px;">
      <h3>🔑 পাসওয়ার্ড রিসেট</h3>
      <input type="password" id="new-pass-input" placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)">
      <div style="display:flex; gap:10px; margin-top:16px;">
        <button class="btn btn-accent" onclick="resetPasswordConfirm()">সংরক্ষণ</button>
        <button class="btn btn-outline" onclick="closeResetPassModal()">বাতিল</button>
      </div>
    </div>
  </div>

  <!-- Admin Modal -->
  <div id="admin-modal" class="hidden modal-overlay" aria-modal="true" role="dialog">
    <div class="glass modal-content" style="max-width:600px; width:95%;">
      <div id="admin-login-form">
        <div class="flex" style="justify-content:space-between; margin-bottom:16px;">
          <h3>🔐 অ্যাডমিন লগইন</h3>
          <button class="btn btn-sm btn-outline" onclick="document.getElementById('admin-modal').classList.add('hidden')">✕</button>
        </div>
        <input type="email" id="admin-email" placeholder="ইমেইল">
        <input type="password" id="admin-password" placeholder="পাসওয়ার্ড">
        <button class="btn btn-lg" onclick="adminLogin()" style="width:100%; margin-top:8px;">লগইন</button>
        <p id="admin-login-error" style="color:var(--danger); margin-top:8px; display:none;"></p>
      </div>
      <div id="admin-panel" class="hidden">
        <div class="flex" style="justify-content:space-between; margin-bottom:16px;">
          <h3>⚙️ অ্যাডমিন প্যানেল</h3>
          <button class="btn btn-sm btn-outline" onclick="document.getElementById('admin-modal').classList.add('hidden')">✕</button>
        </div>
        <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;" id="admin-tabs">
          <button class="btn btn-sm" onclick="showAdminTab('stats')">📊 স্ট্যাটস</button>
          <button class="btn btn-sm btn-outline" onclick="showAdminTab('users')">👥 ইউজার</button>
          <button class="btn btn-sm btn-outline" onclick="showAdminTab('simulate')">🧪 সিমুলেট</button>
          <button class="btn btn-sm btn-outline" onclick="showAdminTab('community')">💬 কমিউনিটি</button>
          <button class="btn btn-sm btn-outline" onclick="showAdminTab('content')">📚 কনটেন্ট</button>
          <button class="btn btn-sm btn-outline" onclick="showAdminTab('assessment')">📋 অ্যাসেসমেন্ট</button>
          <button class="btn btn-sm btn-outline" onclick="showAdminTab('benefits')">🎁 বেনিফিট</button>
          <button class="btn btn-sm btn-outline" onclick="showAdminTab('analytics')">📈 অ্যানালিটিক্স</button>
          <button class="btn btn-sm btn-outline" onclick="showAdminTab('chapters')">📚 চ্যাপ্টার</button>
          <button class="btn btn-sm btn-outline" onclick="showAdminTab('courses')">📚 কোর্স</button>
          <button class="btn btn-sm btn-outline" onclick="showAdminTab('activity')">📋 অ্যাক্টিভিটি লগ</button>
          <button class="btn btn-sm btn-outline" onclick="showAdminTab('settings')">⚙️ সেটিংস</button>
        </div>
        <div id="admin-stats-tab" class="admin-tab"><p style="color:var(--text-secondary);">লোড হচ্ছে...</p></div>
        <div id="admin-users-tab" class="admin-tab hidden">
          <input type="text" id="admin-user-search" placeholder="ইমেইল বা নাম দিয়ে সার্চ..." oninput="searchAdminUsers()">
          <div id="admin-users-list" style="max-height:400px; overflow-y:auto;"></div>
        </div>
        <div id="admin-simulate-tab" class="admin-tab hidden">
          <p style="color:var(--text-secondary);">নির্দিষ্ট ইউজারের জন্য টেস্ট ডাটা তৈরি</p>
          <input type="text" id="simulate-user-email" placeholder="ইউজার ইমেইল">
          <input type="number" id="simulate-days" placeholder="কত দিন? (1-30)" min="1" max="30" value="7">
          <input type="number" id="simulate-start-day" placeholder="শুরু দিন (1-30)" min="1" max="30" value="1">
          <button class="btn btn-sm btn-accent" onclick="simulateUserDays()">সিমুলেট</button>
        </div>
        <div id="admin-community-tab" class="admin-tab hidden">
          <p style="color:var(--text-secondary);">পোস্ট ও কমেন্ট মডারেশন</p>
          <div id="admin-posts-list" style="max-height:400px; overflow-y:auto;"></div>
        </div>
        <div id="admin-content-tab" class="admin-tab hidden">
          <p style="color:var(--text-secondary);">লেসন / কুইজ / ভিডিও যোগ করুন</p>
          <select id="content-type-select" onchange="setupContentForm()">
            <option value="lesson">লেসন</option>
            <option value="quiz">কুইজ</option>
            <option value="video">ভিডিও</option>
          </select>
          <div id="content-form-fields"></div>
          <button class="btn btn-sm btn-accent" onclick="addContent()">যোগ করো</button>
          <div style="margin-top:24px;">
            <h4>বর্তমান কনটেন্ট তালিকা</h4>
            <div id="content-list-section"></div>
          </div>
          <div style="margin-top:16px;">
            <h4>ইমেজ আপলোড (Vercel Blob)</h4>
            <input type="file" id="image-upload" accept="image/*">
            <button class="btn btn-sm btn-accent" onclick="uploadImage()">আপলোড</button>
          </div>
        </div>
        <div id="admin-assessment-tab" class="admin-tab hidden">
          <h4>📋 অ্যাসেসমেন্ট প্রশ্ন</h4>
          <div id="assessment-list" style="max-height:300px; overflow-y:auto;"></div>
          <button class="btn btn-sm btn-accent" onclick="addAssessmentQuestion()">+ প্রশ্ন যোগ</button>
          <input type="text" id="new-assessment-q" placeholder="প্রশ্ন">
          <input type="text" id="new-assessment-cat" placeholder="ক্যাটাগরি">
        </div>
        <div id="admin-benefits-tab" class="admin-tab hidden">
          <h4>🎁 বেনিফিট</h4>
          <div id="benefits-list" style="max-height:300px; overflow-y:auto;"></div>
          <button class="btn btn-sm btn-accent" onclick="addBenefit()">+ বেনিফিট যোগ</button>
          <input type="text" id="new-benefit-title" placeholder="শিরোনাম">
          <textarea id="new-benefit-desc" placeholder="বিস্তারিত"></textarea>
          <input type="text" id="new-benefit-icon" placeholder="আইকন (ইমোজি)">
        </div>
        <div id="admin-analytics-tab" class="admin-tab hidden">
          <p style="color:var(--text-secondary);">গত ৭ দিনের সক্রিয় ইউজার</p>
          <div id="analytics-chart" style="max-height:300px;"></div>
        </div>
        <div id="admin-chapters-tab" class="admin-tab hidden">
          <h4>📚 চ্যাপ্টার ম্যানেজমেন্ট</h4>
          <button class="btn btn-sm btn-accent" onclick="openChapterEditor()">+ নতুন চ্যাপ্টার</button>
          <div id="chapter-editor-form" class="glass hidden" style="margin-top:16px;">
            <h4 id="chapter-editor-title">নতুন চ্যাপ্টার</h4>
            <div class="grid-2">
              <input type="text" id="ch-title" placeholder="শিরোনাম">
              <input type="number" id="ch-order" placeholder="ক্রম" min="1">
            </div>
            <textarea id="ch-content" placeholder="HTML কন্টেন্ট"></textarea>
            <div class="grid-2">
              <input type="url" id="ch-image" placeholder="ছবির URL">
              <input type="url" id="ch-video" placeholder="ভিডিও URL">
            </div>
            <input type="number" id="ch-passing" placeholder="পাসিং স্কোর (%)" value="90" min="0" max="100">
            <div style="margin-top:12px;">
              <button class="btn btn-accent btn-sm" onclick="saveChapter()">সংরক্ষণ</button>
              <button class="btn btn-outline btn-sm" onclick="cancelChapterEdit()">বাতিল</button>
            </div>
            <input type="hidden" id="ch-edit-id" value="">
          </div>
          <div id="chapters-list" style="margin-top:20px;"></div>
          <div id="question-manager-modal" class="modal-overlay hidden" aria-modal="true" role="dialog">
            <div class="glass modal-content" style="max-width:700px; width:95%; max-height:90vh; overflow-y:auto;">
              <button class="btn btn-sm btn-outline" onclick="closeQuestionManager()" style="float:right;">✕</button>
              <h3 id="qm-title"></h3>
              <div id="qm-questions-list" style="max-height:300px; overflow-y:auto; margin-bottom:12px;"></div>
              <button class="btn btn-sm btn-accent" onclick="openQuestionForm()">+ প্রশ্ন যোগ</button>
              <div id="qm-question-form" class="hidden">
                <textarea id="qm-question-text" placeholder="প্রশ্ন"></textarea>
                <div class="grid-2">
                  <input type="text" id="qm-opt0" placeholder="অপশন 1">
                  <input type="text" id="qm-opt1" placeholder="অপশন 2">
                  <input type="text" id="qm-opt2" placeholder="অপশন 3">
                  <input type="text" id="qm-opt3" placeholder="অপশন 4">
                </div>
                <input type="number" id="qm-correct" placeholder="সঠিক উত্তর (0-3)" min="0" max="3">
                <input type="text" id="qm-explanation" placeholder="ব্যাখ্যা (ঐচ্ছিক)">
                <button class="btn btn-accent btn-sm" onclick="saveQuestion()">সংরক্ষণ</button>
                <button class="btn btn-outline btn-sm" onclick="cancelQuestionEdit()">বাতিল</button>
                <input type="hidden" id="qm-edit-qid" value="">
                <input type="hidden" id="qm-chapter-id" value="">
              </div>
            </div>
          </div>
        </div>
        <div id="admin-courses-tab" class="admin-tab hidden">
          <h4>📚 কোর্স ম্যানেজমেন্ট</h4>
          <button class="btn btn-sm btn-accent" onclick="showCourseForm()">+ নতুন কোর্স</button>
          <div id="course-form" class="glass hidden" style="margin-top:16px;">
            <div class="form-group"><label>শিরোনাম</label><input type="text" id="course-title"></div>
            <div class="form-group"><label>বিবরণ</label><textarea id="course-desc"></textarea></div>
            <button class="btn btn-accent btn-sm" onclick="saveCourse()">সংরক্ষণ</button>
            <button class="btn btn-outline btn-sm" onclick="cancelCourseForm()">বাতিল</button>
            <input type="hidden" id="course-edit-id" value="">
          </div>
          <div id="courses-list" style="margin-top:20px;"></div>
        </div>
        <div id="admin-activity-tab" class="admin-tab hidden">
          <h4>📋 অ্যাক্টিভিটি লগ</h4>
          <div id="activity-log-table" style="max-height:400px; overflow-y:auto;"></div>
        </div>
        <div id="admin-settings-tab" class="admin-tab hidden">
          <div class="glass">
            <h3>⚙️ অ্যাডমিন সেটিংস</h3>
            <div class="form-group"><label>বর্তমান পাসওয়ার্ড</label><input type="password" id="current-password"></div>
            <div class="form-group"><label>নতুন পাসওয়ার্ড</label><input type="password" id="new-password"></div>
            <div class="form-group"><label>নতুন পাসওয়ার্ড আবার</label><input type="password" id="confirm-password"></div>
            <button class="btn btn-accent" onclick="changeAdminPassword()">পাসওয়ার্ড পরিবর্তন</button>
            <div id="settings-message" style="margin-top:12px;"></div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- AI Coach -->
  <div id="ai-coach-fab" class="fab" onclick="toggleAiCoach()">
    <span>🧠</span>
  </div>
  <div id="ai-coach-drawer" class="drawer hidden">
    <p id="ai-coach-message">লোড হচ্ছে...</p>
  </div>

  <div class="container" id="app">
    <div id="auth-screen" class="glass hidden" style="text-align:center;">
      <div style="font-size:60px; margin-bottom:12px; animation:float 3s infinite;">📈</div>
      <h1 class="gold-text" style="font-size:2.4rem;">AlamQuant <span style="color:var(--gold-bright);">ATTS</span></h1>
      <p style="text-align:center; color:var(--text-secondary); margin-bottom:24px; font-family:'Hind Siliguri', sans-serif; font-size:1.1rem;" data-i18n="brand.promise">"ধনী হওয়ার প্রতিশ্রুতি নয়, একজন শৃঙ্খলাবদ্ধ ট্রেডারে পরিণত হওয়ার যাত্রা।"</p>
      <div id="login-form">
        <input type="text" id="login-name" placeholder="তোমার নাম">
        <input type="email" id="login-email" placeholder="ইমেইল">
        <input type="password" id="login-password" placeholder="পাসওয়ার্ড">
        <button class="btn btn-lg" onclick="login()" style="width:100%; margin-top:8px;">লগইন</button>
        <button class="btn btn-outline btn-sm" onclick="showRegister()" style="width:100%; margin-top:8px;">নতুন অ্যাকাউন্ট খুলুন</button>
        <div style="margin:16px 0; color:var(--text-secondary);">— অথবা —</div>
        <div id="google-signin-btn" style="display:flex; justify-content:center;"></div>
      </div>
      <div id="register-form" class="hidden">
        <input type="text" id="reg-name" placeholder="তোমার নাম">
        <input type="email" id="reg-email" placeholder="ইমেইল">
        <input type="password" id="reg-password" placeholder="পাসওয়ার্ড (সর্বনিম্ন ৬)">
        <div class="flex" style="gap:4px; justify-content:center;">
          <label style="color:white;">অ্যাভাটার:</label>
          <select id="reg-avatar" style="width:auto;">
            <option value="🙂">🙂 শিক্ষার্থী</option>
            <option value="🧠">🧠 চিন্তাবিদ</option>
            <option value="🦅">🦅 ঈগল</option>
            <option value="🐺">🐺 ওলভস</option>
            <option value="💹">💹 চার্টিস্ট</option>
            <option value="🛡️">🛡️ রক্ষক</option>
          </select>
        </div>
        <button class="btn btn-lg" onclick="register()" style="width:100%; margin-top:8px;">অ্যাকাউন্ট খুলুন</button>
        <button class="btn btn-outline btn-sm" onclick="showLogin()" style="width:100%; margin-top:8px;">ইতিমধ্যে অ্যাকাউন্ট আছে? লগইন</button>
      </div>
    </div>

    <div id="dashboard" class="hidden">
      <div id="daily-quest-card" class="glass quest-card">
        <div class="quest-header">
          <span data-i18n="quest.target">🎯 আজকের লক্ষ্য</span>
          <span class="xp-reward">+15 XP</span>
        </div>
        <p id="quest-desc">লোড হচ্ছে...</p>
        <div class="quest-progress">
          <div class="progress-bar" style="flex:1;">
            <div id="quest-fill" class="progress-fill" style="width:0%"></div>
          </div>
          <button id="claim-quest-btn" class="btn btn-sm btn-accent" disabled onclick="claimQuestReward()" data-i18n="quest.claim">পুরস্কার নাও</button>
        </div>
      </div>

      <div class="glass" style="padding:18px 22px;">
        <div class="flex" style="justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div class="flex" style="gap:10px;">
            <span id="user-avatar" style="font-size:42px;">🙂</span>
            <div>
              <strong id="user-display-name" style="font-size:1.2rem; color:var(--gold-light);"></strong>
              <div style="font-size:12px; color:var(--text-secondary);" data-i18n="profile.level">Lv. <span id="user-level">1</span> · <span id="user-identity" class="phase-tag">Beginner</span></div>
            </div>
          </div>
          <div class="flex" style="gap:8px;">
            <div class="mini-stat"><span id="streak-badge" class="streak-fire">🔥 <span id="streak-count">0</span></span></div>
            <div class="mini-stat">⭐ <span id="xp-display">0 XP</span></div>
          </div>
        </div>
        <div class="xp-bar-container"><div id="xp-bar-fill" class="xp-bar-fill" style="width:0%"><span class="xp-text">Lv. <span id="user-level-bar">1</span></span></div></div>
        <div class="flex" style="justify-content:space-between;">
          <small style="color:var(--text-secondary);" data-i18n="xp.next">পরবর্তী লেভেল: <span id="xp-next">0</span> XP</small>
          <small style="color:var(--accent-bright); cursor:pointer;" onclick="showTab('profile')">⚙️ রিমাইন্ডার</small>
        </div>
      </div>
      <div class="admin-gear hidden" onclick="openAdminPanel()">⚙️</div>

      <!-- Assessment prompt (visible until first assessment) -->
      <div class="glass" id="assessment-prompt" style="text-align:center;">
        <button class="btn btn-accent btn-lg" onclick="showAssessment()" data-i18n="assessment.prompt">📋 আপনার অবস্থা যাচাই করুন</button>
      </div>
      <div id="assessment-screen" class="glass hidden">
        <h2 data-i18n="assessment.title">🧭 ট্রেডিং মানসিকতা নিরীক্ষণ</h2>
        <div id="assessment-questions"></div>
        <button class="btn btn-accent" onclick="submitAssessment()" data-i18n="assessment.submit">বিশ্লেষণ দেখুন</button>
        <div id="assessment-result" class="hidden"></div>
      </div>

      <div id="tab-journey" class="tab-content">
        <div class="glass" id="weekly-challenge-card"></div>
        <div class="glass">
          <h3 data-i18n="journey.today">আজকের যাত্রা (Day <span id="day-count">1</span>)</h3>
          <div id="morning-section">
            <p style="color:var(--accent-bright);">🌅 মর্নিং মাইন্ডফুলনেস (১ মিনিট গভীর শ্বাস)</p>
            <iframe width="100%" height="60" src="https://www.youtube.com/embed/inpok4MKVLM" style="border-radius:12px; margin:12px 0;" allowfullscreen></iframe>
            <label class="flex"><input type="checkbox" id="mindfulness-done"> সম্পন্ন করেছি</label>
            <p style="margin-top:8px;">✍️ আজকের প্রতিজ্ঞা:</p>
            <textarea id="commitment" rows="2" placeholder="আমি আজ নিয়ম মেনে ট্রেড করবো..."></textarea>
            <button class="btn btn-lg" onclick="submitCheckin()" style="margin-top:8px;">✅ চেক-ইন সম্পন্ন</button>
          </div>
          <div id="checkin-done-msg" class="hidden" style="color:var(--success); margin-top:12px; font-weight:600;">✅ চেক-ইন সম্পন্ন। এখন ইভ্যালুয়েশন করো।</div>
          <div id="evaluation-section" class="hidden">
            <div id="mood-picker" class="mood-picker">
              <span data-i18n="evaluation.mood">আজকের ট্রেডিং মুড:</span>
              <span class="mood-emoji" data-mood="happy">😊</span>
              <span class="mood-emoji" data-mood="neutral">😐</span>
              <span class="mood-emoji" data-mood="stressed">😰</span>
              <span class="mood-emoji" data-mood="angry">😡</span>
            </div>
            <hr style="border-color:var(--border-gold); margin:20px 0; opacity:0.5;">
            <h4 data-i18n="evaluation.title">📊 ট্রেডিং সেশন ইভ্যালুয়েশন (১০-প্রশ্ন, ১০০)</h4>
            <div id="score-sliders"></div>
            <div class="grid-2" style="margin-top:12px;">
              <div><label data-i18n="eval.trades">ট্রেড সংখ্যা</label><input type="number" id="trades-count" value="0" min="0"></div>
              <div><label data-i18n="eval.sl">স্টপ লস সরিয়েছ?</label><select id="stop-loss-moved"><option value="false">না</option><option value="true">হ্যাঁ</option></select></div>
              <div><label data-i18n="eval.plan">প্ল্যানের বাইরে?</label><select id="plan-deviation"><option value="false">না</option><option value="true">হ্যাঁ</option></select></div>
              <div><label data-i18n="eval.revenge">রিভেঞ্জ ট্রেড?</label><select id="revenge-trade"><option value="false">না</option><option value="true">হ্যাঁ</option></select></div>
              <div><label data-i18n="eval.fomo">FOMO?</label><select id="fomo-entry"><option value="false">না</option><option value="true">হ্যাঁ</option></select></div>
              <div><label data-i18n="eval.overtrading">ওভারট্রেডিং?</label><select id="overtrading"><option value="false">না</option><option value="true">হ্যাঁ</option></select></div>
              <div><label data-i18n="eval.rules">নিয়ম মেনেছি?</label><select id="rule-followed"><option value="true">হ্যাঁ</option><option value="false">না</option></select></div>
            </div>
            <textarea id="evaluation-notes" rows="1" placeholder="নোট (ঐচ্ছিক)"></textarea>
            <textarea id="reflection" rows="2" placeholder="আজকের শিক্ষা, আগামীকালের পরিকল্পনা"></textarea>
            <div id="reflection-prompts" style="color:var(--accent-bright); margin:6px 0; font-style:italic;"></div>
            <button class="btn btn-lg" onclick="submitEvaluation()" data-i18n="eval.submit">ইভ্যালুয়েশন সাবমিট</button>
          </div>
          <div id="feedback-area" class="hidden">
            <hr style="border-color:var(--border-gold); margin:20px 0; opacity:0.5;">
            <h4 data-i18n="feedback.title">🧠 AI Coach ফিডব্যাক</h4>
            <p id="feedback-text" style="background:rgba(255,255,255,0.04); padding:14px; border-radius:14px; border-left:4px solid var(--accent-bright);"></p>
            <p><strong style="color:var(--gold);">📌 আগামীকালের মিশন:</strong> <span id="tomorrow-mission"></span></p>
            <div id="new-badges" class="flex" style="margin-top:6px;"></div>
            <button id="mystery-box-btn" class="btn btn-accent hidden" onclick="showMysteryBox()" style="margin-top:8px;">🎁 মিস্ট্রি বক্স খোলো!</button>
          </div>
          <div id="quiz-modal" class="hidden" style="margin-top:20px;">
            <h4 style="color:var(--accent-bright);">🧪 আজকের কুইজ (অতিরিক্ত XP)</h4>
            <p id="quiz-question"></p>
            <div id="quiz-options"></div>
            <button class="btn btn-sm btn-accent" onclick="submitQuiz()">উত্তর দিন</button>
            <div id="quiz-done" class="hidden" style="color:var(--success); margin-top:8px; font-weight:600;">✅ আজকের কুইজ সম্পন্ন হয়েছে</div>
          </div>
        </div>
      </div>

      <div id="tab-habits" class="tab-content hidden">
        <div class="glass" style="text-align:right; margin-bottom:12px;">
          <button class="btn btn-sm btn-accent" onclick="showAddHabitForm()">+ নতুন অভ্যাস</button>
        </div>
        <div id="habits-list"></div>
        <div id="add-habit-modal" class="modal-overlay hidden" aria-modal="true" role="dialog">
          <div class="glass modal-content">
            <h3>নতুন অভ্যাস যোগ করো</h3>
            <input type="text" id="new-habit-title" placeholder="অভ্যাসের নাম (যেমন: মেডিটেশন, ব্যায়াম)">
            <div class="flex" style="gap:8px;">
              <label>আইকন:</label>
              <select id="new-habit-icon">
                <option value="🧘">🧘 ধ্যান</option>
                <option value="🏃">🏃 দৌড়ানো</option>
                <option value="📖">📖 পড়া</option>
                <option value="💧">💧 পানি</option>
                <option value="✍️">✍️ জার্নাল</option>
                <option value="🍎">🍎 স্বাস্থ্যকর</option>
                <option value="💪">💪 ব্যায়াম</option>
              </select>
              <label>রঙ:</label>
              <input type="color" id="new-habit-color" value="#eab308" style="width:50px;">
            </div>
            <label>রিমাইন্ডার সময় (কমা দিয়ে, যেমন: 06:00,12:00,20:00)</label>
            <input type="text" id="new-habit-times" placeholder="06:00,12:00,20:00">
            <button class="btn btn-lg" onclick="saveHabit()">সংরক্ষণ</button>
            <button class="btn btn-outline btn-sm" onclick="document.getElementById('add-habit-modal').classList.add('hidden')">বাতিল</button>
          </div>
        </div>
      </div>

      <!-- ট্রেনিং ট্যাব -->
      <div id="tab-training" class="tab-content hidden">
        <div class="glass" style="margin-bottom:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span>⚡ এনার্জি</span>
            <span><strong id="energy-current">50</strong>/<span id="energy-max">50</span></span>
          </div>
          <div class="progress-bar" style="height:12px;">
            <div id="energy-fill" class="progress-fill" style="width:100%; background:linear-gradient(90deg, #38bdf8, #0284c7);"></div>
          </div>
        </div>
        <div class="glass">
          <h2>📚 ট্রেডার ট্রেনিং একাডেমি</h2>
          <p style="color:var(--text-secondary); margin-bottom:16px;">প্রতিটি চ্যাপ্টার সম্পূর্ণ করে কুইজে ৯০%+ স্কোর করে পরবর্তী ধাপে যান</p>
          <div id="chapter-list" class="grid-2"></div>
        </div>
        <div id="final-exam-section" class="glass hidden" style="text-align:center; margin-top:16px;">
          <h3>🏆 ফাইনাল পরীক্ষা</h3>
          <p style="color:var(--text-secondary);">আপনি সব চ্যাপ্টার সম্পূর্ণ করেছেন! এখন ফাইনাল পরীক্ষা দিন।</p>
          <button class="btn btn-accent btn-lg" onclick="startFinalExam()">ফাইনাল পরীক্ষা শুরু</button>
        </div>
      </div>

      <div id="tab-progress" class="tab-content hidden">
        <div class="glass">
          <h3>📈 অগ্রগতি</h3>
          <div class="progress-bar"><div id="progress-fill" class="progress-fill"></div></div>
          <p>৩০ দিনের জার্নি: <strong id="progress-text">0%</strong></p>
          <div class="timeline" id="journey-timeline"></div>
          <p style="color:var(--text-secondary);">ডিসিপ্লিন স্ট্রিক: <strong id="discipline-streak-text">0</strong> দিন (Q6 ≥ 8)</p>
          <h4 style="margin-top:16px;">📅 গত ৩০ দিন</h4>
          <div id="heatmap" class="flex" style="gap:4px; overflow-x:auto; padding:8px 0;"></div>
          <div id="badges-list" class="flex" style="margin:10px 0; gap:6px;"></div>
          <div style="max-width:420px; margin:20px auto;"><canvas id="radarChart" class="chart-container" style="max-height:260px;"></canvas></div>
          <canvas id="scoresChart" class="chart-container"></canvas>
          <p style="margin-top:10px;"><strong>Identity Phase:</strong> <span id="identity-phase-text" class="phase-tag">Beginner</span></p>
          <button id="certificate-btn" class="btn btn-accent hidden" onclick="downloadCertificate()">🏆 সার্টিফিকেট ডাউনলোড</button>
          <button id="share-certificate-btn" class="btn btn-outline hidden" onclick="shareCertificate()" style="margin-left:10px;">📤 শেয়ার</button>
        </div>
      </div>

      <div id="tab-insights" class="tab-content hidden">
        <div class="glass">
          <h3>📊 ইনসাইটস</h3>
          <div id="insights-content">লোড হচ্ছে...</div>
        </div>
      </div>

      <div id="tab-lessons" class="tab-content hidden">
        <div class="glass">
          <div class="flex" style="justify-content:space-between;">
            <h3>📚 লার্নিং পাথ</h3>
            <button class="btn btn-sm btn-outline" onclick="showTab('videos')">🎥 ভিডিও</button>
          </div>
          <div id="lessons-list"></div>
        </div>
      </div>

      <div id="tab-videos" class="tab-content hidden">
        <div class="glass">
          <div class="flex" style="justify-content:space-between;">
            <h3>🎥 শিক্ষামূলক ভিডিও</h3>
            <button class="btn btn-sm btn-outline" onclick="showTab('lessons')">📚 লেসন</button>
          </div>
          <div id="video-grid" class="video-grid"></div>
        </div>
      </div>

      <div id="tab-community" class="tab-content hidden">
        <div class="glass">
          <div class="flex" style="justify-content:space-between;">
            <h3>🌍 কমিউনিটি</h3>
            <button class="btn btn-sm btn-outline" onclick="showTab('leaderboard')">🏆 লিডারবোর্ড</button>
          </div>
          <div class="flex" style="margin-bottom:12px; gap:8px;">
            <select id="post-type"><option value="lesson">শিক্ষা</option><option value="mistake">ভুল</option><option value="rule">নিয়ম</option><option value="general">সাধারণ</option></select>
            <textarea id="post-content" rows="1" placeholder="তোমার অভিজ্ঞতা শেয়ার করো..."></textarea>
            <button class="btn btn-sm" onclick="submitPost()">পোস্ট</button>
          </div>
          <div id="posts-container"></div>
        </div>
      </div>

      <div id="tab-leaderboard" class="tab-content hidden">
        <div class="glass">
          <h3>🏆 সাপ্তাহিক লিডারবোর্ড</h3>
          <div id="my-rank" style="margin-bottom:10px; font-weight:600; color:var(--accent-bright);"></div>
          <div id="leaderboard-list"></div>
        </div>
      </div>

      <div id="tab-profile" class="tab-content hidden">
        <div class="glass">
          <h3>👤 প্রোফাইল</h3>
          <p><strong>নাম:</strong> <span id="profile-name"></span></p>
          <p><strong>ইমেইল:</strong> <span id="profile-email"></span></p>
          <div class="flex" style="margin:10px 0;">
            <span style="font-size:40px;" id="profile-avatar"></span>
            <select id="avatar-select" style="width:auto;">
              <option value="🙂">🙂</option><option value="🧠">🧠</option><option value="🦅">🦅</option><option value="🐺">🐺</option><option value="💹">💹</option><option value="🛡️">🛡️</option>
            </select>
            <button class="btn btn-sm" onclick="changeAvatar()">আপডেট</button>
          </div>
          <h4>🌱 অ্যাভাটার ইভোলিউশন</h4>
          <div id="avatar-evolution" class="evolution-tree">
            <div class="stage" data-phase="Awareness">🌱 Awareness</div>
            <div class="stage" data-phase="Discipline">🌿 Discipline</div>
            <div class="stage" data-phase="Consistency">🌳 Consistency</div>
            <div class="stage" data-phase="Psychology">🧠 Psychology</div>
            <div class="stage" data-phase="Professional">💼 Pro</div>
            <div class="stage" data-phase="Institutional">🏛️ Institutional</div>
          </div>
          <h4>🏅 ব্যাজ</h4>
          <div id="profile-badges" class="flex" style="gap:6px;"></div>
          <hr style="border-color:var(--border-gold); margin:20px 0; opacity:0.5;">
          <h4>⏰ রিমাইন্ডার সেটিংস</h4>
          <p style="color:var(--text-secondary); font-size:0.85rem;">প্রতিদিনের চেক-ইন রিমাইন্ডার</p>
          <input type="time" id="reminder-time" value="08:00" style="flex:1;">
          <button class="btn btn-sm btn-accent" onclick="saveReminderTime()">সেভ</button>
          <h4 style="margin-top:16px;">⚙️ নোটিফিকেশন</h4>
          <label class="flex"><input type="checkbox" id="notif-email" checked> ইমেইল</label>
          <label class="flex"><input type="checkbox" id="notif-push" checked> পুশ নোটিফিকেশন</label>
          <button class="btn btn-sm" onclick="updateNotifSettings()">সেভ</button>
          <div style="margin-top:16px;">
            <label>🌐 ভাষা:</label>
            <select id="lang-select" onchange="i18n.load(this.value)">
              <option value="bn">বাংলা</option>
              <option value="en">English</option>
            </select>
          </div>
          <button class="btn btn-outline btn-sm" style="margin-top:20px; width:100%;" onclick="logout()">লগআউট</button>
        </div>
      </div>
    </div>
  </div>

  <!-- চ্যাপ্টার ভিউ মোডাল -->
  <div id="chapter-modal" class="modal-overlay hidden" aria-modal="true" role="dialog">
    <div class="glass modal-content" style="max-width:800px; max-height:90vh; overflow-y:auto; width:95%;">
      <button class="btn btn-sm btn-outline" style="float:right;" onclick="closeChapterModal()">✕</button>
      <h2 id="chapter-modal-title"></h2>
      <img id="chapter-modal-image" style="max-width:100%; border-radius:12px; margin:16px 0; display:none;" />
      <div id="chapter-modal-video-container" style="display:none; margin:16px 0;">
        <iframe id="chapter-modal-video" width="100%" height="400" frameborder="0" allowfullscreen></iframe>
      </div>
      <div id="chapter-modal-content" style="color:var(--text); line-height:1.8; font-size:1rem;"></div>
      <hr style="border-color:var(--border-gold); margin:24px 0;">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h3>🧪 কুইজ</h3>
        <select id="quiz-mode-select" onchange="setQuizMode()" style="width:auto;">
          <option value="learning">Learning</option>
          <option value="practice">Practice (30s/question)</option>
        </select>
      </div>
      <div id="practice-timer" style="color:var(--accent-bright); font-weight:bold; margin-bottom:8px;"></div>
      <div id="quiz-container"></div>
      <div id="quiz-result" class="hidden"></div>
      <button class="btn btn-accent btn-lg" id="submit-quiz-btn" onclick="submitChapterQuiz()" style="margin-top:16px;">উত্তর জমা দিন</button>
      <button class="btn btn-outline" id="retry-chapter-btn" onclick="closeChapterModal()" style="margin-top:8px; display:none;">পুনরায় পড়ুন</button>
    </div>
  </div>

  <!-- ফাইনাল এক্সাম মোডাল -->
  <div id="final-exam-modal" class="modal-overlay hidden" aria-modal="true" role="dialog">
    <div class="glass modal-content" style="max-width:800px; max-height:90vh; overflow-y:auto; width:95%;">
      <h2>🏆 ফাইনাল পরীক্ষা</h2>
      <p style="color:var(--text-secondary);">সময়সীমা: ২০ মিনিট | পাসিং স্কোর: ৮০%</p>
      <div style="display:flex; gap:20px; align-items:center;">
        <div>⏳ <span id="overall-timer">20:00</span></div>
        <div style="color:var(--text-secondary);">প্রতি প্রশ্নে প্রস্তাবিত 30s</div>
      </div>
      <div id="final-exam-questions"></div>
      <button class="btn btn-accent btn-lg" onclick="submitFinalExam()" style="margin-top:16px;">জমা দিন</button>
      <div id="final-exam-result" class="hidden"></div>
    </div>
  </div>

  <div class="bottom-nav hidden">
    <div class="nav-item" data-tab="journey"><span>📅</span> যাত্রা</div>
    <div class="nav-item" data-tab="habits"><span>✅</span> অভ্যাস</div>
    <div class="nav-item" data-tab="training"><span>📚</span> প্রশিক্ষণ</div>
    <div class="nav-item" data-tab="progress"><span>📈</span> অগ্রগতি</div>
    <div class="nav-item" data-tab="community"><span>🌍</span> কমিউনিটি</div>
    <div class="nav-item" data-tab="profile"><span>👤</span> প্রোফাইল</div>
  </div>

  <script>
    // ==================== Global Config ====================
    const API = '/api/setup';
    let token = localStorage.getItem('token');
    let adminToken = localStorage.getItem('adminToken');
    let chart = null, radarChart = null;
    let currentTab = 'journey';
    let quizData = null;
    let currentUser = null;
    let previousLevel = null;
    let habitDefinitions = [];
    let todayLogs = [];
    let activeReminders = [];
    let selectedMood = null;
    let currentChapterId = null;
    let currentChapterQuestions = [];
    let currentQuizMode = 'learning';
    let practiceTimer = null;
    let currentResetUserId = null;

    function escapeHtml(text) {
      if (!text) return '';
      return String(text).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    function showToast(msg, dur=3000) {
      const t = document.getElementById('toast');
      t.textContent = msg; t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), dur);
    }

    function celebrate(msg) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ['#eab308','#fef08a','#38bdf8','#f43f5e'] });
      showToast(msg || '🎉');
    }

    // ================== i18n Engine ==================
    const i18n = {
      lang: localStorage.getItem('lang') || 'bn',
      translations: {},
      async init() {
        await this.load(this.lang);
      },
      async load(lang) {
        try {
          const res = await fetch(`${API}/translations?lang=${lang}`);
          this.translations = await res.json();
        } catch(e) { this.translations = {}; }
        this.lang = lang;
        localStorage.setItem('lang', lang);
        const sel = document.getElementById('lang-select');
        if (sel) sel.value = lang;
        this.apply();
      },
      t(key, fallback = '') {
        return this.translations[key] || fallback;
      },
      apply() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
          const key = el.dataset.i18n;
          el.textContent = this.t(key, el.textContent);
        });
      }
    };

    // ================== API Call functions ==================
    async function apiCall(method, path, body) {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const opts = { method, headers };
      if (body) opts.body = JSON.stringify(body);
      try {
        const res = await fetch(`${API}${path}`, opts);
        if (res.status === 401) { logout(); return null; }
        return res.json();
      } catch(e) { return { error: 'Network error' }; }
    }

    async function adminApiCall(method, path, body = null) {
      const headers = { 'Content-Type': 'application/json' };
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
      const opts = { method, headers };
      if (body) opts.body = JSON.stringify(body);
      try {
        const res = await fetch(`${API}${path}`, opts);
        if (res.status === 401) {
          document.getElementById('admin-panel').classList.add('hidden');
          document.getElementById('admin-login-form').classList.remove('hidden');
          adminToken = null;
          localStorage.removeItem('adminToken');
          showToast('অ্যাডমিন সেশন শেষ হয়েছে');
          return null;
        }
        return res.json();
      } catch(e) {
        return { error: 'Network error' };
      }
    }

    // Starfield background
    (function(){
      const canvas = document.getElementById('bgCanvas');
      const ctx = canvas.getContext('2d');
      let stars = [], shootingStars = [];
      function resizeBg() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
      function createStars(count) {
        stars = [];
        for(let i=0;i<count;i++) stars.push({
          x: Math.random()*canvas.width, y: Math.random()*canvas.height,
          r: Math.random()*1.5+0.5, o: Math.random()*0.6+0.2, speed: 0.02+Math.random()*0.08
        });
      }
      function animateStars() {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        const grd = ctx.createRadialGradient(canvas.width*0.2, canvas.height*0.3, 0, canvas.width*0.5, canvas.height*0.5, canvas.width);
        grd.addColorStop(0, 'rgba(100, 0, 150, 0.05)');
        grd.addColorStop(0.5, 'rgba(0, 100, 200, 0.03)');
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.fillRect(0,0,canvas.width,canvas.height);
        stars.forEach(s => {
          ctx.fillStyle = `rgba(255,255,255,${s.o})`;
          ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
          s.y -= s.speed;
          if(s.y < -5) { s.y = canvas.height+5; s.x = Math.random()*canvas.width; }
        });
        if (Math.random() < 0.02) {
          const sx = Math.random()*canvas.width, sy = Math.random()*canvas.height*0.5;
          shootingStars.push({ x: sx, y: sy, life: 1.0 });
        }
        shootingStars.forEach((s, idx) => {
          ctx.strokeStyle = `rgba(255,255,255,${s.life})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x+80, s.y-50);
          ctx.stroke();
          s.life -= 0.02;
          s.x += 4;
          s.y -= 2.5;
          if (s.life <= 0) shootingStars.splice(idx,1);
        });
        requestAnimationFrame(animateStars);
      }
      window.addEventListener('resize', ()=>{ resizeBg(); createStars(150); });
      resizeBg(); createStars(150); animateStars();
    })();

    function createRipple(e, el) {
      const circle = document.createElement('span');
      const d = Math.max(el.clientWidth, el.clientHeight);
      const r = d/2;
      const rect = el.getBoundingClientRect();
      circle.style.width = circle.style.height = d+'px';
      circle.style.left = (e.clientX - rect.left - r)+'px';
      circle.style.top = (e.clientY - rect.top - r)+'px';
      circle.classList.add('ripple');
      el.appendChild(circle);
      setTimeout(() => circle.remove(), 600);
    }
    document.addEventListener('click', function(e) {
      const btn = e.target.closest('.btn');
      if (btn) createRipple(e, btn);
    });

    function showFloatingXp(amount) {
      const el = document.createElement('div');
      el.className = 'float-xp';
      el.textContent = `+${amount} XP`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2000);
    }

    function resetUserPasswordUI(userId) {
      currentResetUserId = userId;
      document.getElementById('reset-pass-modal').classList.remove('hidden');
    }
    async function resetPasswordConfirm() {
      const pass = document.getElementById('new-pass-input').value;
      if (pass.length < 6) return showToast('পাসওয়ার্ড ৬+ অক্ষর দিন');
      await adminApiCall('POST', '/admin/reset-password', { user_id: currentResetUserId, new_password: pass });
      document.getElementById('reset-pass-modal').classList.add('hidden');
      document.getElementById('new-pass-input').value = '';
      showToast('পাসওয়ার্ড রিসেট হয়েছে');
    }
    function closeResetPassModal() {
      document.getElementById('reset-pass-modal').classList.add('hidden');
    }

    // Auth
    function showRegister() {
      document.getElementById('register-form').classList.remove('hidden');
      document.getElementById('login-form').classList.add('hidden');
    }
    function showLogin() {
      document.getElementById('register-form').classList.add('hidden');
      document.getElementById('login-form').classList.remove('hidden');
    }
    async function login() {
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const name = document.getElementById('login-name').value;
      if (!email || !password) return showToast('ইমেইল ও পাসওয়ার্ড প্রয়োজন');
      const data = await apiCall('POST', '/login', { email, password, display_name: name });
      if (data?.token) {
        token = data.token;
        localStorage.setItem('token', token);
        initDashboard(data.user);
      } else showToast(data?.error || 'Login failed');
    }
    async function register() {
      const email = document.getElementById('reg-email').value;
      const password = document.getElementById('reg-password').value;
      const name = document.getElementById('reg-name').value;
      if (!name) return showToast('নাম প্রয়োজন');
      if (password.length < 6) return showToast('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর');
      const avatar = document.getElementById('reg-avatar').value;
      const data = await apiCall('POST', '/register', { email, password, display_name: name, avatar_emoji: avatar });
      if (data?.token) {
        token = data.token;
        localStorage.setItem('token', token);
        initDashboard(data.user);
      } else showToast(data?.error || 'Registration failed');
    }
    function logout() {
      localStorage.removeItem('token'); token = null;
      localStorage.removeItem('adminToken'); adminToken = null;
      document.getElementById('auth-screen').classList.remove('hidden');
      document.getElementById('dashboard').classList.add('hidden');
      document.querySelector('.bottom-nav').classList.add('hidden');
      document.querySelector('.admin-gear').classList.add('hidden');
      clearAllReminders();
    }

    // Dashboard Init
    function updateXpBar(xp, level) {
      const xpForCurrent = (level-1)*75;
      const progress = Math.min(100, Math.max(0, ((xp - xpForCurrent) / 75) * 100));
      document.getElementById('xp-bar-fill').style.width = progress + '%';
      document.getElementById('xp-next').textContent = (level*75) - xp;
    }

    function showLevelUp(newLevel, oldLevel) {
      const titles = {5:'Apprentice Trader',10:'Disciplined Soldier',20:'Consistency Master',30:'Institutional Legend'};
      document.getElementById('level-up-title').innerHTML = `লেভেল ${newLevel}!`;
      document.getElementById('level-up-text').textContent = titles[newLevel] || `তুমি এখন লেভেল ${newLevel} এ পৌঁছে গেছো!`;
      document.getElementById('level-up-modal').classList.remove('hidden');
      confetti({ particleCount:200, spread:120, origin:{y:0.5}, colors:['#eab308','#fef08a','#38bdf8','#a78bfa'] });
    }

    async function checkStreakMilestone(streak) {
      if (streak === 7) {
        document.getElementById('streak-modal-title').textContent = '7 Day Streak!';
        document.getElementById('streak-modal-text').textContent = 'অভূতপূর্ব ধারাবাহিকতা! 50 XP বোনাস!';
        document.getElementById('streak-modal').classList.remove('hidden');
        confetti({ particleCount:250 });
      } else if (streak === 14) {
        document.getElementById('streak-modal-title').textContent = '14 Day Streak!';
        document.getElementById('streak-modal-text').textContent = 'তুমি এখন অপ্রতিরোধ্য! 100 XP বোনাস!';
        document.getElementById('streak-modal').classList.remove('hidden');
        confetti({ particleCount:350 });
      } else if (streak === 21) {
        document.getElementById('streak-modal-title').textContent = '21 Day Streak!';
        document.getElementById('streak-modal-text').textContent = 'কিংবদন্তি! 150 XP বোনাস ও বিশেষ ব্যাজ!';
        document.getElementById('streak-modal').classList.remove('hidden');
        confetti({ particleCount:500, spread:150 });
      } else if (streak === 30) {
        document.getElementById('streak-modal-title').textContent = '30 Day Master!';
        document.getElementById('streak-modal-text').textContent = 'তুমি এখন ইনস্টিটিউশনাল লেজেন্ড! 300 XP!';
        document.getElementById('streak-modal').classList.remove('hidden');
        confetti({ particleCount:800, spread:180 });
      }
    }

    function showMysteryBox() { document.getElementById('mystery-box-modal').classList.remove('hidden'); }
    async function openMysteryBox() {
      const res = await apiCall('POST', '/open-box');
      document.getElementById('mystery-box-modal').classList.add('hidden');
      if (res?.reward) celebrate(`🎁 ${res.reward} পেয়েছ!`);
      else showToast(res?.message || 'বক্স খালি!');
      loadProfile();
    }

    async function toggleAiCoach() {
      const drawer = document.getElementById('ai-coach-drawer');
      drawer.classList.toggle('hidden');
      if (!drawer.classList.contains('hidden')) {
        const feedbackRes = await fetch(`${API}/latest-feedback`, {headers:{'Authorization':`Bearer ${token}`}});
        const data = await feedbackRes.json();
        document.getElementById('ai-coach-message').textContent = data?.feedback || 'এখনো কোনো ফিডব্যাক নেই।';
      }
    }

    async function loadDailyQuest() {
      const quest = await apiCall('GET', '/daily-quest');
      if (!quest) return;
      const descMap = {
        'no_revenge': 'আজ রিভেঞ্জ ট্রেড থেকে বিরত থাকো',
        'no_fomo': 'আজ FOMO এন্ট্রি করো না',
        'q6_8plus': 'আজ Q6 (শৃঙ্খলা) স্কোর ৮ বা তার উপরে রাখো',
        'mindfulness': 'মাইন্ডফুলনেস অনুশীলন করো',
        'habit_complete': 'আজ একটি হ্যাবিট সম্পন্ন করো'
      };
      document.getElementById('quest-desc').textContent = descMap[quest.quest_type] || 'আজকের মিশন';
      document.getElementById('quest-fill').style.width = (quest.completed ? 100 : (quest.progress/quest.target)*100) + '%';
      const claimBtn = document.getElementById('claim-quest-btn');
      if (quest.completed && !quest.claimed) claimBtn.disabled = false;
      else { claimBtn.disabled = true; if (quest.claimed) claimBtn.textContent = 'দাবি করা হয়েছে'; }
    }

    async function claimQuestReward() {
      const res = await apiCall('POST', '/claim-quest-reward');
      if (res?.success) { celebrate('+15 XP!'); showFloatingXp(15); loadDailyQuest(); loadProfile(); }
      else showToast(res?.error || 'দাবি করতে ব্যর্থ');
    }

    // Admin login & panel
    async function adminLogin() {
      const email = document.getElementById('admin-email').value;
      const password = document.getElementById('admin-password').value;
      const res = await fetch(`${API}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.token) {
        adminToken = data.token;
        localStorage.setItem('adminToken', adminToken);

        document.getElementById('admin-login-form').classList.add('hidden');
        const panel = document.getElementById('admin-panel');
        panel.innerHTML = '<p style="color:var(--text-secondary);">লগইন সফল, ডাটা লোড হচ্ছে...</p>';
        panel.classList.remove('hidden');

        const stats = await adminApiCall('GET', '/admin/dashboard');
        if (stats && !stats.error) {
          document.getElementById('admin-stats-tab').innerHTML = `
            <div class="grid-2">
              <div class="mini-stat"><strong>মোট ইউজার:</strong> ${stats.totalUsers}</div>
              <div class="mini-stat"><strong>আজ সক্রিয়:</strong> ${stats.dailyActiveUsers}</div>
              <div class="mini-stat"><strong>মোট জার্নাল:</strong> ${stats.totalJournals}</div>
              <div class="mini-stat"><strong>ট্রেনিং সম্পন্ন:</strong> ${stats.completedTrainings}</div>
            </div>`;
          showAdminTab('stats');
        } else {
          document.getElementById('admin-panel').classList.add('hidden');
          document.getElementById('admin-login-form').classList.remove('hidden');
          document.getElementById('admin-login-error').textContent = stats?.error || 'ড্যাশবোর্ড লোড ব্যর্থ';
          document.getElementById('admin-login-error').style.display = 'block';
          adminToken = null;
          localStorage.removeItem('adminToken');
        }
      } else {
        document.getElementById('admin-login-error').textContent = data.error || 'Login failed';
        document.getElementById('admin-login-error').style.display = 'block';
      }
    }

    function openAdminPanel() {
      document.getElementById('admin-modal').classList.remove('hidden');
      if (adminToken) {
        document.getElementById('admin-login-form').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        showAdminTab('stats');
      } else {
        document.getElementById('admin-login-form').classList.remove('hidden');
        document.getElementById('admin-panel').classList.add('hidden');
      }
    }

    // Admin Tabs
    function showAdminTab(tab) {
      document.querySelectorAll('.admin-tab').forEach(el => el.classList.add('hidden'));
      const target = document.getElementById('admin-'+tab+'-tab');
      if (target) target.classList.remove('hidden');
      switch(tab) {
        case 'stats': loadAdminStats(); break;
        case 'users': loadAdminUsers(); break;
        case 'community': loadAdminCommunity(); break;
        case 'content': setupContentForm(); loadContentList(); break;
        case 'assessment': loadAdminAssessment(); break;
        case 'benefits': loadAdminBenefits(); break;
        case 'analytics': loadAdminAnalytics(); break;
        case 'chapters': loadAdminChapters(); break;
        case 'courses': loadCourses(); break;
        case 'activity': loadActivityLog(); break;
        case 'settings': break;
      }
    }

    async function loadAdminStats() {
      const data = await adminApiCall('GET', '/admin/dashboard');
      if (data && !data.error) {
        document.getElementById('admin-stats-tab').innerHTML = `
          <div class="grid-2">
            <div class="mini-stat"><strong>মোট ইউজার:</strong> ${data.totalUsers}</div>
            <div class="mini-stat"><strong>আজ সক্রিয়:</strong> ${data.dailyActiveUsers}</div>
            <div class="mini-stat"><strong>মোট জার্নাল:</strong> ${data.totalJournals}</div>
            <div class="mini-stat"><strong>ট্রেনিং সম্পন্ন:</strong> ${data.completedTrainings}</div>
          </div>`;
      }
    }
    async function loadAdminUsers() {
      const res = await adminApiCall('GET', '/admin/users');
      const list = document.getElementById('admin-users-list');
      if (res && !res.error) list.innerHTML = res.map(u => `
        <div class="user-card flex" style="justify-content:space-between;">
          <span>${escapeHtml(u.avatar_emoji||'🙂')} <strong>${escapeHtml(u.display_name||u.email)}</strong> - Lvl ${u.level} · ${escapeHtml(u.identity_level)}</span>
          <div>
            <span class="badge">${u.xp} XP</span>
            <button class="btn btn-sm btn-outline" onclick="resetUserPasswordUI('${u.id}')">🔑</button>
          </div>
        </div>`).join('');
    }
    async function searchAdminUsers() {
      const q = document.getElementById('admin-user-search').value;
      const res = await adminApiCall('GET', `/admin/users?search=${encodeURIComponent(q)}`);
      const list = document.getElementById('admin-users-list');
      if (res && !res.error) list.innerHTML = res.map(u => `
        <div class="user-card flex" style="justify-content:space-between;">
          <span>${escapeHtml(u.avatar_emoji||'🙂')} <strong>${escapeHtml(u.display_name||u.email)}</strong> - Lvl ${u.level} · ${escapeHtml(u.identity_level)}</span>
          <div>
            <span class="badge">${u.xp} XP</span>
            <button class="btn btn-sm btn-outline" onclick="resetUserPasswordUI('${u.id}')">🔑</button>
          </div>
        </div>`).join('');
    }
    async function simulateUserDays() {
      const email = document.getElementById('simulate-user-email').value;
      const days = document.getElementById('simulate-days').value;
      const startDay = document.getElementById('simulate-start-day').value;
      if (!email) return showToast('ইউজার ইমেইল দাও');
      const res = await adminApiCall('POST', '/admin/simulate-day', { email, days:parseInt(days), start_day:parseInt(startDay) });
      if (res?.success) showToast(`✅ ${res.inserted_days} দিন সিমুলেট হয়েছে`);
      else showToast(res?.error||'ব্যর্থ');
    }
    async function loadAdminCommunity() {
      const res = await adminApiCall('GET', '/admin/community');
      const list = document.getElementById('admin-posts-list');
      if (res && !res.error) list.innerHTML = res.map(p => `<div class="user-card">
        <div class="flex" style="justify-content:space-between;"><span><strong>${escapeHtml(p.display_name||p.author)}</strong> · ${escapeHtml(p.post_type)}</span>
        <div><button class="btn btn-sm btn-outline" onclick="togglePostVisibility('${p.id}',${p.is_hidden})">${p.is_hidden?'Show':'Hide'}</button>
        <button class="btn btn-sm btn-danger" onclick="deletePost('${p.id}')">🗑</button></div></div><p>${escapeHtml(p.content)}</p></div>`).join('');
      else list.innerHTML = '<p>লোড করতে সমস্যা</p>';
    }
    async function togglePostVisibility(postId, currentHidden) {
      await adminApiCall('PUT', `/admin/posts/${postId}/hide`, { hide:!currentHidden });
      loadAdminCommunity(); showToast(currentHidden?'পোস্ট দেখানো হবে':'পোস্ট লুকানো হয়েছে');
    }
    async function deletePost(postId) {
      if (!confirm('পোস্ট ডিলিট করবে?')) return;
      await adminApiCall('DELETE', `/admin/posts/${postId}`);
      loadAdminCommunity(); showToast('পোস্ট ডিলিট হয়েছে');
    }
    function setupContentForm() {
      const type = document.getElementById('content-type-select').value;
      const fields = document.getElementById('content-form-fields');
      if (type==='lesson') fields.innerHTML = `<input id="content-day" type="number" placeholder="Day number"><input id="content-phase" placeholder="Phase"><input id="content-title" placeholder="Title"><textarea id="content-body" placeholder="Content"></textarea>`;
      else if (type==='quiz') fields.innerHTML = `<input id="content-question" placeholder="Question"><input id="content-options" placeholder="Options (JSON)"><input id="content-correct" type="number" placeholder="Correct index">`;
      else if (type==='video') fields.innerHTML = `<input id="content-vtitle" placeholder="Video Title"><textarea id="content-vdesc" placeholder="Description"></textarea><input id="content-ytid" placeholder="YouTube ID"><input id="content-duration" placeholder="Duration"><input id="content-category" placeholder="Category">`;
    }
    async function addContent() {
      const type = document.getElementById('content-type-select').value;
      let body = { type };
      if (type==='lesson') { body.day=parseInt(document.getElementById('content-day').value); body.phase=document.getElementById('content-phase').value; body.title=document.getElementById('content-title').value; body.content=document.getElementById('content-body').value; }
      else if (type==='quiz') { body.question=document.getElementById('content-question').value; body.options=JSON.parse(document.getElementById('content-options').value); body.correct=parseInt(document.getElementById('content-correct').value); }
      else if (type==='video') { body.category=document.getElementById('content-category').value; body.title=document.getElementById('content-vtitle').value; body.description=document.getElementById('content-vdesc').value; body.youtube_id=document.getElementById('content-ytid').value; body.duration=document.getElementById('content-duration').value; }
      const res = await adminApiCall('POST', '/admin/content', body);
      if (res?.success) { showToast('✅ কনটেন্ট যোগ হয়েছে'); loadContentList(); }
      else showToast(res?.error||'ব্যর্থ');
    }
    async function loadContentList() {
      const lessons = await apiCall('GET', '/lessons') || [];
      const container = document.getElementById('content-list-section');
      container.innerHTML = `<h5>লেসন</h5>` + lessons.map(l => `
        <div class="flex" style="justify-content:space-between; padding:4px 0;">
          <span>${l.day}. ${escapeHtml(l.title)}</span>
          <div>
            <button class="btn btn-sm btn-outline" onclick="editContentPrompt('lesson',${l.id})">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteContent('lesson',${l.id})">🗑</button>
          </div>
        </div>`).join('');
    }
    function editContentPrompt(type, id) {
      const newVals = {};
      if (type==='lesson') {
        newVals.day = prompt('দিন');
        newVals.phase = prompt('ফেজ');
        newVals.title = prompt('শিরোনাম');
        newVals.content = prompt('কনটেন্ট');
        if (newVals.day) adminApiCall('PUT', `/admin/content/lesson/${id}`, newVals).then(() => loadContentList());
      }
    }
    async function deleteContent(type, id) {
      if (!confirm('মুছে ফেলবেন?')) return;
      await adminApiCall('DELETE', `/admin/content/${type}/${id}`);
      loadContentList();
    }

    async function uploadImage() {
      const file = document.getElementById('image-upload').files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append('image', file);
      const res = await fetch(`${API}/admin/upload-image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${adminToken}` },
        body: formData
      });
      const data = await res.json();
      if (data.url) {
        showToast('ইমেজ আপলোড সফল: ' + data.url);
        navigator.clipboard.writeText(data.url);
      } else showToast('আপলোড ব্যর্থ');
    }

    async function loadAdminAssessment() {
      const res = await adminApiCall('GET', '/assessment/questions');
      const list = document.getElementById('assessment-list');
      if (res && !res.error) {
        list.innerHTML = res.map(q => `
          <div class="flex" style="justify-content:space-between; padding:6px 0;">
            <span><b>${q.id}</b> ${escapeHtml(q.question)} <i>(${q.category})</i></span>
            <div>
              <button class="btn btn-sm btn-outline" onclick="editAssessmentPrompt(${q.id}, '${escapeHtml(q.question)}', '${escapeHtml(q.category)}')">✏️</button>
              <button class="btn btn-sm btn-danger" onclick="deleteAssessment(${q.id})">🗑</button>
            </div>
          </div>`).join('');
      }
    }
    function editAssessmentPrompt(id, question, category) {
      const newQ = prompt('প্রশ্ন সম্পাদনা:', question);
      const newCat = prompt('ক্যাটাগরি:', category);
      if (newQ !== null) {
        adminApiCall('PUT', `/admin/assessment/${id}`, { question: newQ, category: newCat }).then(() => loadAdminAssessment());
      }
    }
    async function addAssessmentQuestion() {
      const question = document.getElementById('new-assessment-q').value;
      const category = document.getElementById('new-assessment-cat').value;
      if (!question) return showToast('প্রশ্ন লিখুন');
      await adminApiCall('POST', '/admin/assessment-question', { question, category });
      document.getElementById('new-assessment-q').value = '';
      document.getElementById('new-assessment-cat').value = '';
      loadAdminAssessment();
    }
    async function deleteAssessment(id) {
      await adminApiCall('DELETE', `/admin/assessment/${id}`);
      loadAdminAssessment();
    }

    async function loadAdminBenefits() {
      const res = await adminApiCall('GET', '/benefits');
      const list = document.getElementById('benefits-list');
      if (res && !res.error) {
        list.innerHTML = res.map(b => `
          <div class="flex" style="justify-content:space-between; padding:6px 0;">
            <span>${b.icon} <b>${b.title}</b></span>
            <div>
              <button class="btn btn-sm btn-outline" onclick="editBenefitPrompt(${b.id}, '${escapeHtml(b.title)}', '${escapeHtml(b.description)}', '${b.icon}')">✏️</button>
              <button class="btn btn-sm btn-danger" onclick="deleteBenefit(${b.id})">🗑</button>
            </div>
          </div>`).join('');
      }
    }
    function editBenefitPrompt(id, title, desc, icon) {
      const newTitle = prompt('শিরোনাম:', title);
      const newDesc = prompt('বিবরণ:', desc);
      const newIcon = prompt('আইকন:', icon);
      if (newTitle) {
        adminApiCall('PUT', `/admin/benefit/${id}`, { title: newTitle, description: newDesc, icon: newIcon }).then(() => loadAdminBenefits());
      }
    }
    async function addBenefit() {
      const title = document.getElementById('new-benefit-title').value;
      const description = document.getElementById('new-benefit-desc').value;
      const icon = document.getElementById('new-benefit-icon').value;
      if (!title) return showToast('শিরোনাম দরকার');
      await adminApiCall('POST', '/admin/benefit', { title, description, icon });
      document.getElementById('new-benefit-title').value = '';
      document.getElementById('new-benefit-desc').value = '';
      document.getElementById('new-benefit-icon').value = '';
      loadAdminBenefits();
    }
    async function deleteBenefit(id) {
      await adminApiCall('DELETE', `/admin/benefit/${id}`);
      loadAdminBenefits();
    }

    async function loadAdminAnalytics() {
      const res = await adminApiCall('GET', '/admin/analytics/retention');
      const container = document.getElementById('analytics-chart');
      if (res && !res.error) {
        container.innerHTML = `<canvas id="retentionChart"></canvas>`;
        const ctx = document.getElementById('retentionChart').getContext('2d');
        new Chart(ctx, { type: 'line', data: { labels: res.map(d => d.date), datasets: [{ label: 'Active Users', data: res.map(d => d.active_users), borderColor: '#eab308', backgroundColor: 'rgba(234,179,8,0.1)' }] } });
      } else container.innerHTML = '<p>ডাটা নাই</p>';
    }

    // Admin Chapters
    let editingChapterId = null;
    let currentQmChapterId = null;
    let currentQmTitle = '';

    async function loadAdminChapters() {
      const chapters = await adminApiCall('GET', '/admin/chapters?course_id=1');
      if (!chapters) return;
      const container = document.getElementById('chapters-list');
      container.innerHTML = chapters.map(ch => `
        <div class="glass" style="margin:10px 0; padding:12px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <strong>#${ch.order_index} ${escapeHtml(ch.title)}</strong>
              <div style="font-size:0.85rem; color:var(--text-secondary);">
                প্রশ্ন: ${ch.question_count} | পাস হয়েছে: ${ch.passed_count}
              </div>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-sm btn-outline" onclick="editChapter(${ch.id})">এডিট</button>
              <button class="btn btn-sm btn-outline" onclick="manageQuestions(${ch.id}, '${escapeHtml(ch.title)}')">প্রশ্ন</button>
              <button class="btn btn-sm btn-danger" onclick="deleteChapter(${ch.id})">ডিলিট</button>
            </div>
          </div>
        </div>
      `).join('');
    }

    function openChapterEditor(chapter = null) {
      document.getElementById('chapter-editor-form').classList.remove('hidden');
      if (chapter) {
        editingChapterId = chapter.id;
        document.getElementById('chapter-editor-title').textContent = 'এডিট চ্যাপ্টার';
        document.getElementById('ch-title').value = chapter.title;
        document.getElementById('ch-order').value = chapter.order_index;
        document.getElementById('ch-content').value = chapter.content_text || '';
        document.getElementById('ch-image').value = chapter.image_url || '';
        document.getElementById('ch-video').value = chapter.video_url || '';
        document.getElementById('ch-passing').value = chapter.passing_score;
        document.getElementById('ch-edit-id').value = chapter.id;
      } else {
        editingChapterId = null;
        document.getElementById('chapter-editor-title').textContent = 'নতুন চ্যাপ্টার';
        ['ch-title','ch-order','ch-content','ch-image','ch-video'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('ch-passing').value = 90;
        document.getElementById('ch-edit-id').value = '';
      }
    }

    async function editChapter(id) {
      const chapters = await adminApiCall('GET', '/admin/chapters?course_id=1');
      const ch = chapters.find(c => c.id === id);
      if (ch) openChapterEditor(ch);
    }

    function cancelChapterEdit() {
      document.getElementById('chapter-editor-form').classList.add('hidden');
      editingChapterId = null;
    }

    async function saveChapter() {
      const data = {
        course_id: 1,
        title: document.getElementById('ch-title').value,
        order_index: parseInt(document.getElementById('ch-order').value),
        content_text: document.getElementById('ch-content').value,
        image_url: document.getElementById('ch-image').value,
        video_url: document.getElementById('ch-video').value,
        passing_score: parseInt(document.getElementById('ch-passing').value)
      };
      if (!data.title || !data.order_index) return showToast('শিরোনাম ও ক্রম আবশ্যক');
      const id = document.getElementById('ch-edit-id').value;
      if (id) {
        await adminApiCall('PUT', `/admin/chapter/${id}`, data);
      } else {
        await adminApiCall('POST', '/admin/chapter', data);
      }
      cancelChapterEdit();
      loadAdminChapters();
      showToast('✅ সংরক্ষিত');
    }

    async function deleteChapter(id) {
      if (!confirm('সত্যিই মুছে ফেলবেন?')) return;
      await adminApiCall('DELETE', `/admin/chapter/${id}`);
      loadAdminChapters();
    }

    async function manageQuestions(chapterId, title) {
      currentQmChapterId = chapterId;
      currentQmTitle = title;
      document.getElementById('qm-title').textContent = `${title} - কুইজ প্রশ্ন`;
      document.getElementById('qm-chapter-id').value = chapterId;
      await loadQuestionsForChapter(chapterId);
      document.getElementById('question-manager-modal').classList.remove('hidden');
      document.getElementById('qm-question-form').classList.add('hidden');
    }

    function closeQuestionManager() {
      document.getElementById('question-manager-modal').classList.add('hidden');
    }

    async function loadQuestionsForChapter(chapterId) {
      const questions = await adminApiCall('GET', `/admin/chapter/${chapterId}/questions`);
      const list = document.getElementById('qm-questions-list');
      list.innerHTML = questions.map(q => `
        <div style="padding:8px; background:rgba(255,255,255,0.05); margin:6px 0; border-radius:8px;">
          <p><strong>${escapeHtml(q.question)}</strong></p>
          <p style="font-size:0.85rem;">${q.options.map((opt,i) => `${i===q.correct_index ? '✓' : '○'} ${escapeHtml(opt)}`).join(' | ')}</p>
          ${q.explanation ? `<small style="color:var(--accent-bright);">${escapeHtml(q.explanation)}</small>` : ''}
          <div style="margin-top:6px;">
            <button class="btn btn-sm btn-outline" onclick="editQuestion(${q.id}, ${chapterId})">এডিট</button>
            <button class="btn btn-sm btn-danger" onclick="deleteQuestion(${q.id}, ${chapterId})">ডিলিট</button>
          </div>
        </div>
      `).join('');
    }

    function openQuestionForm(q = null) {
      document.getElementById('qm-question-form').classList.remove('hidden');
      if (q) {
        document.getElementById('qm-edit-qid').value = q.id;
        document.getElementById('qm-question-text').value = q.question;
        q.options.forEach((opt,i) => document.getElementById(`qm-opt${i}`).value = opt);
        document.getElementById('qm-correct').value = q.correct_index;
        document.getElementById('qm-explanation').value = q.explanation || '';
      } else {
        document.getElementById('qm-edit-qid').value = '';
        ['qm-question-text','qm-correct','qm-explanation'].forEach(id => document.getElementById(id).value = '');
        for(let i=0;i<4;i++) document.getElementById(`qm-opt${i}`).value = '';
      }
    }

    async function editQuestion(qId, chapterId) {
      const questions = await adminApiCall('GET', `/admin/chapter/${chapterId}/questions`);
      const q = questions.find(q => q.id === qId);
      if (q) openQuestionForm(q);
    }

    function cancelQuestionEdit() {
      document.getElementById('qm-question-form').classList.add('hidden');
    }

    async function saveQuestion() {
      const chapterId = parseInt(document.getElementById('qm-chapter-id').value);
      const qId = document.getElementById('qm-edit-qid').value;
      const data = {
        question: document.getElementById('qm-question-text').value,
        options: [0,1,2,3].map(i => document.getElementById(`qm-opt${i}`).value),
        correct_index: parseInt(document.getElementById('qm-correct').value),
        explanation: document.getElementById('qm-explanation').value
      };
      if (!data.question || data.options.some(o=>!o) || isNaN(data.correct_index))
        return showToast('সব ফিল্ড পূরণ করুন');
      if (qId) {
        await adminApiCall('PUT', `/admin/question/${qId}`, data);
      } else {
        await adminApiCall('POST', `/admin/chapter/${chapterId}/question`, data);
      }
      cancelQuestionEdit();
      loadQuestionsForChapter(chapterId);
      showToast('✅ প্রশ্ন সংরক্ষিত');
    }

    async function deleteQuestion(qId, chapterId) {
      if (!confirm('প্রশ্ন মুছবেন?')) return;
      await adminApiCall('DELETE', `/admin/question/${qId}`);
      loadQuestionsForChapter(chapterId);
    }

    // Assessment screen user
    async function showAssessment() {
      document.getElementById('assessment-screen').classList.remove('hidden');
      document.getElementById('assessment-prompt').classList.add('hidden');
      const qList = await apiCall('GET', '/assessment/questions');
      let html = '';
      qList.forEach((q, i) => {
        html += `<div class="glass" style="margin:10px 0;">
          <p><strong>${i+1}. ${escapeHtml(q.question)}</strong></p>
          <label style="margin-right:20px;"><input type="radio" name="q${q.id}" value="yes"> হ্যাঁ</label>
          <label><input type="radio" name="q${q.id}" value="no"> না</label>
        </div>`;
      });
      document.getElementById('assessment-questions').innerHTML = html;
    }
    async function submitAssessment() {
      const answers = [];
      document.querySelectorAll('#assessment-questions input[type="radio"]:checked').forEach(inp => {
        const id = parseInt(inp.name.replace('q',''));
        answers.push({ question_id: id, answer: inp.value === 'yes' });
      });
      const res = await apiCall('POST', '/assessment/submit', { answers });
      const resultDiv = document.getElementById('assessment-result');
      resultDiv.classList.remove('hidden');
      resultDiv.innerHTML = `
        <h3>আপনার স্কোর: ${res.yesCount}/${res.total}</h3>
        <p>${res.recommendation}</p>
        <button class="btn btn-accent" onclick="showBenefits()">ট্রেনিংয়ের উপকারিতা দেখুন</button>
      `;
    }
    async function showBenefits() {
      const benefits = await apiCall('GET', '/benefits');
      let html = '<div class="glass"><h3>কেন এই প্রোগ্রাম?</h3>';
      benefits.forEach(b => {
        html += `<div style="display:flex; gap:10px; margin:12px 0;">
          <span style="font-size:28px;">${b.icon}</span>
          <div><strong>${b.title}</strong><br><small>${b.description}</small></div>
        </div>`;
      });
      html += '</div>';
      document.getElementById('assessment-result').insertAdjacentHTML('beforeend', html);
    }

    // Journey functions
    function updateEvolutionTree(phase) {
      const stages = document.querySelectorAll('.evolution-tree .stage');
      const map = { 'Awareness':0, 'Discipline':1, 'Consistency':2, 'Psychology':3, 'Professional':4, 'Institutional':5 };
      const idx = map[phase] ?? 0;
      stages.forEach((s,i) => s.classList.toggle('active', i===idx));
    }

    function renderSliders() {
      const container = document.getElementById('score-sliders');
      const questions = [
        { id:'q1', short:'পরিকল্পনা অনুসরণ' }, { id:'q2', short:'উচ্চ-মানের সেটআপ' },
        { id:'q3', short:'ঝুঁকি ব্যবস্থাপনা' }, { id:'q4', short:'এক্সিকিউশন মান' },
        { id:'q5', short:'শৃঙ্খলাপূর্ণ এক্সিট' }, { id:'q6', short:'শৃঙ্খলা ও নিয়ম' },
        { id:'q7', short:'আবেগ নিয়ন্ত্রণ' }, { id:'q8', short:'ধৈর্য ও মনোযোগ' },
        { id:'q9', short:'দৈনিক পর্যালোচনা' }, { id:'q10', short:'ধারাবাহিক উন্নতি' }
      ];
      container.innerHTML = questions.map(q => `
        <div class="slider-item">
          <label><strong>${q.short}</strong></label>
          <input type="range" min="0" max="10" step="1" value="8" data-q="${q.id}">
          <span>8</span>
        </div>
      `).join('');
      container.querySelectorAll('input[type="range"]').forEach(inp => inp.addEventListener('input', e => e.target.parentElement.querySelector('span').textContent = e.target.value));
    }

    function showTab(tab) {
      document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
      const target = document.getElementById('tab-'+tab);
      if (target) target.classList.remove('hidden');
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const navItem = document.querySelector(`.nav-item[data-tab="${tab}"]`);
      if (navItem) navItem.classList.add('active');
      currentTab = tab;
      if (tab==='habits') loadHabits();
      if (tab==='progress') loadProgress();
      if (tab==='lessons') loadLessons();
      if (tab==='videos') loadVideos();
      if (tab==='community') loadCommunity();
      if (tab==='leaderboard') loadLeaderboard();
      if (tab==='profile') loadProfilePage();
      if (tab==='insights') loadInsights();
      if (tab==='training') loadTrainingTab();
      if (tab==='journey') renderSliders();
    }

    async function loadProfile() {
      const data = await apiCall('GET', '/profile');
      if (!data) return;
      const { user, today_entry, totalDays, streak, disciplineStreak } = data;
      currentUser = user;
      document.getElementById('user-avatar').textContent = user.avatar_emoji||'🙂';
      document.getElementById('user-display-name').textContent = user.display_name||user.email.split('@')[0];
      document.getElementById('user-identity').textContent = user.identity_level;
      document.getElementById('day-count').textContent = totalDays;
      document.getElementById('streak-count').textContent = streak;
      document.getElementById('xp-display').textContent = `⭐ ${user.xp} XP`;
      document.getElementById('user-level').textContent = user.level;
      document.getElementById('user-level-bar').textContent = user.level;
      updateXpBar(user.xp, user.level);
      updateEvolutionTree(user.identity_level);
      if (user.level > previousLevel) showLevelUp(user.level, previousLevel);
      previousLevel = user.level;
      await checkStreakMilestone(streak);
      if (user.is_admin) {
        document.querySelector('.admin-gear').classList.remove('hidden');
      } else {
        document.querySelector('.admin-gear').classList.add('hidden');
      }
      if (today_entry) {
        document.getElementById('morning-section').classList.add('hidden');
        document.getElementById('checkin-done-msg').classList.remove('hidden');
        if (today_entry.feedback) {
          document.getElementById('evaluation-section').classList.add('hidden');
          showFeedback({ feedback: today_entry.feedback, mission: today_entry.tomorrow_mission, badges: [] });
        } else {
          document.getElementById('evaluation-section').classList.remove('hidden');
          document.getElementById('feedback-area').classList.add('hidden');
        }
      } else {
        document.getElementById('morning-section').classList.remove('hidden');
        document.getElementById('checkin-done-msg').classList.add('hidden');
        document.getElementById('evaluation-section').classList.add('hidden');
        document.getElementById('feedback-area').classList.add('hidden');
      }
      updateReflectionPrompts();
      loadDailyQuest();
      if (totalDays === 0) {
        document.getElementById('assessment-prompt').classList.remove('hidden');
      } else {
        document.getElementById('assessment-prompt').classList.add('hidden');
      }
      i18n.apply();
    }

    function updateReflectionPrompts() {
      const prompts = ["আজকের সেশনে সবচেয়ে বড় চ্যালেঞ্জ কী ছিল?","এমন কোনো ট্রেড করেছ যা সেটআপের বাইরে? কেন?","আজ যদি কোনো নিয়ম ভেঙে থাকো, তা কীভাবে ঠেকাবে?","আজ কোন সিদ্ধান্তে নিজের প্রতি সবচেয়ে সন্তুষ্ট?"];
      document.getElementById('reflection-prompts').textContent = `💡 ${prompts[Math.floor(Math.random()*prompts.length)]}`;
    }

    async function submitCheckin() {
      if (!document.getElementById('mindfulness-done').checked) return showToast('Mindfulness সম্পন্ন করো');
      const commitment = document.getElementById('commitment').value.trim();
      if (!commitment) return showToast('প্রতিজ্ঞা লেখো');
      const localDate = new Date().toLocaleDateString('en-CA');
      await apiCall('POST', '/checkin', { mindfulness_done:true, commitment, date:localDate });
      document.getElementById('morning-section').classList.add('hidden');
      document.getElementById('checkin-done-msg').classList.remove('hidden');
      setTimeout(() => { document.getElementById('evaluation-section').classList.remove('hidden'); updateReflectionPrompts(); }, 1000);
      showToast('✅ চেক-ইন সফল!');
    }

    async function submitEvaluation() {
      if (!selectedMood) return showToast('একটি মুড নির্বাচন করো');
      const scores = {};
      document.querySelectorAll('#score-sliders input[type="range"]').forEach(inp => scores[inp.dataset.q] = parseInt(inp.value));
      const localDate = new Date().toLocaleDateString('en-CA');
      const body = {
        trades_count: parseInt(document.getElementById('trades-count').value),
        stop_loss_moved: document.getElementById('stop-loss-moved').value==='true',
        plan_deviation: document.getElementById('plan-deviation').value==='true',
        revenge_trade: document.getElementById('revenge-trade').value==='true',
        fomo_entry: document.getElementById('fomo-entry').value==='true',
        overtrading: document.getElementById('overtrading').value==='true',
        rule_followed: document.getElementById('rule-followed').value==='true',
        scores, evaluation_notes: document.getElementById('evaluation-notes').value,
        reflection: document.getElementById('reflection').value,
        mood: selectedMood,
        date: localDate
      };
      const data = await apiCall('POST', '/evaluation', body);
      if (data && !data.error) {
        document.getElementById('evaluation-section').classList.add('hidden');
        showFeedback(data);
        if (data.badges?.length) celebrate(`🏅 ${data.badges.join(', ')} অর্জিত!`);
        showToast(`+${data.xpGain} XP ${data.bonus?'(+'+data.bonus+' XP Streak Bonus!)':''}`);
        document.getElementById('mystery-box-btn').classList.toggle('hidden', !data.box_available);
        selectedMood = null;
        document.querySelectorAll('.mood-emoji').forEach(e => e.classList.remove('selected'));
        await loadProfile();
        if (currentTab==='progress') loadProgress();
      } else showToast(data?.error||'Error');
    }

    function showFeedback(fb) {
      document.getElementById('feedback-text').textContent = fb.feedback;
      document.getElementById('tomorrow-mission').textContent = fb.mission || fb.tomorrow_mission || '';
      document.getElementById('new-badges').innerHTML = (fb.badges||[]).map(b => `<span class="badge">🏅 ${b}</span>`).join('');
      document.getElementById('feedback-area').classList.remove('hidden');
    }

    async function loadProgress() {
      const data = await apiCall('GET', '/progress');
      if (!data) return;
      const percent = Math.round(data.totalDays/30*100);
      document.getElementById('progress-fill').style.width = percent+'%';
      document.getElementById('progress-text').textContent = percent+'%';
      document.getElementById('identity-phase-text').textContent = data.identity_level;
      document.getElementById('streak-count').textContent = data.streak;
      document.getElementById('discipline-streak-text').textContent = data.disciplineStreak;
      const timeline = document.getElementById('journey-timeline');
      const phases = [
        { name:'Awareness', min:0, max:5, icon:'🔰' },{ name:'Discipline', min:6, max:10, icon:'🏋️' },
        { name:'Consistency', min:11, max:15, icon:'🔄' },{ name:'Psychology', min:16, max:20, icon:'🧠' },
        { name:'Professional Execution', min:21, max:25, icon:'💼' },{ name:'Institutional Mindset', min:26, max:30, icon:'🏛️' }
      ];
      timeline.innerHTML = phases.map(p => {
        let status = 'upcoming';
        if (data.totalDays >= p.max) status = 'completed';
        else if (data.totalDays >= p.min) status = 'active';
        return `<div class="timeline-item ${status}"><strong>${p.icon} ${p.name}</strong></div>`;
      }).join('');
      const heatmap = document.getElementById('heatmap');
      const today = new Date(); const daysArr = [];
      for (let i=29; i>=0; i--) { const d=new Date(today); d.setDate(d.getDate()-i); daysArr.push(d.toISOString().slice(0,10)); }
      const journalDates = data.days.map(d=>d.date);
      heatmap.innerHTML = daysArr.map(date => `<div class="heatmap-day ${journalDates.includes(date)?'active':''}" title="${date}">${new Date(date).getDate()}</div>`).join('');
      document.getElementById('badges-list').innerHTML = data.badges.map(b => `<span class="badge">🏅 ${b}</span>`).join('');
      if (radarChart) radarChart.destroy();
      if (data.radar_today) {
        const ctx = document.getElementById('radarChart').getContext('2d');
        radarChart = new Chart(ctx, { type:'radar', data:{ labels:['পরিকল্পনা','এক্সিকিউশন','রিস্ক','মনোবিজ্ঞান','উন্নতি'], datasets:[{ label:'আজ', data:[data.radar_today.planning,data.radar_today.execution,data.radar_today.risk,data.radar_today.psychology,data.radar_today.improvement], backgroundColor:'rgba(234,179,8,0.25)', borderColor:'#eab308' }] }, options:{ scales:{ r:{ min:0, max:20 } } } });
      }
      if (chart) chart.destroy();
      const ctx2 = document.getElementById('scoresChart').getContext('2d');
      chart = new Chart(ctx2, { type:'line', data:{ labels:data.days.map(d=>d.date.slice(5)), datasets:[{ label:'Discipline (Q6)', data:data.days.map(d=>d.scores?.q6), borderColor:'#eab308' }] } });
      document.getElementById('certificate-btn').classList.toggle('hidden', data.totalDays<30);
      document.getElementById('share-certificate-btn').classList.toggle('hidden', data.totalDays<30);
    }

    async function loadInsights() {
      const res = await apiCall('GET', '/insights');
      document.getElementById('insights-content').innerHTML = res ? `
        <p>📊 মোট জার্নাল: ${res.totalJournals}</p><p>🔥 বর্তমান স্ট্রিক: ${res.currentStreak}</p>
        <p>⚠️ সবচেয়ে ঘনঘন ভুল: ${res.topMistake}</p><p>📈 গড় ডিসিপ্লিন: ${res.avgDiscipline?.toFixed(1)||'N/A'}</p>` : 'ইনসাইট লোড করতে সমস্যা';
    }

    async function loadLessons() {
      const lessons = await apiCall('GET', '/lessons');
      document.getElementById('lessons-list').innerHTML = lessons.map(l => `
        <div style="display:flex; justify-content:space-between; padding:14px; background:rgba(255,255,255,0.03); border-radius:14px; margin-bottom:8px;">
          <div><strong>${escapeHtml(l.title)}</strong><span class="badge">${escapeHtml(l.phase)}</span><p>${escapeHtml(l.content)}</p></div>
          <button class="btn btn-sm" ${l.completed_at?'disabled':''} onclick="completeLesson(${l.id})">${l.completed_at?'✅':'সম্পন্ন'}</button></div>`).join('');
    }
    async function completeLesson(id) { await apiCall('POST', '/complete-lesson', { lesson_id:id }); loadLessons(); loadProfile(); showToast('+3 XP!'); }

    async function loadVideos() {
      const videos = await apiCall('GET', '/videos');
      document.getElementById('video-grid').innerHTML = videos.map(v => `
        <div class="video-card">${(v.youtube_id.startsWith('PLACEHOLDER')||v.youtube_id.startsWith('YOUR')) ? '<div style="height:170px; display:flex; align-items:center; justify-content:center; background:#111;">📺 শীঘ্রই আসছে</div>' : `<iframe src="https://www.youtube.com/embed/${v.youtube_id}" allowfullscreen></iframe>`}
        <div class="video-info"><h4 style="color:var(--gold);">${escapeHtml(v.title)}</h4><p>${escapeHtml(v.description)}</p><small>${v.duration}</small></div></div>`).join('');
    }

    async function loadCommunity() {
      const posts = await apiCall('GET', '/community');
      document.getElementById('posts-container').innerHTML = posts.map(p => `
        <div class="post" id="post-${p.id}">
          <div class="flex" style="justify-content:space-between;"><span class="badge">${escapeHtml(p.post_type)}</span><small>${escapeHtml(p.avatar_emoji||'🙂')} ${escapeHtml(p.display_name||p.author)}</small></div>
          <p>${escapeHtml(p.content)}</p>
          <div class="flex" style="gap:6px; margin-top:6px;">
            <button class="btn btn-sm" onclick="likePost('${p.id}')">❤️ ${p.likes||0}</button>
            <button class="btn btn-sm" onclick="reactPost('${p.id}','👍')">👍 ${p.reactions?.thumbsup||0}</button>
            <button class="btn btn-sm" onclick="reactPost('${p.id}','🔥')">🔥 ${p.reactions?.fire||0}</button>
            <button class="btn btn-sm" onclick="toggleReply('${p.id}')">💬</button>
          </div>
          <div id="reply-box-${p.id}" class="hidden" style="margin-top:8px;">
            <div class="flex" style="gap:6px;"><input id="reply-input-${p.id}" placeholder="তোমার উত্তর..." style="flex:1;"><button class="btn btn-sm" onclick="replyPost('${p.id}')">পাঠান</button></div>
            <div id="replies-${p.id}" style="margin-top:8px;"></div>
          </div>
        </div>`).join('');
      i18n.apply();
    }
    async function submitPost() {
      const content = document.getElementById('post-content').value;
      const post_type = document.getElementById('post-type').value;
      if (!content.trim()) return;
      await apiCall('POST', '/community', { content, post_type });
      document.getElementById('post-content').value = '';
      loadCommunity(); showToast('পোস্ট শেয়ার হয়েছে!');
    }
    async function likePost(postId) { await apiCall('POST', '/like-post', { post_id:postId }); loadCommunity(); }
    async function reactPost(postId, reaction) { await apiCall('POST', '/reaction', { post_id:postId, reaction }); loadCommunity(); }
    function toggleReply(postId) { const box=document.getElementById('reply-box-'+postId); box.classList.toggle('hidden'); if(!box.classList.contains('hidden')) loadReplies(postId); }
    async function loadReplies(postId) {
      const res = await fetch(`${API}/replies?post_id=${postId}`, { headers:{ 'Authorization':`Bearer ${token}` } });
      const replies = await res.json();
      document.getElementById('replies-'+postId).innerHTML = replies.map(r => `<div class="reply-item"><small>${escapeHtml(r.avatar_emoji||'🙂')} ${escapeHtml(r.display_name||r.email)}</small><br>${escapeHtml(r.content)}</div>`).join('');
    }
    async function replyPost(postId) {
      const input = document.getElementById('reply-input-'+postId); const content = input.value.trim();
      if (!content) return;
      await apiCall('POST', '/reply-post', { post_id:postId, content });
      input.value = ''; loadReplies(postId); showToast('উত্তর দেওয়া হয়েছে!');
    }

    async function loadLeaderboard() {
      const data = await apiCall('GET', '/leaderboard');
      document.getElementById('leaderboard-list').innerHTML = data.map((u,i) => `
        <div style="display:flex; justify-content:space-between; padding:12px; background:rgba(255,255,255,0.03); border-radius:10px; margin:4px 0;">
          <span>${i+1}. ${escapeHtml(u.avatar_emoji||'🙂')} ${escapeHtml(u.display_name||u.email)}</span>
          <span class="badge">${u.avg_discipline?.toFixed(1)}</span></div>`).join('');
      if (currentUser) {
        const myIndex = data.findIndex(u => u.user_id === currentUser.id);
        document.getElementById('my-rank').textContent = myIndex>=0 ? `আপনার অবস্থান: #${myIndex+1}` : 'লিডারবোর্ডে নেই';
      }
    }

    async function loadQuiz() {
      const data = await apiCall('GET', '/quiz');
      if (data?.question) {
        quizData = data;
        document.getElementById('quiz-modal').classList.remove('hidden');
        document.getElementById('quiz-question').textContent = data.question;
        document.getElementById('quiz-options').innerHTML = data.options.map((o,i) => `<label class="flex"><input type="radio" name="quiz" value="${i}"> ${escapeHtml(o)}</label>`).join('');
        document.getElementById('quiz-done').classList.add('hidden');
      } else if (data?.message?.includes('Already')) {
        document.getElementById('quiz-modal').classList.remove('hidden');
        document.getElementById('quiz-done').classList.remove('hidden');
      } else document.getElementById('quiz-modal').classList.add('hidden');
    }
    async function submitQuiz() {
      const selected = document.querySelector('input[name="quiz"]:checked');
      if (!selected) return showToast('একটি উত্তর নির্বাচন করো');
      const res = await apiCall('POST', '/quiz', { quiz_id:quizData.id, answer:parseInt(selected.value) });
      showToast(res.message);
      if (res.correct) { loadProfile(); celebrate('🧠 +10 XP!'); }
      document.getElementById('quiz-modal').classList.add('hidden');
    }

    async function loadWeeklyChallenge() {
      const challenge = await apiCall('GET', '/weekly-challenge');
      if (challenge) document.getElementById('weekly-challenge-card').innerHTML = `<div class="glass"><h4>🔥 সাপ্তাহিক চ্যালেঞ্জ: ${escapeHtml(challenge.title)}</h4><p>${escapeHtml(challenge.description)} | প্রগ্রেস: ${challenge.progress}/${challenge.target}</p><div class="progress-bar"><div class="progress-fill" style="width:${(challenge.progress/challenge.target)*100}%"></div></div></div>`;
      else document.getElementById('weekly-challenge-card').innerHTML = '';
    }

    async function loadProfilePage() {
      const data = await apiCall('GET', '/profile');
      if (!data) return;
      document.getElementById('profile-name').textContent = data.user.display_name||'';
      document.getElementById('profile-email').textContent = data.user.email;
      document.getElementById('profile-avatar').textContent = data.user.avatar_emoji;
      document.getElementById('avatar-select').value = data.user.avatar_emoji;
      const prog = await apiCall('GET', '/progress');
      document.getElementById('profile-badges').innerHTML = prog.badges.map(b => `<span class="badge">🏅 ${b}</span>`).join('');
      const notif = await apiCall('GET', '/notif-settings');
      document.getElementById('notif-email').checked = notif?.email_enabled !== false;
      document.getElementById('notif-push').checked = notif?.push_enabled !== false;
      updateEvolutionTree(data.user.identity_level);
    }
    async function changeAvatar() {
      const emoji = document.getElementById('avatar-select').value;
      await apiCall('POST', '/profile', { avatar_emoji:emoji });
      document.getElementById('profile-avatar').textContent = emoji;
      document.getElementById('user-avatar').textContent = emoji;
      showToast('অ্যাভাটার আপডেট হয়েছে');
    }
    async function updateNotifSettings() {
      const email = document.getElementById('notif-email').checked;
      const push = document.getElementById('notif-push').checked;
      await apiCall('POST', '/notif-settings', { email, push });
      if (push && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(perm => { if (perm === 'granted') subscribeToPush(); });
      }
      showToast('সেটিংস সেভ হয়েছে');
    }
    async function saveReminderTime() {
      const time = document.getElementById('reminder-time').value;
      localStorage.setItem('reminderTime', time);
      showToast('⏰ রিমাইন্ডার সময় সেভ হয়েছে: ' + time);
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    }
    async function subscribeToPush() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        const vapidPublicKey = '';
        if (!vapidPublicKey) return;
        sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey:vapidPublicKey });
      }
      await apiCall('POST', '/save-subscription', { subscription:sub });
    }

    async function downloadCertificate() {
      const res = await fetch(`${API}/certificate`, { headers:{'Authorization':`Bearer ${token}`} });
      if (!res.ok) { showToast('প্রথমে ৩০ দিন সম্পন্ন করো'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'AlamQuant_Certificate.svg'; document.body.appendChild(a);
      a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      celebrate('🏆 সার্টিফিকেট ডাউনলোড শুরু!');
    }
    function shareCertificate() {
      if (navigator.share) navigator.share({ title:'AlamQuant ATTS Certificate', text:'আমি ৩০ দিনের ট্রেডার ট্রান্সফরমেশন জার্নি সম্পন্ন করেছি!', url:window.location.href });
      else showToast('শেয়ারিং সাপোর্টেড নয়');
    }

    function initGoogleSignIn() {
      if (typeof google !== 'undefined' && google.accounts && window.GOOGLE_CLIENT_ID) {
        google.accounts.id.initialize({
          client_id: window.GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential,
        });
        google.accounts.id.renderButton(
          document.getElementById('google-signin-btn'),
          { theme: 'outline', size: 'large', text: 'continue_with', shape: 'pill' }
        );
      }
    }
    async function handleGoogleCredential(response) {
      const credential = response.credential;
      const data = await apiCall('POST', '/auth/google', { credential });
      if (data?.token) {
        token = data.token; localStorage.setItem('token', token);
        initDashboard(data.user);
      } else showToast('Google login failed');
    }

    // Training
    async function loadTrainingTab() {
      await loadEnergy();
      const chapters = await apiCall('GET', '/training/chapters?course_id=1');
      if (!chapters || chapters.error) return;
      const container = document.getElementById('chapter-list');
      const allPassed = chapters.length > 0 && chapters.every(ch => ch.passed);
      let html = '';
      chapters.forEach((ch, i) => {
        const isLocked = i > 0 && !chapters[i-1].passed;
        const statusIcon = isLocked ? '🔒' : ch.passed ? '✅' : '📖';
        html += `<div class="glass chapter-card ${isLocked ? 'locked' : ''}" onclick="${isLocked ? '' : `openChapterModal(${ch.id})`}">
          <div style="font-size:2rem;">${statusIcon}</div>
          <strong>${escapeHtml(ch.title)}</strong>
          ${ch.passed ? '<span class="badge badge-accent">পাশ</span>' : isLocked ? '<span class="badge">তালাবদ্ধ</span>' : ''}
          <div class="progress-bar" style="height:6px; margin-top:8px;">
            <div class="progress-fill" style="width:${ch.passed ? 100 : ch.best_score || 0}%"></div>
          </div>
        </div>`;
      });
      container.innerHTML = html;
      const finalSection = document.getElementById('final-exam-section');
      if (allPassed) {
        finalSection.classList.remove('hidden');
        const examStatus = await apiCall('GET', '/training/final-exam');
        if (examStatus.passed) {
          finalSection.innerHTML = `<div class="glass" style="text-align:center;"><h3>🏆 অভিনন্দন!</h3><p>আপনি ফাইনাল পরীক্ষায় <strong>${examStatus.score}%</strong> পেয়ে উত্তীর্ণ!</p><button class="btn btn-accent btn-lg" onclick="showTab('progress')">সার্টিফিকেট দেখুন</button></div>`;
        }
      } else {
        finalSection.classList.add('hidden');
      }
    }
    async function loadEnergy() {
      const energy = await apiCall('GET', '/energy');
      if (energy) {
        document.getElementById('energy-current').textContent = energy.current_energy;
        document.getElementById('energy-max').textContent = energy.max_energy;
        document.getElementById('energy-fill').style.width = (energy.current_energy / energy.max_energy * 100) + '%';
      }
    }
    async function openChapterModal(chapterId) {
      currentChapterId = chapterId;
      const data = await apiCall('GET', `/training/chapter/${chapterId}`);
      if (!data || data.error) return showToast(data?.error || 'ত্রুটি');
      document.getElementById('chapter-modal-title').textContent = data.title;
      document.getElementById('chapter-modal-content').innerHTML = data.content_text || '';
      const img = document.getElementById('chapter-modal-image');
      if (data.image_url) { img.src = data.image_url; img.style.display = 'block'; } else img.style.display = 'none';
      const videoContainer = document.getElementById('chapter-modal-video-container');
      const videoIframe = document.getElementById('chapter-modal-video');
      if (data.video_url) { videoIframe.src = data.video_url; videoContainer.style.display = 'block'; }
      else { videoIframe.src = ''; videoContainer.style.display = 'none'; }
      currentChapterQuestions = data.questions || [];
      const quizContainer = document.getElementById('quiz-container');
      if (data.user_progress?.passed) {
        quizContainer.innerHTML = `<p style="color:var(--success);">✅ আপনি ইতিমধ্যে পাস করেছেন! স্কোর: ${data.user_progress.best_score}%</p>`;
        document.getElementById('submit-quiz-btn').style.display = 'none';
        document.getElementById('retry-chapter-btn').style.display = 'inline-block';
      } else {
        quizContainer.innerHTML = currentChapterQuestions.map((q, i) => `
          <div class="question-block">
            <p><strong>${i+1}. ${escapeHtml(q.question)}</strong></p>
            ${q.options.map((opt, j) => `<div class="quiz-option">
              <input type="radio" name="q_${q.id}" value="${j}" id="q_${q.id}_${j}">
              <label for="q_${q.id}_${j}">${escapeHtml(opt)}</label>
            </div>`).join('')}
          </div>`).join('');
        document.getElementById('submit-quiz-btn').style.display = 'inline-block';
        document.getElementById('retry-chapter-btn').style.display = 'none';
      }
      document.getElementById('quiz-result').classList.add('hidden');
      document.getElementById('chapter-modal').classList.remove('hidden');
      document.getElementById('quiz-mode-select').value = 'learning';
      currentQuizMode = 'learning';
      clearInterval(practiceTimer);
      document.getElementById('practice-timer').textContent = '';
    }
    function setQuizMode() {
      currentQuizMode = document.getElementById('quiz-mode-select').value;
      clearInterval(practiceTimer);
      document.getElementById('practice-timer').textContent = '';
      if (currentQuizMode === 'practice') {
        startPracticeTimer();
      }
    }
    function startPracticeTimer() {
      let timeLeft = 30;
      document.getElementById('practice-timer').textContent = `⏳ ${timeLeft}s`;
      practiceTimer = setInterval(() => {
        timeLeft--;
        document.getElementById('practice-timer').textContent = `⏳ ${timeLeft}s`;
        if (timeLeft <= 0) {
          clearInterval(practiceTimer);
          autoSubmitCurrentQuestion();
        }
      }, 1000);
    }
    function autoSubmitCurrentQuestion() {
      showToast('সময় শেষ হয়েছে');
    }
    function closeChapterModal() {
      document.getElementById('chapter-modal').classList.add('hidden');
      document.getElementById('chapter-modal-video').src = '';
      clearInterval(practiceTimer);
      loadTrainingTab();
    }
    async function submitChapterQuiz() {
      const answers = [];
      currentChapterQuestions.forEach(q => {
        const selected = document.querySelector(`input[name="q_${q.id}"]:checked`);
        if (selected) answers.push({ question_id: q.id, selected_index: parseInt(selected.value) });
      });
      if (answers.length !== currentChapterQuestions.length) return showToast('সব প্রশ্নের উত্তর দিন');
      const result = await apiCall('POST', `/training/chapter/${currentChapterId}/quiz`, { answers });
      if (!result || result.error) return showToast(result?.error || 'ত্রুটি');
      const resultDiv = document.getElementById('quiz-result');
      resultDiv.classList.remove('hidden');
      if (result.passed) { celebrate('চ্যাপ্টার পাস! 🎉'); showFloatingXp(result.xp_earned); }
      resultDiv.innerHTML = `<div class="glass" style="margin-top:16px; text-align:center;">
        <h4 style="color:${result.passed ? 'var(--success)' : 'var(--danger)'};">${result.passed ? '✅ পাস!' : '❌ পাস করতে পারেননি'}</h4>
        <p style="font-size:1.5rem; font-weight:bold;">স্কোর: ${result.score.toFixed(0)}%</p>
        <p>${result.message}</p>
        ${!result.passed ? '<button class="btn btn-outline" onclick="closeChapterModal()">পুনরায় পড়ুন</button>' : ''}
      </div>`;
      document.getElementById('submit-quiz-btn').style.display = 'none';
      document.getElementById('retry-chapter-btn').style.display = 'inline-block';
      clearInterval(practiceTimer);
      await loadEnergy();
      await loadProfile();
    }
    async function startFinalExam() {
      const data = await apiCall('GET', '/training/final-exam');
      if (!data || data.error) return showToast(data?.error || 'ত্রুটি');
      if (data.passed) return showToast('ইতিমধ্যে উত্তীর্ণ!');
      window._examSessionId = data.session_id;
      const expiry = new Date(data.expiry).getTime();
      const timerDisplay = document.getElementById('overall-timer');
      if (window._finalExamTimer) clearInterval(window._finalExamTimer);
      window._finalExamTimer = setInterval(() => {
        const now = Date.now();
        const diff = expiry - now;
        if (diff <= 0) {
          clearInterval(window._finalExamTimer);
          submitFinalExam();
          return;
        }
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        timerDisplay.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
      }, 1000);
      const container = document.getElementById('final-exam-questions');
      container.innerHTML = data.questions.map((q, i) => `
        <div class="question-block">
          <p><strong>${i+1}. ${escapeHtml(q.question)}</strong></p>
          ${q.options.map((opt, j) => `<div class="quiz-option">
            <input type="radio" name="feq_${q.id}" value="${j}" id="feq_${q.id}_${j}">
            <label for="feq_${q.id}_${j}">${escapeHtml(opt)}</label>
          </div>`).join('')}
        </div>
      `).join('');
      document.getElementById('final-exam-result').classList.add('hidden');
      document.getElementById('final-exam-modal').classList.remove('hidden');
    }
    async function submitFinalExam() {
      clearInterval(window._finalExamTimer);
      const answers = [];
      document.querySelectorAll('#final-exam-questions input[type="radio"]:checked').forEach(inp => {
        const questionId = parseInt(inp.name.replace('feq_',''));
        answers.push({ question_id: questionId, selected_index: parseInt(inp.value) });
      });
      const result = await apiCall('POST', '/training/final-exam', { session_id: window._examSessionId, answers });
      if (!result) return;
      const resultDiv = document.getElementById('final-exam-result');
      resultDiv.classList.remove('hidden');
      if (result.passed) { celebrate('ফাইনাল পরীক্ষা পাস! 🏆'); showFloatingXp(result.xp_earned); }
      resultDiv.innerHTML = `<div class="glass" style="text-align:center; margin-top:16px;">
        <h3 style="color:${result.passed ? 'var(--success)' : 'var(--danger)'};">${result.passed ? '🏆 অভিনন্দন! আপনি উত্তীর্ণ!' : '❌ পুনরায় চেষ্টা করুন'}</h3>
        <p style="font-size:2rem; font-weight:bold;">স্কোর: ${result.score.toFixed(0)}%</p>
        <p>${result.message}</p>
        ${result.passed ? '<button class="btn btn-accent btn-lg" onclick="showTab(\'progress\')">সার্টিফিকেট ডাউনলোড</button>' : '<button class="btn btn-outline" onclick="document.getElementById(\'final-exam-modal\').classList.add(\'hidden\')">বন্ধ করুন</button>'}
      </div>`;
      window._examSessionId = null;
    }

    // Habit reminders
    function scheduleHabitReminder(habitId, time, title) {
      const [h,m] = time.split(':');
      const now = new Date();
      const target = new Date(); target.setHours(h,m,0,0);
      if (target <= now) target.setDate(target.getDate()+1);
      const ms = target - now;
      const timerId = setTimeout(() => {
        if (Notification.permission === 'granted') {
          new Notification(`🧩 ${title}`, { body: `এখন ${time} টায় অভ্যাস করার সময়`, icon: '/icon-72.png' });
        }
        scheduleHabitReminder(habitId, time, title);
      }, ms);
      activeReminders.push({ habitId, time, timerId });
    }
    function clearAllReminders() {
      activeReminders.forEach(r => clearTimeout(r.timerId));
      activeReminders = [];
    }
    function scheduleAllReminders(defs) {
      clearAllReminders();
      defs.forEach(habit => {
        if (habit.reminder_times) {
          habit.reminder_times.forEach(time => scheduleHabitReminder(habit.id, time, habit.title));
        }
      });
    }
    async function loadHabits() {
      const date = new Date().toLocaleDateString('en-CA');
      const defRes = await fetch(`${API}/habits/definitions`, {headers: {'Authorization':`Bearer ${token}`}});
      habitDefinitions = await defRes.json();
      const logRes = await fetch(`${API}/habits/logs?date=${date}`, {headers: {'Authorization':`Bearer ${token}`}});
      const logs = await logRes.json();
      todayLogs = logs;
      renderHabits(habitDefinitions, logs);
      scheduleAllReminders(habitDefinitions);
    }
    function renderHabits(habits, logs) {
      const container = document.getElementById('habits-list');
      container.innerHTML = habits.map(h => {
        const log = logs.find(l => l.habit_id === h.id);
        const times = (h.reminder_times || []);
        const timesHtml = times.map(t => `<div class="habit-time-slot ${log?.completed_times?.[t] ? 'done' : ''}" onclick="toggleHabitTime('${h.id}','${t}')">${t} ${log?.completed_times?.[t]?'✅':'⏳'}</div>`).join('');
        return `<div class="glass habit-card" style="border-left:4px solid ${h.color};">
          <div class="flex" style="justify-content:space-between; align-items:center;">
            <span style="font-size:24px;">${h.icon}</span> <strong>${escapeHtml(h.title)}</strong>
            <span class="badge" style="background:${h.color};">${times.every(t=>log?.completed_times?.[t]) ? '✓' : '○'}</span>
          </div>
          <div class="habit-times-grid">${timesHtml}</div>
        </div>`;
      }).join('');
    }
    async function toggleHabitTime(habitId, time) {
      const date = new Date().toLocaleDateString('en-CA');
      const log = todayLogs.find(l => l.habit_id === habitId);
      const completed = !(log?.completed_times?.[time] ?? false);
      await fetch(`${API}/habits/logs`, {
        method:'POST',
        headers:{'Authorization':`Bearer ${token}`, 'Content-Type':'application/json'},
        body:JSON.stringify({habit_id:habitId, date, time, completed})
      });
      loadHabits();
      if(completed) showFloatingXp(3);
    }
    function showAddHabitForm() { document.getElementById('add-habit-modal').classList.remove('hidden'); }
    async function saveHabit() {
      const title = document.getElementById('new-habit-title').value.trim();
      const icon = document.getElementById('new-habit-icon').value;
      const color = document.getElementById('new-habit-color').value;
      const timesRaw = document.getElementById('new-habit-times').value;
      const reminder_times = timesRaw.split(',').map(t=>t.trim()).filter(t=>t);
      if(!title) return showToast('নাম দিন');
      await apiCall('POST', '/habits/definitions', { title, icon, color, reminder_times });
      document.getElementById('add-habit-modal').classList.add('hidden');
      loadHabits();
      showToast('হ্যাবিট যোগ হয়েছে');
    }

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => showTab(item.dataset.tab)));
    document.getElementById('content-type-select')?.addEventListener('change', setupContentForm);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => {
          if (modal.id !== 'admin-modal' || document.getElementById('admin-panel').classList.contains('hidden')) {
            modal.classList.add('hidden');
          }
        });
      }
    });

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch(()=>{});
      });
    }

    // Init
    async function initDashboard(user) {
      document.getElementById('auth-screen').classList.add('hidden');
      document.getElementById('loading-screen').style.display = 'none';
      document.getElementById('dashboard').classList.remove('hidden');
      document.querySelector('.bottom-nav').classList.remove('hidden');
      if (user.is_admin) document.querySelector('.admin-gear').classList.remove('hidden');
      currentUser = user;
      previousLevel = user.level;
      await loadProfile();
      showTab('journey');
      loadWeeklyChallenge();
      renderSliders();
      initGoogleSignIn();
      loadQuiz();
    }
    function closeWelcome() { document.getElementById('welcome-modal').classList.add('hidden'); }

    window.addEventListener('load', async () => {
      await i18n.init();
      const params = new URLSearchParams(window.location.search);
      const autoToken = params.get('token');
      if (autoToken) {
        const data = await fetch(`${API}/auto-login?token=${encodeURIComponent(autoToken)}`).then(r=>r.json());
        if (data.token) {
          token = data.token;
          localStorage.setItem('token', token);
          window.history.replaceState({}, document.title, window.location.pathname);
          initDashboard(data.user || data);
        }
      } else if (token) {
        const data = await apiCall('GET', '/profile');
        if (data) initDashboard(data.user);
        else logout();
      } else {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('auth-screen').classList.remove('hidden');
      }
    });

    // Courses CRUD
    async function loadCourses() {
      const courses = await adminApiCall('GET', '/admin/courses');
      const container = document.getElementById('courses-list');
      if (!courses || courses.error) { container.innerHTML = '<p>লোড করতে সমস্যা</p>'; return; }
      let html = '<table class="admin-table"><thead><tr><th>ID</th><th>শিরোনাম</th><th>বিবরণ</th><th>অ্যাকশন</th></tr></thead><tbody>';
      courses.forEach(c => {
        html += `<tr>
          <td>${c.id}</td>
          <td>${escapeHtml(c.title)}</td>
          <td>${escapeHtml(c.description || '')}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="editCourse(${c.id}, '${escapeHtml(c.title)}', '${escapeHtml(c.description||'')}')">এডিট</button>
            <button class="btn btn-sm btn-danger" onclick="deleteCourse(${c.id})">ডিলিট</button>
          </td>
        </tr>`;
      });
      html += '</tbody></table>';
      container.innerHTML = html;
    }

    function showCourseForm() {
      document.getElementById('course-form').classList.remove('hidden');
      document.getElementById('course-edit-id').value = '';
      document.getElementById('course-title').value = '';
      document.getElementById('course-desc').value = '';
    }

    function cancelCourseForm() {
      document.getElementById('course-form').classList.add('hidden');
    }

    function editCourse(id, title, desc) {
      document.getElementById('course-form').classList.remove('hidden');
      document.getElementById('course-edit-id').value = id;
      document.getElementById('course-title').value = title;
      document.getElementById('course-desc').value = desc;
    }

    async function saveCourse() {
      const title = document.getElementById('course-title').value;
      const description = document.getElementById('course-desc').value;
      const id = document.getElementById('course-edit-id').value;
      if (!title) return showToast('শিরোনাম আবশ্যক');
      if (id) {
        await adminApiCall('PUT', `/admin/course/${id}`, { title, description, is_active: true });
      } else {
        await adminApiCall('POST', '/admin/course', { title, description });
      }
      cancelCourseForm();
      loadCourses();
      showToast('✅ কোর্স সংরক্ষিত');
    }

    async function deleteCourse(id) {
      if (!confirm('কোর্স মুছে ফেললে সংশ্লিষ্ট সব চ্যাপ্টার মুছে যাবে!')) return;
      await adminApiCall('DELETE', `/admin/course/${id}`);
      loadCourses();
      showToast('🗑️ কোর্স ডিলিট হয়েছে');
    }

    // Activity Log
    async function loadActivityLog() {
      const logs = await adminApiCall('GET', '/admin/activity-log');
      const container = document.getElementById('activity-log-table');
      if (!logs || logs.error) { container.innerHTML = '<p>লগ লোড করতে সমস্যা</p>'; return; }
      let html = '<table class="admin-table"><thead><tr><th>সময়</th><th>অ্যাডমিন</th><th>কাজ</th><th>বিস্তারিত</th></tr></thead><tbody>';
      logs.forEach(log => {
        html += `<tr>
          <td>${new Date(log.created_at).toLocaleString('bn-BD')}</td>
          <td>${log.admin_name || log.admin_email}</td>
          <td>${log.action}</td>
          <td>${JSON.stringify(log.details || {}).substring(0,60)}</td>
        </tr>`;
      });
      html += '</tbody></table>';
      container.innerHTML = html;
    }

    // Settings
    async function changeAdminPassword() {
      const current = document.getElementById('current-password').value;
      const newPass = document.getElementById('new-password').value;
      const confirm = document.getElementById('confirm-password').value;
      if (newPass !== confirm) return showToast('নতুন পাসওয়ার্ড মিলছে না');
      if (newPass.length < 6) return showToast('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে');
      const res = await adminApiCall('PUT', '/admin/change-password', { current_password: current, new_password: newPass });
      if (res && res.success) {
        showToast('✅ পাসওয়ার্ড পরিবর্তন সফল');
        document.getElementById('settings-message').innerHTML = '<p style="color:var(--success);">পাসওয়ার্ড আপডেট হয়েছে</p>';
      } else {
        document.getElementById('settings-message').innerHTML = `<p style="color:var(--danger);">${res?.error || 'ত্রুটি'}</p>`;
      }
    }
  </script>
</body>
</html>
'@
$indexHtml | Out-File -FilePath "$projectRoot\index.html" -Encoding utf8
Write-Host "Created index.html (Enterprise Grade Full Application)" -ForegroundColor Green

# ============================================
# 12. api/setup.js placeholder (user will replace with final)
# ============================================
$setupJsPlaceholder = @'
// ===================================================
// AlamQuant ATTS - api/setup.js (PLACEHOLDER)
// Replace this file with the complete production-ready
// api/setup.js provided separately.
// ===================================================
export default async function handler(req) {
  return new Response("API not configured yet", { status: 501 });
}
'@
$setupJsPlaceholder | Out-File -FilePath "$projectRoot\api\setup.js" -Encoding utf8
Write-Host "Created api/setup.js (PLACEHOLDER - replace with final production version)" -ForegroundColor Yellow

# ============================================
# Final message
# ============================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  All project files generated successfully!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "IMPORTANT NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Replace 'api/setup.js' with the final enterprise-grade API file." -ForegroundColor Yellow
Write-Host "2. Set environment variables in Vercel (DATABASE_URL, JWT_SECRET, etc.)." -ForegroundColor Yellow
Write-Host "3. Place icon-192.png and icon-512.png in the project root (for PWA)." -ForegroundColor Yellow
Write-Host "4. Run 'npm install' then 'npm start' for local development." -ForegroundColor Yellow
Write-Host "5. For production, deploy to Vercel. Set ALLOW_INIT_DB=true then run init-db API." -ForegroundColor Yellow
Write-Host "6. Default admin login: admin@alamquant.com / Admin@2024!Secure" -ForegroundColor Yellow
Write-Host ""
Write-Host "Note: CRON jobs in vercel.json are only active on Vercel Pro plan." -ForegroundColor Magenta
Write-Host ""