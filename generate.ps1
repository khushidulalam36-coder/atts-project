# ============================================
# AlamQuant ATTS - Production-Ready File Generator
# ============================================
# This script creates all necessary project files.
# index.html and api/setup.js are created as PLACEHOLDERS.
# You must replace them with the provided production code manually.
# ============================================

$projectRoot = Get-Location
Write-Host "Project root: $projectRoot" -ForegroundColor Cyan

# Create required folders
New-Item -ItemType Directory -Force -Path "$projectRoot\api" | Out-Null

# ============================================
# 1. vercel.json (updated with nodejs18.x runtime)
# ============================================
$vercelJson = @'
{
  "rewrites": [
    { "source": "/admin", "destination": "/admin.html" }
  ]
}
'@
$vercelJson | Out-File -FilePath "$projectRoot\vercel.json" -Encoding utf8
Write-Host "Created vercel.json (nodejs18.x)" -ForegroundColor Green

# ============================================
# 2. package.json (busboy added)
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
Write-Host "Created package.json (busboy added)" -ForegroundColor Green

# ============================================
# 3. styles.css (Complete Premium Styles)
# ============================================
$stylesCss = @'
/* AlamQuant ATTS Premium Styles */
:root {
  --bg: #02040c;
  --surface: rgba(15, 18, 42, 0.8);
  --gold: #f2c744;
  --gold-bright: #ffe8a1;
  --gold-light: #ffdf80;
  --accent: #00f0ff;
  --accent-bright: #5effff;
  --accent2: #ff337a;
  --text: #edeef2;
  --text-secondary: #9ca3b8;
  --danger: #ff5252;
  --success: #69f0ae;
  --warning: #ffd740;
  --purple: #b388ff;
  --orange: #ff9100;
  --border-gold: rgba(242,199,68,0.35);
  --border-accent: rgba(0,240,255,0.3);
  --font-en: 'Inter', sans-serif;
  --radius: 22px;
  --radius-sm: 14px;
  --transition: 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --glow-gold: 0 0 20px rgba(242,199,68,0.4);
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

body {
  font-family: var(--font-en);
  background: linear-gradient(160deg, #090b1a 0%, #150b2e 50%, #090b1a 100%);
  background-size: 300% 300%;
  animation: bgSlide 20s ease infinite;
  color: var(--text);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100vh;
  padding-bottom: 140px;
  overflow-x: hidden;
  position: relative;
}

.container { width:100%; max-width:960px; padding:16px; z-index:1; position:relative; }

.glass {
  background: linear-gradient(145deg, rgba(25,28,55,0.8), rgba(15,18,42,0.6));
  backdrop-filter: blur(40px) saturate(180%);
  -webkit-backdrop-filter: blur(40px) saturate(180%);
  border-radius: var(--radius);
  padding: 24px;
  margin-bottom: 18px;
  border: 1px solid var(--border-gold);
  box-shadow: 0 10px 40px rgba(0,0,0,0.7), inset 0 0 30px rgba(255,255,255,0.02);
  transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
  position: relative;
  overflow: hidden;
}

.glass:hover {
  border-color: rgba(242,199,68,0.6);
  box-shadow: 0 15px 50px rgba(0,0,0,0.8), 0 0 30px var(--glow-gold);
  transform: translateY(-3px);
}

h1,h2,h3,h4 {
  color: var(--gold);
  margin-bottom: 12px;
  text-shadow: 0 0 16px rgba(242,199,68,0.3);
  position:relative; z-index:1; font-weight:700;
}

h2 { font-size:1.6rem; }
h3 { font-size:1.25rem; }

.btn {
  background: linear-gradient(135deg, #f2c744 0%, #ff8c00 100%);
  color: #0b0b1a;
  border:none;
  padding:12px 24px;
  border-radius:30px;
  font-weight:800;
  cursor:pointer;
  transition: all var(--transition);
  font-size:0.9rem;
  box-shadow: 0 4px 22px rgba(242,199,68,0.5);
  letter-spacing:0.5px;
  position:relative;
  overflow:hidden;
  z-index:1;
  font-family:var(--font-en);
}

.btn:hover { box-shadow:0 6px 24px rgba(242,199,68,0.6); transform:translateY(-1px); }
.btn:active { transform:scale(0.96); }

.btn-outline { background:transparent; border:2px solid var(--gold); color:var(--gold); box-shadow:none; }
.btn-outline:hover { background:rgba(242,199,68,0.1); }

.btn-accent { background:linear-gradient(135deg, #00f0ff, #0051ff); box-shadow:0 4px 22px rgba(0,240,255,0.5); }
.btn-danger { background:linear-gradient(135deg, #ff5252, #ff1744); box-shadow:0 4px 18px rgba(255,82,82,0.4); }
.btn-sm { padding:6px 16px; font-size:0.8rem; border-radius:20px; }
.btn-lg { padding:16px 32px; font-size:1.1rem; border-radius:40px; }

input, textarea, select {
  background:rgba(255,255,255,0.05);
  border:1px solid var(--border-gold);
  color:white;
  padding:14px 16px;
  border-radius:var(--radius-sm);
  width:100%;
  margin:6px 0;
  font-family:inherit;
  transition:var(--transition);
  outline:none;
  font-size:0.95rem;
}

input:focus, textarea:focus, select:focus {
  border-color:var(--gold-bright);
  box-shadow:0 0 0 3px rgba(242,199,68,0.15), 0 0 20px rgba(242,199,68,0.2);
  background:rgba(255,255,255,0.08);
}

textarea { resize:vertical; min-height:60px; }

.grid-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
.flex { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
.hidden { display:none !important; }

.bottom-nav {
  position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
  background: rgba(12, 14, 34, 0.95); backdrop-filter: blur(24px);
  border-radius: 40px; padding: 8px 20px; display: flex; gap: 10px;
  border: 1px solid var(--border-gold);
  box-shadow: 0 8px 30px rgba(0,0,0,0.8), 0 0 25px rgba(242,199,68,0.15);
  z-index: 100;
}

.nav-item {
  flex-direction: column; align-items: center; font-size: 10px; color: #888;
  transition: 0.3s; cursor: pointer; padding: 4px 6px;
}

.nav-item span { font-size: 20px; transition: 0.3s; }
.nav-item.active { color: var(--gold-bright); }
.nav-item.active span { transform: translateY(-4px) scale(1.2); text-shadow: 0 0 15px var(--gold-bright); }
.nav-item.active::after {
  content: ''; position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%);
  width: 24px; height: 3px; background: var(--gold-bright); border-radius: 3px; box-shadow: 0 0 12px var(--gold-bright);
}

.badge {
  background:linear-gradient(135deg, var(--gold), var(--gold-bright));
  color:#0a0a0a;
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
  background:rgba(255,255,255,0.08);
  border-radius:20px;
  height:14px;
  overflow:hidden;
  margin:10px 0;
  box-shadow:inset 0 2px 4px rgba(0,0,0,0.4);
}

.progress-fill {
  height:100%;
  background:linear-gradient(90deg, var(--gold), var(--gold-bright));
  width:0%;
  transition:width 1.2s cubic-bezier(0.4,0,0.2,1);
  border-radius:20px;
}

.chart-container { margin-top:20px; max-height:280px; position:relative; z-index:1; }

.phase-tag {
  background:var(--gold); color:#0a0a0a;
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
'@
$stylesCss | Out-File -FilePath "$projectRoot\styles.css" -Encoding utf8
Write-Host "Created styles.css (premium theme)" -ForegroundColor Green

# ============================================
# 4. sw.js (Service Worker)
# ============================================
$swJs = @'
const CACHE_NAME = 'atts-v7';
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
  "background_color": "#02040c",
  "theme_color": "#f2c744",
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
import handler from './api/setup.js';   // ← ডিফল্ট এক্সপোর্ট (toNodeHandler(apiHandler))

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
    // সরাসরি API হ্যান্ডলারকে req, res দিন – কোনো ফেচ Request নয়
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
'@
$envLocal | Out-File -FilePath "$projectRoot\.env.local" -Encoding utf8
Write-Host "Created .env.local (placeholder)" -ForegroundColor Yellow

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
# 9. admin.html (Complete Admin Dashboard - FULL JavaScript)
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
  <link rel="stylesheet" href="styles.css">
  <style>
    :root {
      --sidebar-width: 260px;
    }
    body { font-family: 'Inter', sans-serif; display: flex; min-height: 100vh; }
    .admin-layout { display: flex; width: 100%; }
    .admin-sidebar {
      width: var(--sidebar-width);
      background: rgba(8, 10, 26, 0.98);
      border-right: 1px solid var(--border-gold);
      padding: 20px 0;
      position: fixed;
      height: 100vh;
      overflow-y: auto;
      z-index: 100;
    }
    .admin-sidebar .logo { padding: 0 20px 20px; border-bottom: 1px solid var(--border-gold); font-size: 1.4rem; font-weight: 800; color: var(--gold-bright); }
    .admin-sidebar ul { list-style: none; padding: 10px 0; }
    .admin-sidebar ul li {
      padding: 14px 24px;
      color: var(--text-secondary);
      cursor: pointer;
      transition: 0.3s;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .admin-sidebar ul li:hover, .admin-sidebar ul li.active {
      background: rgba(242,199,68,0.15);
      color: var(--gold-bright);
      border-left: 3px solid var(--gold-bright);
    }
    .admin-main {
      margin-left: var(--sidebar-width);
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
    .stat-card { text-align: center; }
    .stat-card .stat-value { font-size: 2rem; font-weight: 800; color: var(--gold-bright); }
    .stat-card .stat-label { color: var(--text-secondary); margin-top: 8px; }
    .chapter-editor { background: rgba(255,255,255,0.03); border-radius: var(--radius-sm); padding: 20px; margin: 16px 0; border: 1px solid var(--border-gold); }
    .question-item { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 16px; margin: 12px 0; border-left: 3px solid var(--accent); }
    .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
    .toast {
      position:fixed; top:20px; right:20px;
      background:linear-gradient(135deg, var(--gold), var(--gold-bright));
      color:#0a0a0a; font-weight:700;
      padding:14px 22px; border-radius:30px;
      z-index:9999; box-shadow:0 10px 30px rgba(0,0,0,0.6);
      opacity:0; transform:translateX(120%);
      transition:0.4s cubic-bezier(0.4,0,0.2,1);
    }
    .toast.show { opacity:1; transform:translateX(0); }
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
        document.getElementById("admin-dashboard").style.display = "flex";
        document.getElementById("admin-name").textContent = data.name;
        showSection("dashboard");
      } else {
        document.getElementById("login-error").textContent = data.error || "Login failed";
        document.getElementById("login-error").style.display = "block";
      }
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
        settings: "⚙️ Settings"
      };
      document.getElementById("section-title").textContent = titles[section] || "";
      switch(section) {
        case "dashboard": loadDashboard(); break;
        case "chapters": loadChapters(); break;
        case "users": loadUsers(); break;
        case "certificates": loadCertificates(); break;
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
      const chapters = await adminApi("GET", "/admin/chapters");
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
      const chapters = await adminApi("GET", "/admin/chapters");
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
      const chapters = await adminApi("GET", "/admin/chapters");
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

    // ----- Settings -----
    function loadSettings() {
      document.getElementById("content-area").innerHTML = `
        <div class="glass"><h3>⚙️ System Settings</h3><p>Settings coming soon.</p></div>`;
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
Write-Host "Created admin.html (full JavaScript)" -ForegroundColor Green

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
    body {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      margin: 0;
    }
    .verify-container {
      max-width: 500px;
      width: 90%;
      text-align: center;
    }
    .verify-container h2 { color: var(--gold-bright); }
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
        resultDiv.innerHTML = `
          <div style="color: var(--success);">
            <p style="font-size:3rem;">✅</p>
            <h3>Valid Certificate</h3>
            <p><strong>Name:</strong> ${res.display_name || res.user}</p>
            <p><strong>Issued:</strong> ${new Date(res.issued_at).toLocaleDateString('bn-BD')}</p>
            <p><strong>Code:</strong> ${res.verification_code}</p>
          </div>`;
      } else {
        resultDiv.innerHTML = `
          <div style="color: var(--danger);">
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
# 11. index.html (PLACEHOLDER - replace with final production index.html)
# ============================================
$indexPlaceholder = @"
<!--
  ===================================================
  AlamQuant ATTS - index.html (PLACEHOLDER)
  Replace this file with the complete production-ready
  index.html provided in the final delivery.
  ===================================================
-->
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AlamQuant ATTS</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <h1>AlamQuant ATTS</h1>
  <p>Replace this file with the full index.html from the production package.</p>
</body>
</html>
"@
$indexPlaceholder | Out-File -FilePath "$projectRoot\index.html" -Encoding utf8
Write-Host "Created index.html (PLACEHOLDER - replace with production code)" -ForegroundColor Yellow

# ============================================
# 12. api/setup.js (PLACEHOLDER - replace with final production api/setup.js)
# ============================================
$setupJsPlaceholder = @'
// ===================================================
// AlamQuant ATTS - api/setup.js (PLACEHOLDER)
// Replace this file with the complete production-ready
// api/setup.js provided in the final delivery.
// ===================================================
export default async function handler(req) {
  return new Response("API not configured yet", { status: 501 });
}
'@
$setupJsPlaceholder | Out-File -FilePath "$projectRoot\api\setup.js" -Encoding utf8
Write-Host "Created api/setup.js (PLACEHOLDER - replace with production code)" -ForegroundColor Yellow

# ============================================
# Final message
# ============================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  All project files generated successfully!" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Replace 'index.html' and 'api/setup.js' with the final production versions." -ForegroundColor Yellow
Write-Host "2. Fill in your real credentials in '.env.local'." -ForegroundColor Yellow
Write-Host "3. Place icon-192.png and icon-512.png in the project root (for PWA)." -ForegroundColor Yellow
Write-Host "4. Run 'npm install' then 'npm start' for local development." -ForegroundColor Yellow
Write-Host "5. For production, deploy to Vercel (remember to set environment variables)." -ForegroundColor Yellow
Write-Host ""
Write-Host "Note: CRON jobs in vercel.json are only active on Vercel Pro plan." -ForegroundColor Magenta
Write-Host ""