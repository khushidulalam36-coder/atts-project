# ============================================
# SECTION 1: AlamQuant ATTS - Production-Ready File Generator (Enterprise-Grade)
# ============================================
# Description:
#   This script creates all necessary project files for the AlamQuant ATTS application.
#   It validates the project root, creates folders, writes configuration files,
#   generates PWA icons if needed, and provides clear post-generation instructions.
# ============================================

$ErrorActionPreference = "Stop"
$host.UI.RawUI.WindowTitle = "AlamQuant ATTS Generator"

# ----- Validate project root -----
$projectRoot = Get-Location
if (-not (Test-Path $projectRoot)) {
    Write-Host "FATAL: Project root path does not exist: $projectRoot" -ForegroundColor Red
    exit 1
}
Write-Host "Project root: $projectRoot" -ForegroundColor Cyan

# BOM-less UTF-8 encoding (for Bengali/emoji support)
$Utf8NoBom = New-Object System.Text.UTF8Encoding $false

# Create required folders
$folders = @("api")
foreach ($folder in $folders) {
    $path = Join-Path $projectRoot $folder
    if (-not (Test-Path $path)) {
        New-Item -ItemType Directory -Force -Path $path | Out-Null
        Write-Host "Created folder: $path" -ForegroundColor Gray
    }
}

# ============================================
# SECTION 2: Core Project Files
# ============================================
Write-Host "`nGenerating core configuration files..." -ForegroundColor Yellow

# 2.1 vercel.json
$vercelJson = @'
{
  "headers": [
    {
      "source": "/(.*).html",
      "headers": [
        { "key": "Content-Type", "value": "text/html; charset=utf-8" },
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
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
[System.IO.File]::WriteAllText("$projectRoot\vercel.json", $vercelJson, $Utf8NoBom)
Write-Host "  + vercel.json (security headers & rewrites)" -ForegroundColor Green

# 2.2 package.json
$packageJson = @'
{
  "name": "atts-project",
  "version": "2.0.0",
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
    "busboy": "^1.6.0",
    "resend": "^3.2.0",
    "zod": "^3.22.0",
    "@sentry/node": "^7.0.0",
    "@vercel/kv": "^1.0.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
'@
[System.IO.File]::WriteAllText("$projectRoot\package.json", $packageJson, $Utf8NoBom)
Write-Host "  + package.json (all required dependencies)" -ForegroundColor Green

# 2.3 server.js (Local Development Server)
$serverJs = @'
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
[System.IO.File]::WriteAllText("$projectRoot\server.js", $serverJs, $Utf8NoBom)
Write-Host "  + server.js (local dev server)" -ForegroundColor Green

# ============================================
# SECTION 3: Environment & PWA Setup
# ============================================
Write-Host "`nGenerating environment and PWA files..." -ForegroundColor Yellow

# 3.1 .env.local (placeholder with strong warnings)
$envLocal = @'
# ============================================
# AlamQuant ATTS - Environment Variables
# ============================================
# ⚠️ WARNING ⚠️
# This file contains sensitive credentials.
# NEVER commit it to version control.
# Replace every placeholder value below with your actual secrets.
# ============================================

# PostgreSQL connection string (Neon.tech)
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require

# JWT signing secret (generate a long random string)
JWT_SECRET=replace_with_strong_random_secret_here

# Admin secret for /init-db endpoint
ADMIN_SECRET=strong_admin_secret_for_init_db

# Google OAuth (optional)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# OpenAI API key for AI Coach (optional)
OPENAI_API_KEY=sk-your-openai-api-key

# Allowed CORS origins (comma-separated, no spaces)
CORS_ORIGIN=https://your-domain.vercel.app

# Resend API key for transactional emails
RESEND_API_KEY=re_...

# Sentry DSN for error monitoring (optional)
SENTRY_DSN=https://...@sentry.io/...

# Vercel KV URL for distributed rate limiting (optional)
KV_URL=redis://...

# ============================================
# IMPORTANT: After first deploy, set ALLOW_INIT_DB=true
# in Vercel Environment Variables, then run the init-db command.
# Default admin: admin@alamquant.com
# Temporary password is printed in server logs – change immediately!
# ============================================
'@
[System.IO.File]::WriteAllText("$projectRoot\.env.local", $envLocal, $Utf8NoBom)
Write-Host "  + .env.local (placeholder with security warnings)" -ForegroundColor Green
Write-Host "    ⚠️  WARNING: .env.local contains dummy values. Please edit it with your real credentials!" -ForegroundColor Red

# 3.2 .gitignore
$gitignore = @'
node_modules/
.env.local
.env
.DS_Store
*.log
'@
[System.IO.File]::WriteAllText("$projectRoot\.gitignore", $gitignore, $Utf8NoBom)
Write-Host "  + .gitignore" -ForegroundColor Green

# 3.3 manifest.json
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
[System.IO.File]::WriteAllText("$projectRoot\manifest.json", $manifestJson, $Utf8NoBom)
Write-Host "  + manifest.json (PWA manifest)" -ForegroundColor Green

# 3.4 sw.js (Service Worker with push notification support)
$swJs = @'
const CACHE_NAME = 'atts-v9';
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
[System.IO.File]::WriteAllText("$projectRoot\sw.js", $swJs, $Utf8NoBom)
Write-Host "  + sw.js (service worker with push support)" -ForegroundColor Green

# ============================================
# SECTION 4: PWA Icon Generation
# ============================================
Write-Host "`nPWA Icon Setup..." -ForegroundColor Yellow

$icon192Path = Join-Path $projectRoot "icon-192.png"
$icon512Path = Join-Path $projectRoot "icon-512.png"
$icon72Path  = Join-Path $projectRoot "icon-72.png"

$icon192Exists = Test-Path $icon192Path
$icon512Exists = Test-Path $icon512Path

if ($icon192Exists -and $icon512Exists) {
    Write-Host "  + Existing icon-192.png and icon-512.png found. Skipping icon generation." -ForegroundColor Green
} else {
    $useCustom = Read-Host "  ? Do you have a source icon file (>= 512x512) to use for PWA icons? (y/n)"
    if ($useCustom -eq 'y') {
        $sourcePath = Read-Host "  ? Enter the full path to your source PNG file"
        if (Test-Path $sourcePath) {
            Write-Host "    Resizing icons using .NET Drawing (requires System.Drawing assembly)..." -ForegroundColor DarkYellow
            try {
                Add-Type -AssemblyName System.Drawing
                $srcImage = [System.Drawing.Image]::FromFile($sourcePath)
                # Resize to 192x192
                $bmp192 = New-Object System.Drawing.Bitmap(192, 192)
                $g192 = [System.Drawing.Graphics]::FromImage($bmp192)
                $g192.DrawImage($srcImage, 0, 0, 192, 192)
                $bmp192.Save($icon192Path, [System.Drawing.Imaging.ImageFormat]::Png)
                # Resize to 512x512
                $bmp512 = New-Object System.Drawing.Bitmap(512, 512)
                $g512 = [System.Drawing.Graphics]::FromImage($bmp512)
                $g512.DrawImage($srcImage, 0, 0, 512, 512)
                $bmp512.Save($icon512Path, [System.Drawing.Imaging.ImageFormat]::Png)
                # Also create 72x72 for badge
                $bmp72 = New-Object System.Drawing.Bitmap(72, 72)
                $g72 = [System.Drawing.Graphics]::FromImage($bmp72)
                $g72.DrawImage($srcImage, 0, 0, 72, 72)
                $bmp72.Save($icon72Path, [System.Drawing.Imaging.ImageFormat]::Png)
                $g192.Dispose(); $g512.Dispose(); $g72.Dispose()
                $bmp192.Dispose(); $bmp512.Dispose(); $bmp72.Dispose()
                $srcImage.Dispose()
                Write-Host "    Icons generated successfully." -ForegroundColor Green
            } catch {
                Write-Host "    Failed to generate icons using .NET: $_. Falling back to placeholder." -ForegroundColor Red
                # Generate a simple 1x1 pixel icon as a placeholder
                $bytes192 = [System.Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==")
                [System.IO.File]::WriteAllBytes($icon192Path, $bytes192)
                [System.IO.File]::WriteAllBytes($icon512Path, $bytes192)
                [System.IO.File]::WriteAllBytes($icon72Path, $bytes192)
                Write-Host "    Placeholder icons created (1x1 pixel). Replace with real ones." -ForegroundColor Yellow
            }
        } else {
            Write-Host "    Source file not found. Generating placeholder icons." -ForegroundColor Red
            # Fallback to placeholder
            $bytesPlaceholder = [System.Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==")
            [System.IO.File]::WriteAllBytes($icon192Path, $bytesPlaceholder)
            [System.IO.File]::WriteAllBytes($icon512Path, $bytesPlaceholder)
            [System.IO.File]::WriteAllBytes($icon72Path, $bytesPlaceholder)
            Write-Host "    Placeholder icons created. Replace with real ones before production." -ForegroundColor Yellow
        }
    } else {
        Write-Host "    No custom icon provided. Creating placeholder icons." -ForegroundColor DarkYellow
        # Generate a simple gold square 1x1 or a generated simple icon? We'll use a base64 of a 1x1 pixel PNG.
        $bytes1x1 = [System.Convert]::FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==")
        [System.IO.File]::WriteAllBytes($icon192Path, $bytes1x1)
        [System.IO.File]::WriteAllBytes($icon512Path, $bytes1x1)
        [System.IO.File]::WriteAllBytes($icon72Path, $bytes1x1)
        Write-Host "    Placeholder icons created. Replace with real ones before production." -ForegroundColor Yellow
    }
}

# ============================================
# SECTION 5: Static HTML Pages (Placeholders / Final)
# ============================================
Write-Host "`nGenerating static HTML pages..." -ForegroundColor Yellow

# 5.1 verify.html (Public Certificate Verification)
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
[System.IO.File]::WriteAllText("$projectRoot\verify.html", $verifyHtml, $Utf8NoBom)
Write-Host "  + verify.html" -ForegroundColor Green

# 5.2 admin.html (Admin panel placeholder - note admin UI is integrated into index.html)
$adminHtmlPlaceholder = @'
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin - AlamQuant ATTS</title>
  <link rel="stylesheet" href="styles.css">
  <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
  <script src="https://cdn.quilljs.com/1.3.6/quill.min.js"></script>
</head>
<body>
  <!-- This is a placeholder. The admin panel is fully integrated inside index.html.
       To use a separate admin page, replace this file with the admin.html code. -->
  <div style="display:flex; justify-content:center; align-items:center; height:100vh; color:white;">
    <h1>Admin Panel is available at /admin within the main app.</h1>
  </div>
</body>
</html>
'@
[System.IO.File]::WriteAllText("$projectRoot\admin.html", $adminHtmlPlaceholder, $Utf8NoBom)
Write-Host "  + admin.html (placeholder - admin is inside index.html)" -ForegroundColor Green

# 5.3 index.html - we do NOT generate a placeholder; the user must provide the final enterprise index.html.
# Instead, we create a placeholder with a strong note.
$indexHtmlPlaceholder = @'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Placeholder - Replace with final enterprise index.html</title>
</head>
<body>
  <!-- Replace this file with the complete enterprise index.html -->
</body>
</html>
'@
[System.IO.File]::WriteAllText("$projectRoot\index.html", $indexHtmlPlaceholder, $Utf8NoBom)
Write-Host "  + index.html (PLACEHOLDER - YOU MUST REPLACE THIS WITH THE FINAL ENTERPRISE index.html)" -ForegroundColor Red

# ============================================
# SECTION 6: CSS (Enterprise Premium Theme)
# ============================================
Write-Host "`nGenerating styles.css..." -ForegroundColor Yellow
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
.grid-3 { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
.grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; }
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
.quiz-option { display: flex; align-items: center; gap: 10px; padding: 4px 0; }
.quiz-option input[type="radio"] { width: auto; margin: 0; accent-color: var(--gold); }
.quiz-option label { flex: 1; cursor: pointer; color: var(--text); }
.question-block { background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 16px; }
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
.admin-sidebar {
  width: 260px;
  background: rgba(2,6,23,0.98);
  border-right: 1px solid var(--border-gold);
  padding: 24px 0;
  position: fixed;
  top:0;
  left:0;
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
}
.admin-sidebar ul { list-style:none; }
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
.admin-main { margin-left:260px; padding:30px; min-height:100vh; }
.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-gold);
}
.stat-card { background: var(--surface); backdrop-filter: blur(10px); border: 1px solid var(--border-gold); border-radius: var(--radius); padding: 20px; text-align: center; transition: var(--transition); }
.stat-card:hover { transform: translateY(-3px); box-shadow: var(--glow-gold); }
.stat-value { font-size: 2.2rem; font-weight: 800; color: var(--gold-bright); }
.stat-label { color: var(--text-secondary); margin-top: 8px; font-size: 0.9rem; }
.chapter-editor { background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); padding: 20px; margin: 16px 0; border: 1px solid var(--border-gold); }
.question-item { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 16px; margin: 12px 0; border-left: 3px solid var(--accent); }
.user-card { padding:12px; background:rgba(255,255,255,0.03); border-radius:12px; margin-bottom:8px; }
@media (max-width:768px) {
  .admin-sidebar { width:70px; }
  .admin-sidebar ul li span { display:none; }
  .admin-main { margin-left:70px; }
  .grid-2, .grid-3, .grid-4 { grid-template-columns:1fr; }
}
'@
[System.IO.File]::WriteAllText("$projectRoot\styles.css", $stylesCss, $Utf8NoBom)
Write-Host "  + styles.css (enterprise premium theme)" -ForegroundColor Green

# ============================================
# SECTION 7: API Setup Placeholder (user must replace with final enterprise version)
# ============================================
Write-Host "`nGenerating api/setup.js placeholder..." -ForegroundColor Yellow
$setupJsPlaceholder = @'
// ===================================================
// AlamQuant ATTS - api/setup.js (PLACEHOLDER)
// Replace this file with the complete enterprise-ready
// api/setup.js provided separately.
// ===================================================
export default async function handler(req) {
  return new Response("API not configured yet", { status: 501 });
}
'@
[System.IO.File]::WriteAllText("$projectRoot\api\setup.js", $setupJsPlaceholder, $Utf8NoBom)
Write-Host "  + api/setup.js (placeholder - REPLACE with final enterprise version)" -ForegroundColor Red

# ============================================
# SECTION 8: Final Instructions & Next Steps
# ============================================
Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host "  All project files generated successfully! (Enterprise-Ready)" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "NEXT STEPS (IMPORTANT):" -ForegroundColor Yellow
Write-Host "1. Replace placeholder 'index.html' with the final enterprise index.html." -ForegroundColor Yellow
Write-Host "2. Replace placeholder 'api/setup.js' with the final enterprise api/setup.js." -ForegroundColor Yellow
Write-Host "3. Set environment variables in Vercel (DATABASE_URL, JWT_SECRET, etc.)" -ForegroundColor Yellow
Write-Host "4. Run 'npm install' then 'npm start' for local development." -ForegroundColor Yellow
Write-Host "5. For production, deploy to Vercel." -ForegroundColor Yellow
Write-Host "6. Set ALLOW_INIT_DB=true in Vercel environment variables." -ForegroundColor Yellow
Write-Host "7. Initialize the database by running:" -ForegroundColor Yellow
Write-Host "   Invoke-RestMethod -Uri https://<your-project>.vercel.app/api/setup/init-db -Method POST -ContentType 'application/json' -Body '{\"admin_secret\":\"your_admin_secret\"}'" -ForegroundColor Cyan
Write-Host "8. Default admin login: admin@alamquant.com (temporary password from Vercel function logs, change immediately)." -ForegroundColor Yellow
Write-Host "9. Ensure all PWA icons (icon-192.png, icon-512.png) are valid. Placeholder icons were generated if not present." -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  REMINDER: The generated .env.local file contains dummy values. You MUST update it with your real credentials!" -ForegroundColor Red
Write-Host ""