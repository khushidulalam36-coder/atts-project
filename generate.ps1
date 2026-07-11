# ============================================
# SECTION 1: AlamQuant ATTS - Enterprise-Grade Project Generator
# ============================================
# Description:
#   Creates ALL necessary project files for the AlamQuant ATTS application.
#   After execution, MANUALLY replace the three placeholder files:
#     1. index.html
#     2. api/setup.js
#     3. admin.html
#   with the full production-ready code provided separately.
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
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Cross-Origin-Resource-Policy", "value": "cross-origin" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/setup" },
    { "source": "/admin", "destination": "/admin.html" },
    { "source": "/verify", "destination": "/verify.html" }
  ],
  "crons": [
    {
      "path": "/api/cron/check-reminders",
      "schedule": "* * * * *"
    }
  ]
}
'@
[System.IO.File]::WriteAllText("$projectRoot\vercel.json", $vercelJson, $Utf8NoBom)
Write-Host "  + vercel.json (security headers, rewrites & cron job)" -ForegroundColor Green

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
    "@vercel/kv": "^1.0.0",
    "web-push": "^3.5.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
'@
[System.IO.File]::WriteAllText("$projectRoot\package.json", $packageJson, $Utf8NoBom)
Write-Host "  + package.json (all required dependencies including web-push)" -ForegroundColor Green

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

# Cron job secret for /cron/check-reminders
CRON_SECRET=generate_a_strong_random_secret_here

# VAPID keys for Web Push Notifications (generate with web-push CLI)
VAPID_PUBLIC_KEY=your_public_vapid_key_here
VAPID_PRIVATE_KEY=your_private_vapid_key_here

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
const CACHE_NAME = 'atts-v10';
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
    requireInteraction: true,
    actions: [
      { action: 'open-journal', title: 'Write Journal' },
      { action: 'snooze', title: 'Remind Later' }
    ],
    data: { url: data.url || '/#/journey' },
    tag: 'reminder'
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'open-journal') {
    clients.openWindow('/#/journey');
  } else {
    const urlToOpen = event.notification.data?.url || '/#/journey';
    clients.openWindow(urlToOpen);
  }
});

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(
    fetch('/api/setup/update-subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        oldSubscription: event.oldSubscription,
        newSubscription: event.newSubscription
      })
    })
  );
});
'@
[System.IO.File]::WriteAllText("$projectRoot\sw.js", $swJs, $Utf8NoBom)
Write-Host "  + sw.js (service worker with push notification support)" -ForegroundColor Green

# ============================================
# SECTION 4: PWA Icon Generation
# ============================================
Write-Host "`nPWA Icon Setup..." -ForegroundColor Yellow

$icon192Path = Join-Path $projectRoot "icon-192.png"
$icon512Path = Join-Path $projectRoot "icon-512.png"
$icon72Path  = Join-Path $projectRoot "icon-72.png"

# Function to create a solid gold icon (Approved verb: New)
function New-SolidIcon($path, $width, $height) {
    try {
        Add-Type -AssemblyName System.Drawing
        $bmp = New-Object System.Drawing.Bitmap($width, $height)
        $g = [System.Drawing.Graphics]::FromImage($bmp)
        $g.Clear([System.Drawing.Color]::FromArgb(200, 167, 91))  # #C8A75B
        $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
        $g.Dispose()
        $bmp.Dispose()
        return $true
    } catch {
        Write-Host "    Could not generate $path using System.Drawing: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

$icon192Exists = Test-Path $icon192Path
$icon512Exists = Test-Path $icon512Path

if ($icon192Exists -and $icon512Exists) {
    Write-Host "  + Existing icon-192.png and icon-512.png found. Skipping icon generation." -ForegroundColor Green
    # Ensure 72x72 also exists
    if (-not (Test-Path $icon72Path)) {
        $success = New-SolidIcon $icon72Path 72 72
        if ($success) { Write-Host "    Created icon-72.png" -ForegroundColor Green }
    }
} else {
    $useCustom = Read-Host "  ? Do you have a source icon file (>= 512x512) to use for PWA icons? (y/n)"
    if ($useCustom -eq 'y') {
        $sourcePath = Read-Host "  ? Enter the full path to your source PNG file"
        if (Test-Path $sourcePath) {
            Write-Host "    Resizing icons using .NET Drawing..." -ForegroundColor DarkYellow
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
                Write-Host "    Failed to generate icons from custom file. Creating solid gold placeholders." -ForegroundColor Red
                New-SolidIcon $icon192Path 192 192
                New-SolidIcon $icon512Path 512 512
                New-SolidIcon $icon72Path 72 72
            }
        } else {
            Write-Host "    Source file not found. Creating solid gold placeholders." -ForegroundColor Red
            New-SolidIcon $icon192Path 192 192
            New-SolidIcon $icon512Path 512 512
            New-SolidIcon $icon72Path 72 72
        }
    } else {
        Write-Host "    No custom icon provided. Creating solid gold placeholders." -ForegroundColor DarkYellow
        New-SolidIcon $icon192Path 192 192
        New-SolidIcon $icon512Path 512 512
        New-SolidIcon $icon72Path 72 72
    }
}

# ============================================
# SECTION 5: Static HTML Pages
# ============================================
Write-Host "`nGenerating static HTML pages..." -ForegroundColor Yellow

# 5.1 verify.html (Public Certificate Verification)
$verifyHtml = @'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate Verification - AlamQuant ATTS</title>
  <style>
    :root {
      --bg: #0B1220;
      --surface: rgba(17,24,39,0.92);
      --gold: #C8A75B;
      --accent: #2563EB;
      --text: #F9FAFB;
      --text-secondary: #9CA3AF;
      --danger: #EF4444;
      --success: #22C55E;
      --border-gold: rgba(200,167,91,0.35);
      --radius: 16px;
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Inter', sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
      padding: 20px;
    }
    .verify-container {
      max-width: 500px;
      width: 90%;
      text-align: center;
      background: var(--surface);
      border: 1px solid var(--border-gold);
      border-radius: var(--radius);
      padding: 32px 24px;
      backdrop-filter: blur(20px);
    }
    h2 {
      background: linear-gradient(135deg, #E8C97A, #C8A75B);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      font-weight: 800;
      margin-bottom: 20px;
    }
    input {
      background: rgba(255,255,255,0.08);
      border: 1px solid var(--border-gold);
      color: var(--text);
      padding: 12px 16px;
      border-radius: 8px;
      width: 100%;
      margin: 12px 0;
      font-family: inherit;
      font-size: 1rem;
      outline: none;
      transition: 0.3s;
    }
    input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(37,99,235,0.2);
    }
    .btn {
      background: linear-gradient(135deg, var(--accent), #1d4ed8);
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 30px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.25s;
      font-size: 0.95rem;
      width: 100%;
      margin-top: 8px;
      font-family: inherit;
    }
    .btn:hover {
      background: linear-gradient(135deg, #60A5FA, #2563EB);
      box-shadow: 0 6px 20px rgba(37,99,235,0.7);
      transform: translateY(-2px);
    }
    #result { margin-top: 24px; }
    #result h3 { color: var(--success); margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="verify-container">
    <h2>🔍 Certificate Verification</h2>
    <input type="text" id="verify-input" placeholder="Enter verification code" autocomplete="off">
    <button class="btn" onclick="verify()">Verify</button>
    <div id="result"></div>
  </div>
  <script>
    async function verify() {
      const code = document.getElementById('verify-input').value.trim();
      if (!code) return;
      try {
        const res = await fetch(`/api/setup/verify/${code}`).then(r => r.json());
        const resultDiv = document.getElementById('result');
        if (res.valid) {
          resultDiv.innerHTML = `<div style="color: var(--success);">
            <p style="font-size:3rem;">✅</p>
            <h3>Valid Certificate</h3>
            <p><strong>Name:</strong> ${res.display_name || res.user}</p>
            <p><strong>Issued:</strong> ${new Date(res.issued_at).toLocaleDateString('en-US')}</p>
            <p><strong>Code:</strong> ${res.verification_code}</p>
          </div>`;
        } else {
          resultDiv.innerHTML = `<div style="color: var(--danger);">
            <p style="font-size:3rem;">❌</p>
            <h3>Invalid Certificate</h3>
            <p>This code was not found in the system.</p>
          </div>`;
        }
      } catch(e) {
        document.getElementById('result').innerHTML = `<p style="color: var(--danger);">Error verifying certificate. Please try again.</p>`;
      }
    }
  </script>
</body>
</html>
'@
[System.IO.File]::WriteAllText("$projectRoot\verify.html", $verifyHtml, $Utf8NoBom)
Write-Host "  + verify.html (public certificate verification)" -ForegroundColor Green

# 5.2 admin.html - EMPTY PLACEHOLDER (manual replace required)
$adminHtmlPlaceholder = @'
<!-- REPLACE THIS FILE WITH THE FINAL admin.html PRODUCTION CODE -->
'@
[System.IO.File]::WriteAllText("$projectRoot\admin.html", $adminHtmlPlaceholder, $Utf8NoBom)
Write-Host "  + admin.html (EMPTY placeholder - replace with final enterprise admin.html)" -ForegroundColor Yellow

# 5.3 index.html - EMPTY PLACEHOLDER (manual replace required)
$indexHtmlPlaceholder = @'
<!-- REPLACE THIS FILE WITH THE FINAL index.html PRODUCTION CODE -->
'@
[System.IO.File]::WriteAllText("$projectRoot\index.html", $indexHtmlPlaceholder, $Utf8NoBom)
Write-Host "  + index.html (EMPTY placeholder - replace with final enterprise index.html)" -ForegroundColor Yellow

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
  overflow-x: hidden;
  position: relative;
}
/* Glass card */
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
  overflow: hidden;
  max-width: 100%;
  word-wrap: break-word;
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
.progress-bar { background:rgba(255,255,255,0.1); border-radius:20px; height:14px; overflow:hidden; margin:10px 0; }
.progress-fill { height:100%; background:linear-gradient(90deg, var(--accent), var(--accent-bright)); border-radius:20px; box-shadow:0 0 10px var(--accent); width:0%; transition:width 1.2s cubic-bezier(0.4,0,0.2,1); }
.drop-zone {
  border: 2px dashed var(--border-gold);
  border-radius: var(--radius);
  padding: 30px;
  text-align: center;
  cursor: pointer;
  transition: 0.3s;
  background: rgba(255,255,255,0.02);
  margin: 12px 0;
}
.drop-zone.dragover { border-color: var(--gold-bright); background: rgba(234,179,8,0.1); }
.media-item {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255,255,255,0.05);
  padding: 8px;
  border-radius: 8px;
  max-width: 100%;
  overflow: hidden;
}
.media-item .url-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.8rem;
}
.phase-tag { background:var(--gold); color:#020617; padding:5px 16px; border-radius:20px; font-weight:700; font-size:0.85rem; display:inline-block; }
.toast {
  position: fixed; top: 20px; right: 20px; background: var(--accent); color: white;
  padding: 14px 22px; border-radius: 30px; z-index: 9999; font-weight: 700;
  box-shadow: 0 10px 30px rgba(0,0,0,0.6); opacity: 0; transform: translateX(120%);
  transition: 0.4s cubic-bezier(0.4,0,0.2,1);
}
.toast.show { opacity:1; transform:translateX(0); }
.modal-overlay {
  position: fixed; top:0; left:0; right:0; bottom:0; background: rgba(0,0,0,0.85);
  display: flex; align-items: center; justify-content: center; z-index: 10000;
  backdrop-filter: blur(4px);
}
.modal-content {
  max-width: 90vw; max-height: 85vh; overflow-y: auto; width: 500px;
  background: var(--surface); border: 1px solid var(--border-gold);
  border-radius: var(--radius); padding: 24px;
}
/* Responsive */
@media (max-width: 767px) {
  .grid-2, .grid-3, .grid-4 { grid-template-columns: 1fr; }
}
'@
[System.IO.File]::WriteAllText("$projectRoot\styles.css", $stylesCss, $Utf8NoBom)
Write-Host "  + styles.css (enterprise premium theme)" -ForegroundColor Green

# ============================================
# SECTION 7: API Setup EMPTY PLACEHOLDER
# ============================================
Write-Host "`nGenerating api/setup.js placeholder..." -ForegroundColor Yellow
$setupJsPlaceholder = @'
// Replace this file with the final api/setup.js production code
'@
[System.IO.File]::WriteAllText("$projectRoot\api\setup.js", $setupJsPlaceholder, $Utf8NoBom)
Write-Host "  + api/setup.js (EMPTY placeholder - replace with final enterprise version)" -ForegroundColor Yellow

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
Write-Host "3. Replace placeholder 'admin.html' with the final enterprise admin.html." -ForegroundColor Yellow
Write-Host "4. Set environment variables in Vercel (DATABASE_URL, JWT_SECRET, VAPID_*, CRON_SECRET, etc.)" -ForegroundColor Yellow
Write-Host "5. Run 'npm install' then 'npm start' for local development." -ForegroundColor Yellow
Write-Host "6. For production, deploy to Vercel." -ForegroundColor Yellow
Write-Host "7. Set ALLOW_INIT_DB=true in Vercel environment variables (temporarily)." -ForegroundColor Yellow
Write-Host "8. Initialize the database by running:" -ForegroundColor Yellow
Write-Host "   Invoke-RestMethod -Uri https://<your-project>.vercel.app/api/setup/init-db -Method POST -ContentType 'application/json' -Body '{\"admin_secret\":\"your_admin_secret\"}'" -ForegroundColor Cyan
Write-Host "9. Default admin login: admin@alamquant.com (temporary password from Vercel function logs)." -ForegroundColor Yellow
Write-Host "10. Remove ALLOW_INIT_DB env variable after DB initialization." -ForegroundColor Yellow
Write-Host "11. Ensure all PWA icons (icon-192.png, icon-512.png) are valid. Placeholder solid gold icons were generated if not present." -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  REMINDER: The generated .env.local file contains dummy values. You MUST update it with your real credentials!" -ForegroundColor Red
Write-Host ""
Write-Host "🎉 Happy Trading Transformation! - AlamQuant ATTS" -ForegroundColor Magenta
Write-Host ""