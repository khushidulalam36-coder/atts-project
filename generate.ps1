# ============================================
# AlamQuant ATTS - Production-Ready File Generator (Enterprise-Grade)
# ============================================
# This script creates all necessary project files.
# IMPORTANT: 
#   1. Replace the placeholder index.html and api/setup.js with the final enterprise versions.
#   2. Set environment variables in Vercel.
#   3. Initialize the database via the /init-db endpoint.
# ============================================

$projectRoot = Get-Location
Write-Host "Project root: $projectRoot" -ForegroundColor Cyan

# BOM‑হীন UTF‑8 এনকোডিং (এই লাইনটি ছাড়া বাংলা ও ইমোজি নষ্ট হবে)
$Utf8NoBom = New-Object System.Text.UTF8Encoding $false

# Create required folders
New-Item -ItemType Directory -Force -Path "$projectRoot\api" | Out-Null

# ============================================
# 1. vercel.json (with charset headers & verify route + security headers)
# ============================================
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
Write-Host "Created vercel.json (Enterprise security headers)" -ForegroundColor Green

# ============================================
# 2. package.json
# ============================================
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
    "busboy": "^1.6.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.0"
  }
}
'@
[System.IO.File]::WriteAllText("$projectRoot\package.json", $packageJson, $Utf8NoBom)
Write-Host "Created package.json" -ForegroundColor Green

# ============================================
# 3. styles.css (Enterprise Premium Theme - identical to index.html inline styles)
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
Write-Host "Created styles.css (Enterprise Premium Theme)" -ForegroundColor Green

# ============================================
# 4. sw.js (Service Worker with push notification support)
# ============================================
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
Write-Host "Created sw.js (with push notification handling)" -ForegroundColor Green

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
[System.IO.File]::WriteAllText("$projectRoot\manifest.json", $manifestJson, $Utf8NoBom)
Write-Host "Created manifest.json" -ForegroundColor Green

# ============================================
# 6. server.js (Local Development Server)
# ============================================
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
Write-Host "Created server.js" -ForegroundColor Green

# ============================================
# 7. .env.local (Placeholder)
# ============================================
$envLocal = @'
# AlamQuant ATTS - Environment Variables
# IMPORTANT: Replace these placeholder values with your real credentials.
# Never commit this file to public repositories.

DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
JWT_SECRET=replace_with_strong_random_secret_here
ADMIN_SECRET=strong_admin_secret_for_init_db
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
OPENAI_API_KEY=sk-your-openai-api-key
CORS_ORIGIN=https://your-domain.vercel.app

# ===== Database Initialization =====
# After first deploy, set ALLOW_INIT_DB=true in Vercel Environment Variables,
# then run: Invoke-RestMethod -Uri https://your-project.vercel.app/api/setup/init-db -Method POST -ContentType "application/json" -Body '{"admin_secret":"your_admin_secret"}'
# Default admin email: admin@alamquant.com
# A random temporary password will be printed in Vercel function logs.
# Change password immediately after first login!
'@
[System.IO.File]::WriteAllText("$projectRoot\.env.local", $envLocal, $Utf8NoBom)
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
[System.IO.File]::WriteAllText("$projectRoot\.gitignore", $gitignore, $Utf8NoBom)
Write-Host "Created .gitignore" -ForegroundColor Green

# ============================================
# 9. verify.html (Public Certificate Verification)
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
[System.IO.File]::WriteAllText("$projectRoot\verify.html", $verifyHtml, $Utf8NoBom)
Write-Host "Created verify.html" -ForegroundColor Green

# ============================================
# 10. admin.html (Placeholder - Admin panel is now integrated into the main index.html)
# ============================================
$adminHtmlPlaceholder = @'
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin - AlamQuant ATTS</title>
  <link rel="stylesheet" href="styles.css">
  <!-- Quill Rich Text Editor -->
  <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
  <script src="https://cdn.quilljs.com/1.3.6/quill.min.js"></script>
  <style>
    :root {
      --bg: #0B1220;
      --surface: rgba(17,24,39,0.92);
      --gold: #C8A75B;
      --gold-bright: #E8C97A;
      --gold-light: #F6E4B5;
      --accent: #2563EB;
      --accent-bright: #60A5FA;
      --accent2: #7C3AED;
      --purple: #8B5CF6;
      --cyan: #22D3EE;
      --orange: #F59E0B;
      --text: #F9FAFB;
      --text-secondary: #9CA3AF;
      --danger: #EF4444;
      --success: #22C55E;
      --warning: #F59E0B;
      --border-gold: rgba(200,167,91,0.35);
      --border-accent: rgba(37,99,235,0.30);
      --radius: 12px;
      --radius-sm: 8px;
      --transition: 0.3s ease;
    }
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Inter', 'Hind Siliguri', sans-serif; background: var(--bg); color: var(--text); display: flex; min-height: 100vh; }
    .admin-sidebar {
      width: 260px; background: #111827; border-right: 1px solid rgba(200,167,91,0.25);
      padding: 24px 0; display: flex; flex-direction: column; position: fixed; top:0; left:0; bottom:0; overflow-y: auto; z-index: 10;
    }
    .admin-sidebar .logo {
      padding: 0 24px 20px; border-bottom: 1px solid rgba(200,167,91,0.25);
      font-size: 1.2rem; font-weight: 700; color: var(--gold);
    }
    .admin-sidebar nav { flex: 1; margin-top: 16px; }
    .admin-sidebar nav a {
      display: flex; align-items: center; gap: 10px; padding: 12px 24px;
      color: var(--text-secondary); text-decoration: none; font-weight: 500;
      border-left: 3px solid transparent; transition: var(--transition); cursor: pointer;
    }
    .admin-sidebar nav a:hover, .admin-sidebar nav a.active {
      background: rgba(37,99,235,0.12); color: var(--accent-bright);
      border-left-color: var(--accent);
    }
    .admin-main { margin-left: 260px; flex: 1; padding: 30px; overflow-y: auto; }
    .card { background: var(--surface); border: 1px solid var(--border-gold); border-radius: var(--radius); padding: 20px; margin-bottom: 20px; }
    .btn {
      background: var(--accent); color: white; border: none; padding: 8px 18px; border-radius: 20px;
      cursor: pointer; font-weight: 600; transition: var(--transition); font-size: 0.9rem; display: inline-flex; align-items: center; gap: 6px;
    }
    .btn:hover { background: var(--accent-bright); }
    .btn-outline { background: transparent; border: 2px solid var(--gold); color: var(--gold); }
    .btn-outline:hover { background: rgba(200,167,91,0.1); }
    .btn-danger { background: var(--danger); }
    .btn-danger:hover { background: #dc2626; }
    .btn-sm { padding: 4px 12px; font-size: 0.8rem; border-radius: 16px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px,1fr)); gap: 16px; }
    .stat { background: var(--surface); border: 1px solid var(--border-gold); border-radius: var(--radius); padding: 16px; text-align: center; }
    .stat h3 { color: var(--gold); font-size: 1.8rem; margin-bottom: 4px; }
    .stat p { color: var(--text-secondary); font-size: 0.9rem; }
    table { width: 100%; border-collapse: collapse; background: var(--surface); border-radius: var(--radius); overflow: hidden; margin-top: 16px; }
    th { background: rgba(200,167,91,0.1); color: var(--gold); padding: 12px; text-align: left; font-weight: 600; }
    td { padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.05); }
    tr:hover td { background: rgba(255,255,255,0.03); }
    input, select, textarea {
      background: rgba(255,255,255,0.08); border: 1px solid var(--border-gold);
      color: var(--text); padding: 8px 12px; border-radius: 6px; width: 100%; margin: 6px 0; font-family: inherit;
    }
    input:focus, textarea:focus, select:focus { border-color: var(--accent-bright); outline: none; }
    .hidden { display: none !important; }
    .flex { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .theme-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px,1fr)); gap: 12px; }
    .color-picker-group { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; }
    .color-picker-group input[type="color"] { width: 40px; height: 30px; border: none; background: transparent; }
    .color-picker-group input[type="text"] { width: 80px; font-size: 0.75rem; }
    .media-thumb { width: 80px; height: 60px; object-fit: cover; border-radius: 6px; margin-right: 10px; }
    .ql-toolbar.ql-snow { border-color: var(--border-gold); background: rgba(255,255,255,0.05); }
    .ql-container.ql-snow { border-color: var(--border-gold); }
    .ql-editor { color: var(--text); }
    .toast {
      position: fixed; top: 20px; right: 20px; background: var(--accent); color: white;
      padding: 12px 20px; border-radius: 20px; z-index: 9999; font-weight: 600;
      transition: opacity 0.3s; opacity: 1;
    }
    .modal-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7);
      display: flex; align-items: center; justify-content: center; z-index: 1000;
    }
    .modal-content { background: var(--surface); border: 1px solid var(--border-gold); border-radius: var(--radius); padding: 24px; width: 90%; max-width: 700px; max-height: 80vh; overflow-y: auto; }
    @media (max-width: 768px) {
      .admin-sidebar { width: 100%; height: auto; position: relative; flex-direction: row; overflow-x: auto; padding: 12px; }
      .admin-sidebar nav { display: flex; gap: 8px; margin-top: 0; }
      .admin-sidebar nav a { padding: 8px 12px; border-left: none; border-bottom: 2px solid transparent; }
      .admin-sidebar nav a.active { border-bottom-color: var(--accent); }
      .admin-main { margin-left: 0; padding: 16px; }
      .grid-2 { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="admin-sidebar">
    <div class="logo">⚙️ ATTS Admin</div>
    <nav>
      <a data-tab="stats" class="active" onclick="switchTab('stats')">📊 ড্যাশবোর্ড</a>
      <a data-tab="users" onclick="switchTab('users')">👥 ইউজার</a>
      <a data-tab="simulate" onclick="switchTab('simulate')">🧪 সিমুলেট</a>
      <a data-tab="chapters" onclick="switchTab('chapters')">📚 চ্যাপ্টার</a>
      <a data-tab="courses" onclick="switchTab('courses')">📘 কোর্স</a>
      <a data-tab="content" onclick="switchTab('content')">📝 কন্টেন্ট</a>
      <a data-tab="theme" onclick="switchTab('theme')">🎨 থিম</a>
      <a data-tab="media" onclick="switchTab('media')">🖼️ মিডিয়া</a>
      <a data-tab="translations" onclick="switchTab('translations')">🌐 অনুবাদ</a>
      <a data-tab="activity" onclick="switchTab('activity')">📋 অ্যাক্টিভিটি</a>
      <a data-tab="settings" onclick="switchTab('settings')">⚙️ সেটিংস</a>
      <a onclick="logout()" style="color: var(--danger);">🚪 লগআউট</a>
    </nav>
  </div>
  <div class="admin-main">
    <!-- Login Screen -->
    <div id="login-screen">
      <div class="card" style="max-width:400px; margin:40px auto;">
        <h2 style="color:var(--gold);">🔐 অ্যাডমিন লগইন</h2>
        <input type="email" id="admin-email" placeholder="ইমেইল" autocomplete="email">
        <input type="password" id="admin-password" placeholder="পাসওয়ার্ড" autocomplete="current-password">
        <button class="btn" onclick="adminLogin()" style="width:100%; margin-top:12px;">লগইন</button>
        <p id="login-error" style="color:var(--danger); margin-top:8px; display:none;"></p>
      </div>
    </div>
    <!-- Admin Panel (after login) -->
    <div id="panel-screen" class="hidden"></div>
  </div>

  <!-- Chapter Editor Modal -->
  <div id="chapter-editor-modal" class="modal-overlay hidden">
    <div class="modal-content">
      <button class="btn btn-sm btn-outline" style="float:right;" onclick="closeChapterEditor()">✕</button>
      <h3 id="chapter-editor-title">চ্যাপ্টার সম্পাদনা</h3>
      <div class="grid-2">
        <div><label>শিরোনাম</label><input type="text" id="ch-title"></div>
        <div><label>ক্রম</label><input type="number" id="ch-order" min="1"></div>
      </div>
      <label>বিষয়বস্তু (HTML)</label>
      <div id="chapter-quill-editor" style="height:250px;"></div>
      <div class="grid-2" style="margin-top:12px;">
        <div><label>ছবির URL (কমা দিয়ে)</label><input type="text" id="ch-images" placeholder="url1,url2"></div>
        <div><label>ভিডিও URL (কমা দিয়ে)</label><input type="text" id="ch-videos" placeholder="url1,url2"></div>
      </div>
      <div class="grid-2">
        <div><label>পাসিং স্কোর (%)</label><input type="number" id="ch-passing" value="90"></div>
        <div><label>ভাষা</label><select id="ch-language"><option value="bn">বাংলা</option><option value="en">English</option></select></div>
      </div>
      <div style="margin-top:16px;">
        <button class="btn" onclick="saveChapter()">সংরক্ষণ</button>
        <button class="btn btn-outline" onclick="closeChapterEditor()">বাতিল</button>
        <input type="hidden" id="ch-edit-id">
      </div>
    </div>
  </div>

  <!-- Question Manager Modal -->
  <div id="question-manager-modal" class="modal-overlay hidden">
    <div class="modal-content" style="max-width:600px;">
      <button class="btn btn-sm btn-outline" style="float:right;" onclick="closeQuestionManager()">✕</button>
      <h3 id="qm-title">কুইজ প্রশ্ন</h3>
      <input type="hidden" id="qm-chapter-id">
      <button class="btn btn-sm" onclick="openQuestionForm()">+ প্রশ্ন</button>
      <div id="qm-questions-list" style="margin-top:16px;"></div>
      <div id="qm-question-form" class="hidden card" style="margin-top:16px;">
        <input type="text" id="qm-question-text" placeholder="প্রশ্ন">
        <div class="grid-2">
          <input type="text" id="qm-opt0" placeholder="বিকল্প ১">
          <input type="text" id="qm-opt1" placeholder="বিকল্প ২">
          <input type="text" id="qm-opt2" placeholder="বিকল্প ৩">
          <input type="text" id="qm-opt3" placeholder="বিকল্প ৪">
        </div>
        <div class="flex">
          <label>সঠিক উত্তর (0-3):</label>
          <input type="number" id="qm-correct" min="0" max="3" style="width:80px;">
        </div>
        <input type="text" id="qm-explanation" placeholder="ব্যাখ্যা">
        <button class="btn btn-sm" onclick="saveQuestion()">সংরক্ষণ</button>
        <button class="btn btn-sm btn-outline" onclick="cancelQuestionEdit()">বাতিল</button>
        <input type="hidden" id="qm-edit-qid">
      </div>
    </div>
  </div>

  <script>
    // ==================== CONFIG ====================
    const API = '/api/setup';
    let adminToken = localStorage.getItem('adminToken');
    let quillEditor = null;

    // ==================== UTILS ====================
    function showToast(msg, dur=3000) {
      const existing = document.querySelector('.toast');
      if (existing) existing.remove();
      const t = document.createElement('div');
      t.className = 'toast';
      t.textContent = msg;
      document.body.appendChild(t);
      setTimeout(() => t.remove(), dur);
    }

    function escapeHtml(text) {
      if (!text) return '';
      return String(text).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    }

    async function adminApiCall(method, path, body = null, showError = true) {
      const headers = { 'Content-Type': 'application/json' };
      if (adminToken) headers['Authorization'] = `Bearer ${adminToken}`;
      const opts = { method, headers };
      if (body) opts.body = JSON.stringify(body);
      try {
        const res = await fetch(`${API}${path}`, opts);
        if (res.status === 401) { logout(); return null; }
        const data = await res.json();
        if (data.error && showError) showToast(data.error);
        return data;
      } catch(e) {
        if (showError) showToast('Network error');
        return null;
      }
    }

    function logout() {
      localStorage.removeItem('adminToken');
      adminToken = null;
      document.getElementById('login-screen').classList.remove('hidden');
      document.getElementById('panel-screen').classList.add('hidden');
    }

    // ==================== AUTH ====================
    async function adminLogin() {
      const email = document.getElementById('admin-email').value.trim();
      const password = document.getElementById('admin-password').value;
      if (!email || !password) {
        document.getElementById('login-error').textContent = 'ইমেইল ও পাসওয়ার্ড প্রয়োজন';
        document.getElementById('login-error').style.display = 'block';
        return;
      }
      const res = await fetch(`${API}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.token) {
        adminToken = data.token;
        localStorage.setItem('adminToken', adminToken);
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('panel-screen').classList.remove('hidden');
        switchTab('stats');
        if (data.require_password_change) showToast('পাসওয়ার্ড পরিবর্তন করুন!');
      } else {
        document.getElementById('login-error').textContent = data.error || 'Login failed';
        document.getElementById('login-error').style.display = 'block';
      }
    }

    // ==================== TAB NAVIGATION ====================
    function switchTab(tab) {
      document.querySelectorAll('.admin-sidebar nav a').forEach(a => a.classList.remove('active'));
      const activeLink = document.querySelector(`.admin-sidebar nav a[data-tab="${tab}"]`);
      if (activeLink) activeLink.classList.add('active');
      const panel = document.getElementById('panel-screen');
      switch(tab) {
        case 'stats': loadStats(); break;
        case 'users': loadUsers(); break;
        case 'simulate': panel.innerHTML = `
          <div class="card"><h3>🧪 সিমুলেট ইউজার</h3>
            <input type="text" id="sim-email" placeholder="ইউজার ইমেইল">
            <input type="number" id="sim-days" placeholder="দিন (1-30)" value="7">
            <input type="number" id="sim-start" placeholder="শুরু দিন" value="1">
            <button class="btn" onclick="simulateUser()">সিমুলেট</button>
          </div>`; break;
        case 'chapters': loadChapters(); break;
        case 'courses': loadCourses(); break;
        case 'content': loadContentManager(); break;
        case 'theme': loadThemeEditor(); break;
        case 'media': loadMediaLibrary(); break;
        case 'translations': loadTranslations(); break;
        case 'activity': loadActivity(); break;
        case 'settings': loadSettings(); break;
      }
    }

    // ==================== STATS ====================
    async function loadStats() {
      const data = await adminApiCall('GET', '/admin/dashboard');
      if (!data) return;
      document.getElementById('panel-screen').innerHTML = `
        <div class="stats">
          <div class="stat"><h3>${data.totalUsers}</h3><p>মোট ইউজার</p></div>
          <div class="stat"><h3>${data.dailyActiveUsers}</h3><p>আজ সক্রিয়</p></div>
          <div class="stat"><h3>${data.totalJournals}</h3><p>মোট জার্নাল</p></div>
          <div class="stat"><h3>${data.completionRate}%</h3><p>ট্রেনিং সম্পন্ন</p></div>
        </div>
        <div class="card"><p>মোট চ্যাপ্টার: <strong>${data.totalChapters}</strong> | সার্টিফাইড: <strong>${data.completedTrainings}</strong></p></div>
      `;
    }

    // ==================== USERS ====================
    async function loadUsers() {
      const res = await adminApiCall('GET', '/admin/users');
      let html = `<div class="card"><h3>👥 ইউজার</h3><input type="text" id="user-search" placeholder="ইমেইল বা নাম দিয়ে সার্চ..." oninput="searchUsers()" style="margin-bottom:12px;"><table><thead><tr><th>ইমেইল</th><th>নাম</th><th>XP</th><th>লেভেল</th><th>অ্যাকশন</th></tr></thead><tbody id="users-tbody">`;
      if (res) {
        res.forEach(u => {
          html += `<tr><td>${escapeHtml(u.email)}</td><td>${escapeHtml(u.display_name||'')}</td><td>${u.xp}</td><td>${u.level}</td>
            <td>
              <button class="btn btn-sm btn-outline" onclick="resetUserPassword('${u.id}')">🔑</button>
              <button class="btn btn-sm btn-outline" onclick="impersonateUser('${u.id}')">👤 Login</button>
              <button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}')">🗑</button>
            </td></tr>`;
        });
      }
      html += '</tbody></table></div>';
      document.getElementById('panel-screen').innerHTML = html;
    }

    async function searchUsers() {
      const q = document.getElementById('user-search').value;
      const res = await adminApiCall('GET', `/admin/users?search=${encodeURIComponent(q)}`);
      const tbody = document.getElementById('users-tbody');
      if (!res) return;
      tbody.innerHTML = res.map(u => `
        <tr><td>${escapeHtml(u.email)}</td><td>${escapeHtml(u.display_name||'')}</td><td>${u.xp}</td><td>${u.level}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="resetUserPassword('${u.id}')">🔑</button>
            <button class="btn btn-sm btn-outline" onclick="impersonateUser('${u.id}')">👤 Login</button>
            <button class="btn btn-sm btn-danger" onclick="deleteUser('${u.id}')">🗑</button>
          </td></tr>
      `).join('');
    }

    function resetUserPassword(userId) {
      const p = prompt('নতুন পাসওয়ার্ড (৬+ অক্ষর)');
      if (p && p.length >= 6) {
        adminApiCall('POST', '/admin/reset-password', { user_id: userId, new_password: p });
        showToast('✅ পাসওয়ার্ড রিসেট হয়েছে');
      }
    }

    async function impersonateUser(userId) {
      if (!confirm('এই ইউজার হিসেবে লগইন করবেন?')) return;
      const res = await adminApiCall('POST', '/admin/impersonate', { user_id: userId });
      if (res?.token) {
        localStorage.setItem('token', res.token);
        window.open('/', '_blank');
      } else showToast('ইম্পারসোনেট ব্যর্থ');
    }

    async function deleteUser(userId) {
      if (!confirm('এই ইউজার সম্পূর্ণ মুছে ফেলবেন?')) return;
      await adminApiCall('DELETE', `/admin/user/${userId}`);
      loadUsers();
      showToast('✅ ইউজার ডিলিট হয়েছে');
    }

    // ==================== SIMULATE ====================
    async function simulateUser() {
      const email = document.getElementById('sim-email').value.trim();
      const days = document.getElementById('sim-days').value;
      const start = document.getElementById('sim-start').value;
      if (!email) return showToast('ইউজার ইমেইল দিন');
      const res = await adminApiCall('POST', '/admin/simulate-day', { email, days: parseInt(days), start_day: parseInt(start) });
      if (res?.success) showToast(`✅ ${res.inserted_days} দিন সিমুলেট হয়েছে`);
      else showToast(res?.error || 'ব্যর্থ');
    }

    // ==================== CHAPTERS ====================
    async function loadChapters() {
      const chapters = await adminApiCall('GET', '/admin/chapters?course_id=1');
      if (!chapters) return;
      let html = `<div class="card"><h3>📚 চ্যাপ্টার</h3><button class="btn" onclick="openChapterEditor(null)">+ নতুন চ্যাপ্টার</button><table><thead><tr><th>#</th><th>শিরোনাম</th><th>প্রশ্ন</th><th>পাস</th><th>অ্যাকশন</th></tr></thead><tbody>`;
      chapters.forEach(c => {
        html += `<tr><td>${c.order_index}</td><td>${escapeHtml(c.title)}</td><td>${c.question_count}</td><td>${c.passed_count}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="openChapterEditor(${c.id})">✏️</button>
            <button class="btn btn-sm btn-outline" onclick="manageQuestions(${c.id}, '${escapeHtml(c.title)}')">📝 প্রশ্ন</button>
            <button class="btn btn-sm btn-danger" onclick="deleteChapter(${c.id})">🗑</button>
          </td></tr>`;
      });
      html += '</tbody></table></div>';
      document.getElementById('panel-screen').innerHTML = html;
    }

    async function openChapterEditor(id) {
      document.getElementById('chapter-editor-modal').classList.remove('hidden');
      if (!quillEditor) {
        quillEditor = new Quill('#chapter-quill-editor', { theme: 'snow' });
      }
      if (id) {
        const chapters = await adminApiCall('GET', '/admin/chapters?course_id=1');
        const ch = chapters.find(c => c.id == id);
        if (ch) {
          document.getElementById('ch-title').value = ch.title;
          document.getElementById('ch-order').value = ch.order_index;
          document.getElementById('ch-passing').value = ch.passing_score || 90;
          document.getElementById('ch-language').value = ch.language || 'bn';
          document.getElementById('ch-images').value = (ch.images || []).join(',');
          document.getElementById('ch-videos').value = (ch.videos || []).join(',');
          quillEditor.root.innerHTML = ch.content_text || '';
          document.getElementById('ch-edit-id').value = ch.id;
          document.getElementById('chapter-editor-title').textContent = 'চ্যাপ্টার সম্পাদনা';
        }
      } else {
        document.getElementById('ch-title').value = '';
        document.getElementById('ch-order').value = '';
        document.getElementById('ch-passing').value = 90;
        document.getElementById('ch-language').value = 'bn';
        document.getElementById('ch-images').value = '';
        document.getElementById('ch-videos').value = '';
        quillEditor.root.innerHTML = '';
        document.getElementById('ch-edit-id').value = '';
        document.getElementById('chapter-editor-title').textContent = 'নতুন চ্যাপ্টার';
      }
    }

    function closeChapterEditor() {
      document.getElementById('chapter-editor-modal').classList.add('hidden');
    }

    async function saveChapter() {
      const data = {
        course_id: 1,
        title: document.getElementById('ch-title').value,
        order_index: parseInt(document.getElementById('ch-order').value),
        content_text: quillEditor.root.innerHTML,
        images: document.getElementById('ch-images').value.split(',').map(s=>s.trim()).filter(s=>s),
        videos: document.getElementById('ch-videos').value.split(',').map(s=>s.trim()).filter(s=>s),
        passing_score: parseInt(document.getElementById('ch-passing').value),
        language: document.getElementById('ch-language').value
      };
      if (!data.title || !data.order_index) return showToast('শিরোনাম ও ক্রম আবশ্যক');
      const id = document.getElementById('ch-edit-id').value;
      if (id) {
        await adminApiCall('PUT', `/admin/chapter/${id}`, data);
      } else {
        await adminApiCall('POST', '/admin/chapter', data);
      }
      closeChapterEditor();
      loadChapters();
      showToast('✅ চ্যাপ্টার সংরক্ষিত');
    }

    async function deleteChapter(id) {
      if (!confirm('সত্যিই মুছে ফেলবেন?')) return;
      await adminApiCall('DELETE', `/admin/chapter/${id}`);
      loadChapters();
    }

    // Question Manager
    let currentQmChapterId;
    async function manageQuestions(chapterId, title) {
      currentQmChapterId = chapterId;
      document.getElementById('qm-title').textContent = title + ' - প্রশ্ন';
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
      if (!questions) return;
      list.innerHTML = questions.map(q => `
        <div class="card" style="padding:12px; margin:6px 0;">
          <strong>${escapeHtml(q.question)}</strong><br>
          <small>${q.options.map((o,i)=>`${i===q.correct_index?'✓':'○'} ${escapeHtml(o)}`).join(' | ')}</small>
          ${q.explanation ? `<br><small style="color:var(--accent-bright);">${escapeHtml(q.explanation)}</small>` : ''}
          <div style="margin-top:8px;">
            <button class="btn btn-sm btn-outline" onclick="editQuestion(${q.id}, ${chapterId})">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteQuestion(${q.id}, ${chapterId})">🗑</button>
          </div>
        </div>
      `).join('');
    }

    function openQuestionForm() {
      document.getElementById('qm-question-form').classList.remove('hidden');
      document.getElementById('qm-edit-qid').value = '';
      document.getElementById('qm-question-text').value = '';
      for(let i=0;i<4;i++) document.getElementById(`qm-opt${i}`).value = '';
      document.getElementById('qm-correct').value = 0;
      document.getElementById('qm-explanation').value = '';
    }

    function cancelQuestionEdit() {
      document.getElementById('qm-question-form').classList.add('hidden');
    }

    async function editQuestion(qId, chapterId) {
      const questions = await adminApiCall('GET', `/admin/chapter/${chapterId}/questions`);
      const q = questions.find(q => q.id == qId);
      if (!q) return;
      document.getElementById('qm-edit-qid').value = q.id;
      document.getElementById('qm-question-text').value = q.question;
      q.options.forEach((opt,i) => document.getElementById(`qm-opt${i}`).value = opt);
      document.getElementById('qm-correct').value = q.correct_index;
      document.getElementById('qm-explanation').value = q.explanation || '';
      document.getElementById('qm-question-form').classList.remove('hidden');
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
      if (!data.question || data.options.some(o=>!o) || isNaN(data.correct_index)) return showToast('সব ফিল্ড পূরণ করুন');
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

    // ==================== COURSES ====================
    async function loadCourses() {
      const courses = await adminApiCall('GET', '/admin/courses');
      if (!courses) return;
      let html = `<div class="card"><h3>📘 কোর্স</h3><button class="btn" onclick="openCourseForm()">+ নতুন কোর্স</button>
        <div id="course-form" class="card hidden" style="margin-top:16px;">
          <input type="text" id="course-title" placeholder="শিরোনাম">
          <textarea id="course-desc" placeholder="বিবরণ"></textarea>
          <button class="btn" onclick="saveCourse()">সংরক্ষণ</button>
          <button class="btn btn-outline" onclick="cancelCourseForm()">বাতিল</button>
          <input type="hidden" id="course-edit-id">
        </div>
        <table><thead><tr><th>ID</th><th>শিরোনাম</th><th>বিবরণ</th><th>অ্যাকশন</th></tr></thead><tbody>`;
      courses.forEach(c => {
        html += `<tr><td>${c.id}</td><td>${escapeHtml(c.title)}</td><td>${escapeHtml(c.description||'')}</td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="editCourse(${c.id}, '${escapeHtml(c.title)}', '${escapeHtml(c.description||'')}')">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteCourse(${c.id})">🗑</button>
          </td></tr>`;
      });
      html += '</tbody></table></div>';
      document.getElementById('panel-screen').innerHTML = html;
    }

    function openCourseForm() {
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
    }

    // ==================== CONTENT (Lessons/Quizzes/Videos) ====================
    async function loadContentManager() {
      document.getElementById('panel-screen').innerHTML = `
        <div class="card">
          <h3>📝 কন্টেন্ট ম্যানেজার</h3>
          <select id="content-type-select" onchange="setupContentForm()">
            <option value="lesson">লেসন</option>
            <option value="quiz">কুইজ</option>
            <option value="video">ভিডিও</option>
          </select>
          <div id="content-form-fields" style="margin-top:12px;"></div>
          <button class="btn" onclick="addContent()">যোগ করুন</button>
          <h4 style="margin-top:20px;">বর্তমান কন্টেন্ট</h4>
          <select id="content-list-type" onchange="loadContentList()">
            <option value="lesson">লেসন</option>
            <option value="quiz">কুইজ</option>
            <option value="video">ভিডিও</option>
          </select>
          <div id="content-list-section" style="margin-top:12px;"></div>
          <h4 style="margin-top:20px;">ইমেজ আপলোড (Vercel Blob)</h4>
          <input type="file" id="image-upload" accept="image/*" style="margin-top:6px;">
          <button class="btn btn-sm" onclick="uploadImage()">আপলোড</button>
          <div id="upload-status" style="margin-top:6px;"></div>
        </div>
      `;
      setupContentForm();
      loadContentList();
    }

    function setupContentForm() {
      const type = document.getElementById('content-type-select').value;
      const fields = document.getElementById('content-form-fields');
      if (type==='lesson') fields.innerHTML = `<input id="content-day" type="number" placeholder="Day"><input id="content-phase" placeholder="Phase"><input id="content-title" placeholder="Title"><textarea id="content-body" placeholder="Content"></textarea>`;
      else if (type==='quiz') fields.innerHTML = `<input id="content-question" placeholder="Question"><input id="content-options" placeholder='Options (JSON) e.g. ["A","B","C","D"]'><input id="content-correct" type="number" placeholder="Correct index">`;
      else if (type==='video') fields.innerHTML = `<input id="content-vtitle" placeholder="Title"><textarea id="content-vdesc" placeholder="Description"></textarea><input id="content-ytid" placeholder="YouTube ID"><input id="content-duration" placeholder="Duration"><input id="content-category" placeholder="Category">`;
    }

    async function addContent() {
      const type = document.getElementById('content-type-select').value;
      let body = { type };
      if (type==='lesson') {
        body.day = parseInt(document.getElementById('content-day').value);
        body.phase = document.getElementById('content-phase').value;
        body.title = document.getElementById('content-title').value;
        body.content = document.getElementById('content-body').value;
      } else if (type==='quiz') {
        body.question = document.getElementById('content-question').value;
        body.options = JSON.parse(document.getElementById('content-options').value);
        body.correct = parseInt(document.getElementById('content-correct').value);
      } else if (type==='video') {
        body.category = document.getElementById('content-category').value;
        body.title = document.getElementById('content-vtitle').value;
        body.description = document.getElementById('content-vdesc').value;
        body.youtube_id = document.getElementById('content-ytid').value;
        body.duration = document.getElementById('content-duration').value;
      }
      const res = await adminApiCall('POST', '/admin/content', body);
      if (res?.success) { showToast('✅ কন্টেন্ট যোগ হয়েছে'); loadContentList(); }
    }

    async function loadContentList() {
      const type = document.getElementById('content-list-type').value;
      const res = await adminApiCall('GET', `/admin/content/list?type=${type}`);
      const container = document.getElementById('content-list-section');
      if (!res || res.error) { container.innerHTML = '<p>লোড করতে সমস্যা</p>'; return; }
      if (type === 'lesson') {
        container.innerHTML = res.map(l => `<div class="flex" style="justify-content:space-between; padding:4px 0;">${l.day}. ${escapeHtml(l.title)} <span><button class="btn btn-sm btn-outline" onclick="editContentPrompt('lesson',${l.id})">✏️</button> <button class="btn btn-sm btn-danger" onclick="deleteContent('lesson',${l.id})">🗑</button></span></div>`).join('');
      } else if (type === 'quiz') {
        container.innerHTML = res.map(q => `<div class="flex" style="justify-content:space-between; padding:4px 0;">${escapeHtml(q.question)} <span><button class="btn btn-sm btn-outline" onclick="editContentPrompt('quiz',${q.id})">✏️</button> <button class="btn btn-sm btn-danger" onclick="deleteContent('quiz',${q.id})">🗑</button></span></div>`).join('');
      } else if (type === 'video') {
        container.innerHTML = res.map(v => `<div class="flex" style="justify-content:space-between; padding:4px 0;">${escapeHtml(v.title)} <span><button class="btn btn-sm btn-outline" onclick="editContentPrompt('video',${v.id})">✏️</button> <button class="btn btn-sm btn-danger" onclick="deleteContent('video',${v.id})">🗑</button></span></div>`).join('');
      }
    }

    function editContentPrompt(type, id) {
      if (type === 'lesson') {
        const day = prompt('দিন');
        if (day) adminApiCall('PUT', `/admin/content/lesson/${id}`, { day: parseInt(day), phase: prompt('ফেজ'), title: prompt('শিরোনাম'), content: prompt('কন্টেন্ট') });
      } else if (type === 'quiz') {
        const question = prompt('প্রশ্ন');
        if (question) adminApiCall('PUT', `/admin/content/quiz/${id}`, { question, options: JSON.parse(prompt('অপশন JSON')), correct: parseInt(prompt('সঠিক ইনডেক্স')) });
      } else if (type === 'video') {
        const title = prompt('শিরোনাম');
        if (title) adminApiCall('PUT', `/admin/content/video/${id}`, { category: prompt('ক্যাটাগরি'), title, description: prompt('বিবরণ'), youtube_id: prompt('YT ID'), duration: prompt('সময়') });
      }
      loadContentList();
    }

    async function deleteContent(type, id) {
      if (!confirm('মুছে ফেলবেন?')) return;
      await adminApiCall('DELETE', `/admin/content/${type}/${id}`);
      loadContentList();
    }

    // Image upload with resize
    async function uploadImage() {
      const file = document.getElementById('image-upload').files[0];
      if (!file) return;
      document.getElementById('upload-status').innerHTML = 'ছবি সংকোচন করা হচ্ছে...';
      try {
        const resizedFile = await resizeImage(file, 1200);
        document.getElementById('upload-status').innerHTML = 'আপলোড হচ্ছে...';
        const formData = new FormData();
        formData.append('image', resizedFile);
        const res = await fetch(`${API}/admin/upload-image`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${adminToken}` },
          body: formData
        });
        const data = await res.json();
        if (data.url) {
          document.getElementById('upload-status').innerHTML = `✅ সফল! URL: ${data.url}`;
          navigator.clipboard.writeText(data.url);
          showToast('ইমেজ আপলোড সফল, URL কপি হয়েছে');
          loadMediaLibrary(); // refresh media if visible
        } else {
          document.getElementById('upload-status').innerHTML = 'আপলোড ব্যর্থ';
        }
      } catch(e) {
        document.getElementById('upload-status').innerHTML = 'ত্রুটি';
      }
    }

    async function resizeImage(file, maxWidth) {
      const img = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const ratio = maxWidth / img.width;
      canvas.width = maxWidth;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.8));
      return new File([blob], file.name, { type: 'image/jpeg' });
    }

    // ==================== THEME EDITOR ====================
    async function loadThemeEditor() {
      const vars = ['--bg','--surface','--gold','--gold-bright','--gold-light','--accent','--accent-bright','--accent2','--purple','--cyan','--orange','--text','--text-secondary','--danger','--success','--warning','--border-gold','--border-accent'];
      let html = `<div class="card"><h3>🎨 থিম কাস্টমাইজেশন</h3><div class="theme-grid" id="theme-grid">`;
      vars.forEach(v => {
        const current = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
        html += `<div class="color-picker-group">
          <label style="flex:1; font-size:0.8rem;">${v}</label>
          <input type="color" value="${current}" data-var="${v}" onchange="updateThemeInput(this)">
          <input type="text" value="${current}" data-var="${v}" onchange="updateThemeColor(this)" style="width:80px;">
        </div>`;
      });
      html += `</div><button class="btn" onclick="saveTheme()">সংরক্ষণ</button> <button class="btn btn-outline" onclick="resetTheme()">↺ ডিফল্ট</button><div id="theme-msg" style="margin-top:8px;"></div></div>`;
      document.getElementById('panel-screen').innerHTML = html;
    }

    function updateThemeInput(colorInput) {
      const textInput = colorInput.parentElement.querySelector('input[type="text"]');
      textInput.value = colorInput.value;
    }

    function updateThemeColor(textInput) {
      const colorInput = textInput.parentElement.querySelector('input[type="color"]');
      colorInput.value = textInput.value;
    }

    async function saveTheme() {
      const inputs = document.querySelectorAll('#theme-grid input[type="color"]');
      const themeObj = {};
      inputs.forEach(inp => { themeObj[inp.dataset.var] = inp.value; });
      const res = await adminApiCall('PUT', '/admin/settings', themeObj);
      if (res?.success) {
        for (const [k,v] of Object.entries(themeObj)) document.documentElement.style.setProperty(k, v);
        document.getElementById('theme-msg').innerHTML = '<span style="color:var(--success);">থিম সংরক্ষিত</span>';
      }
    }

    function resetTheme() {
      const defaults = {
        '--bg': '#0B1220', '--surface': 'rgba(17,24,39,0.92)', '--gold': '#C8A75B', '--gold-bright': '#E8C97A',
        '--gold-light': '#F6E4B5', '--accent': '#2563EB', '--accent-bright': '#60A5FA', '--accent2': '#7C3AED',
        '--purple': '#8B5CF6', '--cyan': '#22D3EE', '--orange': '#F59E0B', '--text': '#F9FAFB',
        '--text-secondary': '#9CA3AF', '--danger': '#EF4444', '--success': '#22C55E', '--warning': '#F59E0B',
        '--border-gold': 'rgba(200,167,91,0.35)', '--border-accent': 'rgba(37,99,235,0.30)'
      };
      for (const [k,v] of Object.entries(defaults)) document.documentElement.style.setProperty(k, v);
      document.querySelectorAll('.color-picker-group').forEach(g => {
        const inp = g.querySelector('input[type="color"]');
        const varName = inp.dataset.var;
        inp.value = defaults[varName] || '';
        g.querySelector('input[type="text"]').value = defaults[varName] || '';
      });
      adminApiCall('PUT', '/admin/settings', defaults);
    }

    // ==================== MEDIA LIBRARY ====================
    async function loadMediaLibrary() {
      const res = await adminApiCall('GET', '/admin/media');
      let html = `<div class="card"><h3>🖼️ মিডিয়া লাইব্রেরি (Vercel Blob)</h3>
        <div class="flex" style="margin-bottom:12px;">
          <input type="text" id="media-url-input" placeholder="https://..." style="flex:1;">
          <button class="btn btn-sm" onclick="addMediaUrl()">URL যোগ</button>
        </div>
        <div id="media-list" style="display:flex; flex-wrap:wrap; gap:10px;">`;
      if (res) {
        res.forEach(m => {
          html += `<div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:8px; display:flex; align-items:center;">
            <img src="${m.url}" class="media-thumb" onerror="this.style.display='none'">
            <span style="flex:1; word-break:break-all; font-size:0.8rem;">${m.url}</span>
            <button class="btn btn-sm btn-danger" onclick="deleteMedia(${m.id})">🗑</button>
          </div>`;
        });
      }
      html += '</div></div>';
      document.getElementById('panel-screen').innerHTML = html;
    }

    async function addMediaUrl() {
      const url = document.getElementById('media-url-input').value.trim();
      if (!url) return showToast('URL দিন');
      await adminApiCall('POST', '/admin/media/url', { url });
      loadMediaLibrary();
      showToast('✅ ইউআরএল যোগ হয়েছে');
    }

    async function deleteMedia(id) {
      await adminApiCall('DELETE', `/admin/media/${id}`);
      loadMediaLibrary();
    }

    // ==================== TRANSLATIONS ====================
    async function loadTranslations() {
      const lang = prompt('ভাষা কোড (bn/en):', 'bn') || 'bn';
      const rows = await adminApiCall('GET', `/admin/translations?lang=${lang}`);
      let html = `<div class="card"><h3>🌐 অনুবাদ (${lang})</h3><select id="trans-lang" onchange="loadTranslations()"><option>bn</option><option>en</option></select><div id="trans-list" style="margin-top:12px;">`;
      if (rows) {
        rows.forEach(t => {
          html += `<div class="flex" style="justify-content:space-between; padding:6px; background:rgba(255,255,255,0.05); margin:4px 0; border-radius:6px;"><span><strong>${escapeHtml(t.key)}</strong>: ${escapeHtml(t.value)}</span>
            <button class="btn btn-sm btn-outline" onclick="editTrans('${t.key}','${lang}','${escapeHtml(t.value)}')">✏️</button></div>`;
        });
      }
      html += `<button class="btn btn-sm" onclick="addTrans()">+ নতুন</button></div></div>`;
      document.getElementById('panel-screen').innerHTML = html;
    }

    function addTrans() {
      const key = prompt('Key:');
      if (!key) return;
      const value = prompt('Value:');
      const lang = document.getElementById('trans-lang')?.value || 'bn';
      if (value) {
        adminApiCall('POST', '/admin/translations', { key, lang, value });
        loadTranslations();
      }
    }

    function editTrans(key, lang, current) {
      const newVal = prompt('নতুন মান:', current);
      if (newVal !== null) {
        adminApiCall('POST', '/admin/translations', { key, lang, value: newVal });
        loadTranslations();
      }
    }

    // ==================== ACTIVITY ====================
    async function loadActivity() {
      const logs = await adminApiCall('GET', '/admin/activity-log');
      let html = '<div class="card"><h3>📋 অ্যাক্টিভিটি লগ</h3><table><tr><th>সময়</th><th>অ্যাডমিন</th><th>কাজ</th><th>বিস্তারিত</th></tr>';
      if (logs) {
        logs.forEach(l => {
          html += `<tr><td>${new Date(l.created_at).toLocaleString()}</td><td>${l.admin_name || l.admin_email}</td><td>${l.action}</td><td>${JSON.stringify(l.details).substr(0,60)}</td></tr>`;
        });
      }
      html += '</table></div>';
      document.getElementById('panel-screen').innerHTML = html;
    }

    // ==================== SETTINGS ====================
    function loadSettings() {
      document.getElementById('panel-screen').innerHTML = `
        <div class="card"><h3>⚙️ অ্যাডমিন সেটিংস</h3>
          <input type="password" id="current-password" placeholder="বর্তমান পাসওয়ার্ড">
          <input type="password" id="new-password" placeholder="নতুন পাসওয়ার্ড">
          <input type="password" id="confirm-password" placeholder="নতুন পাসওয়ার্ড আবার">
          <button class="btn" onclick="changeAdminPassword()">পাসওয়ার্ড পরিবর্তন</button>
          <div id="settings-message" style="margin-top:12px;"></div>
        </div>
      `;
    }

    async function changeAdminPassword() {
      const current = document.getElementById('current-password').value;
      const newPass = document.getElementById('new-password').value;
      const confirm = document.getElementById('confirm-password').value;
      if (newPass !== confirm) return showToast('পাসওয়ার্ড মিলছে না');
      if (newPass.length < 6) return showToast('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর');
      const res = await adminApiCall('PUT', '/admin/change-password', { current_password: current, new_password: newPass });
      if (res?.success) {
        showToast('✅ পাসওয়ার্ড পরিবর্তিত');
        document.getElementById('settings-message').innerHTML = '<span style="color:var(--success);">সফল</span>';
      } else {
        document.getElementById('settings-message').innerHTML = `<span style="color:var(--danger);">${res?.error || 'ত্রুটি'}</span>`;
      }
    }

    // ==================== INIT ====================
    if (adminToken) {
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('panel-screen').classList.remove('hidden');
      switchTab('stats');
    }
  </script>
</body>
</html>
'@
[System.IO.File]::WriteAllText("$projectRoot\admin.html", $adminHtmlPlaceholder, $Utf8NoBom)
Write-Host "Created admin.html (placeholder - admin panel is integrated in index.html)" -ForegroundColor Yellow

# ============================================
# 11. index.html (PLACEHOLDER - Replace with the final enterprise index.html)
# ============================================
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
Write-Host "Created placeholder index.html (REPLACE with final enterprise version)" -ForegroundColor Yellow

# ============================================
# 12. api/setup.js (PLACEHOLDER - Replace with the final enterprise api/setup.js)
# ============================================
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
Write-Host "Created placeholder api/setup.js (REPLACE with final enterprise version)" -ForegroundColor Yellow

# ============================================
# Final message
# ============================================
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  All project files generated successfully! (Enterprise-Ready)" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Yellow
Write-Host "1. Replace placeholder 'index.html' with the final enterprise index.html." -ForegroundColor Yellow
Write-Host "2. Replace placeholder 'api/setup.js' with the final enterprise api/setup.js." -ForegroundColor Yellow
Write-Host "3. Set environment variables in Vercel (DATABASE_URL, JWT_SECRET, etc.)." -ForegroundColor Yellow
Write-Host "4. Place icon-192.png and icon-512.png in the project root (for PWA)." -ForegroundColor Yellow
Write-Host "5. Run 'npm install' then 'npm start' for local development." -ForegroundColor Yellow
Write-Host "6. For production, deploy to Vercel. Set ALLOW_INIT_DB=true, then run init-db." -ForegroundColor Yellow
Write-Host "7. Default admin login: admin@alamquant.com (temp password from logs, change immediately)." -ForegroundColor Yellow
Write-Host ""