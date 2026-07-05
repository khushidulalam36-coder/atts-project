# ============================================
# AlamQuant ATTS - Production-Ready File Generator
# ============================================
# This script creates all necessary project files:
# - admin.html (complete admin dashboard)
# - verify.html (public certificate verification)
# - vercel.json (routing & cron)
# - package.json (dependencies)
# - server.js (local development server)
# - .env.local (placeholder – fill with your credentials)
# - .gitignore
# - styles.css (global styles)
# - sw.js (service worker)
# - manifest.json (PWA manifest)
# - index.html (placeholder – replace with final version)
# - api/setup.js (placeholder – replace with final version)
# ============================================

$projectRoot = Get-Location
Write-Host "Project root: $projectRoot" -ForegroundColor Cyan

# Create required folders
New-Item -ItemType Directory -Force -Path "$projectRoot\api" | Out-Null

# ============================================
# 1. admin.html (Complete Admin Dashboard)
# ============================================
$adminHtml = @'
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AlamQuant ATTS – Admin Panel</title>
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
      background: rgba(197,155,59,0.15);
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
      <h2 style="color:var(--gold-bright);">🔐 অ্যাডমিন লগইন</h2>
      <input type="email" id="admin-email" placeholder="অ্যাডমিন ইমেইল">
      <input type="password" id="admin-password" placeholder="পাসওয়ার্ড">
      <button class="btn btn-lg" onclick="adminLogin()" style="width:100%; margin-top:16px;">প্রবেশ করুন</button>
      <p id="login-error" style="color:var(--danger); margin-top:12px; display:none;"></p>
    </div>
  </div>

  <div id="admin-dashboard" class="admin-layout" style="display:none;">
    <nav class="admin-sidebar">
      <div class="logo">⚙️ ATTS Admin</div>
      <ul>
        <li class="active" data-section="dashboard" onclick="showSection('dashboard')">📊 ড্যাশবোর্ড</li>
        <li data-section="chapters" onclick="showSection('chapters')">📚 চ্যাপ্টার</li>
        <li data-section="quiz" onclick="showSection('quiz')">❓ কুইজ</li>
        <li data-section="users" onclick="showSection('users')">👥 ইউজার</li>
        <li data-section="certificates" onclick="showSection('certificates')">🏆 সার্টিফিকেট</li>
        <li data-section="settings" onclick="showSection('settings')">⚙️ সেটিংস</li>
      </ul>
      <div style="position:absolute; bottom:20px; left:20px; right:20px;">
        <button class="btn btn-outline btn-sm" onclick="adminLogout()" style="width:100%;">লগআউট</button>
      </div>
    </nav>

    <main class="admin-main">
      <div class="admin-header">
        <h2 id="section-title">📊 ড্যাশবোর্ড</h2>
        <span id="admin-name" style="color:var(--gold-light); font-weight:600;"></span>
      </div>
      <div id="content-area"><!-- Dynamic content --></div>
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
        dashboard: "📊 ড্যাশবোর্ড",
        chapters: "📚 চ্যাপ্টার ম্যানেজমেন্ট",
        quiz: "❓ কুইজ ম্যানেজমেন্ট",
        users: "👥 ইউজার ম্যানেজমেন্ট",
        certificates: "🏆 সার্টিফিকেট",
        settings: "⚙️ সেটিংস"
      };
      document.getElementById("section-title").textContent = titles[section] || "";
      switch(section) {
        case "dashboard": loadDashboard(); break;
        case "chapters": loadChapters(); break;
        case "quiz": loadQuizManagement(); break;
        case "users": loadUsers(); break;
        case "certificates": loadCertificates(); break;
        case "settings": loadSettings(); break;
      }
    }

    async function loadDashboard() {
      const data = await adminApi("GET", "/admin/dashboard");
      if (!data) return;
      document.getElementById("content-area").innerHTML = `
        <div class="grid-4">
          <div class="stat-card glass"><div class="stat-value">${data.totalUsers}</div><div class="stat-label">মোট ইউজার</div></div>
          <div class="stat-card glass"><div class="stat-value">${data.dailyActiveUsers}</div><div class="stat-label">আজ সক্রিয়</div></div>
          <div class="stat-card glass"><div class="stat-value">${data.totalJournals}</div><div class="stat-label">মোট জার্নাল</div></div>
          <div class="stat-card glass"><div class="stat-value">${data.completionRate}%</div><div class="stat-label">ট্রেনিং সম্পন্ন</div></div>
        </div>
        <div class="glass" style="margin-top:24px;"><h3>📈 দ্রুত পরিসংখ্যান</h3><p>মোট চ্যাপ্টার: <strong>${data.totalChapters}</strong></p><p>সার্টিফিকেটপ্রাপ্ত: <strong>${data.completedTrainings}</strong></p></div>`;
    }

    // ----- Chapters CRUD -----
    async function loadChapters() {
      const chapters = await adminApi("GET", "/admin/chapters");
      if (!chapters) return;
      let html = `<button class="btn btn-accent" onclick="showChapterForm()" style="margin-bottom:20px;">+ নতুন চ্যাপ্টার</button>
        <div id="chapter-form" class="chapter-editor hidden">
          <h4 id="chapter-form-title">নতুন চ্যাপ্টার</h4>
          <div class="grid-2"><input type="text" id="ch-title" placeholder="শিরোনাম"><input type="number" id="ch-order" placeholder="ক্রম" min="1"></div>
          <textarea id="ch-content" rows="6" placeholder="HTML কনটেন্ট"></textarea>
          <div class="grid-2"><input type="url" id="ch-image" placeholder="ইমেজ URL"><input type="url" id="ch-video" placeholder="ভিডিও URL"></div>
          <input type="number" id="ch-passing" placeholder="পাসিং স্কোর (%)" value="90" min="0" max="100">
          <div style="margin-top:12px; display:flex; gap:8px;"><button class="btn btn-accent" onclick="saveChapter()">সংরক্ষণ</button><button class="btn btn-outline" onclick="cancelChapterEdit()">বাতিল</button></div>
        </div>
        <div id="chapters-list">`;
      chapters.forEach(ch => {
        html += `<div class="glass" style="margin:12px 0; padding:16px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div><strong>#${ch.order_index} ${ch.title}</strong><div style="font-size:0.85rem; color:var(--text-secondary);">প্রশ্ন: ${ch.question_count} | পাস: ${ch.passed_count} | পাসিং: ${ch.passing_score}%</div></div>
            <div style="display:flex; gap:6px;">
              <button class="btn btn-sm btn-outline" onclick="editChapter(${ch.id})">✏️</button>
              <button class="btn btn-sm btn-outline" onclick="manageQuestions(${ch.id})">📝</button>
              <button class="btn btn-sm btn-danger" onclick="deleteChapter(${ch.id})">🗑</button></div></div></div>`;
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
      if (!data.title || !data.order_index) return showToast("শিরোনাম ও ক্রম আবশ্যক");
      if (editingChapterId) await adminApi("PUT", `/admin/chapter/${editingChapterId}`, data);
      else await adminApi("POST", "/admin/chapter", data);
      cancelChapterEdit();
      loadChapters();
    }

    async function deleteChapter(id) {
      if (!confirm("চ্যাপ্টার মুছে ফেলবেন?")) return;
      await adminApi("DELETE", `/admin/chapter/${id}`);
      loadChapters();
    }

    // ----- Quiz Management -----
    async function manageQuestions(chapterId) {
      const questions = await adminApi("GET", `/admin/chapter/${chapterId}/questions`);
      const chapters = await adminApi("GET", "/admin/chapters");
      const chapter = chapters.find(c => c.id === chapterId);
      let html = `<button class="btn btn-outline" onclick="loadChapters()">← ফিরে যান</button>
        <h3>${chapter?.title || ""} – কুইজ প্রশ্ন</h3>
        <button class="btn btn-accent btn-sm" onclick="showQuestionForm(${chapterId})">+ প্রশ্ন যোগ</button>
        <div id="question-form" class="chapter-editor hidden">
          <h4 id="q-form-title">নতুন প্রশ্ন</h4>
          <input type="hidden" id="q-chapter-id" value="${chapterId}">
          <input type="hidden" id="q-id" value="">
          <textarea id="q-text" rows="2" placeholder="প্রশ্ন"></textarea>
          <div class="grid-2"><input type="text" id="q-opt0" placeholder="অপশন 1"><input type="text" id="q-opt1" placeholder="অপশন 2"><input type="text" id="q-opt2" placeholder="অপশন 3"><input type="text" id="q-opt3" placeholder="অপশন 4"></div>
          <input type="number" id="q-correct" placeholder="সঠিক উত্তর (0-3)" min="0" max="3">
          <input type="text" id="q-explanation" placeholder="ব্যাখ্যা (ঐচ্ছিক)">
          <button class="btn btn-accent btn-sm" onclick="saveQuestion()">সংরক্ষণ</button>
          <button class="btn btn-outline btn-sm" onclick="document.getElementById('question-form').classList.add('hidden')">বাতিল</button>
        </div>
        <div id="questions-list">`;
      questions.forEach(q => {
        html += `<div class="question-item"><p><strong>${q.question}</strong></p>
          <p style="font-size:0.85rem; color:var(--text-secondary);">${q.options.map((opt,i) => `${i===q.correct_index?"✅":"○"} ${opt}`).join(" | ")}</p>
          ${q.explanation ? `<p style="font-size:0.8rem; color:var(--accent-bright);">${q.explanation}</p>` : ""}
          <div style="margin-top:8px;"><button class="btn btn-sm btn-outline" onclick="editQuestion(${q.id}, ${chapterId})">✏️</button><button class="btn btn-sm btn-danger" onclick="deleteQuestion(${q.id}, ${chapterId})">🗑</button></div></div>`;
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
      if (!data.question || data.options.some(o=>!o) || isNaN(data.correct_index)) return showToast("সব ফিল্ড পূরণ করুন");
      if (qId) await adminApi("PUT", `/admin/question/${qId}`, data);
      else await adminApi("POST", `/admin/chapter/${chapterId}/question`, data);
      document.getElementById("question-form").classList.add("hidden");
      manageQuestions(chapterId);
    }

    async function deleteQuestion(qId, chapterId) {
      if (!confirm("প্রশ্ন মুছে ফেলবেন?")) return;
      await adminApi("DELETE", `/admin/question/${qId}`);
      manageQuestions(chapterId);
    }

    // ----- Users -----
    async function loadUsers() {
      const users = await adminApi("GET", "/admin/users?admin_secret=admin123");
      let html = `<input type="text" id="user-search" placeholder="ইমেইল বা নাম সার্চ..." oninput="searchUsers()" style="margin-bottom:16px;"><div id="users-list">`;
      if (users) users.forEach(u => {
        html += `<div class="glass" style="margin:8px 0; padding:12px;"><strong>${u.avatar_emoji||"🙂"} ${u.display_name||u.email}</strong><span class="badge">Lv.${u.level} | ${u.xp} XP</span><span class="badge badge-accent">${u.identity_level}</span></div>`;
      });
      html += "</div>";
      document.getElementById("content-area").innerHTML = html;
    }

    async function searchUsers() {
      const q = document.getElementById("user-search").value;
      const users = await adminApi("GET", `/admin/users?admin_secret=admin123&search=${encodeURIComponent(q)}`);
      const list = document.getElementById("users-list");
      list.innerHTML = users.map(u => `<div class="glass" style="margin:8px 0; padding:12px;"><strong>${u.avatar_emoji||"🙂"} ${u.display_name||u.email}</strong><span class="badge">Lv.${u.level} | ${u.xp} XP</span><span class="badge badge-accent">${u.identity_level}</span></div>`).join("");
    }

    // ----- Certificates -----
    function loadCertificates() {
      document.getElementById("content-area").innerHTML = `
        <div class="glass">
          <h3>🏆 সার্টিফিকেট ভেরিফিকেশন</h3>
          <input type="text" id="verify-code" placeholder="ভেরিফিকেশন কোড">
          <button class="btn btn-accent btn-sm" onclick="verifyCertificate()">যাচাই করুন</button>
          <div id="verify-result" style="margin-top:16px;"></div>
        </div>`;
    }

    async function verifyCertificate() {
      const code = document.getElementById("verify-code").value;
      const res = await fetch(`/api/setup/verify/${code}`).then(r=>r.json());
      document.getElementById("verify-result").innerHTML = res.valid
        ? `<p style="color:var(--success);">✅ বৈধ সার্টিফিকেট | ইউজার: ${res.user}</p>`
        : `<p style="color:var(--danger);">❌ অবৈধ সার্টিফিকেট</p>`;
    }

    // ----- Settings -----
    function loadSettings() {
      document.getElementById("content-area").innerHTML = `
        <div class="glass"><h3>⚙️ সিস্টেম সেটিংস</h3><p>সেটিংস ফিচার শীঘ্রই আসছে।</p></div>`;
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
Write-Host "Created admin.html" -ForegroundColor Green

# ============================================
# 2. verify.html (Public Certificate Verification)
# ============================================
$verifyHtml = @'
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>সার্টিফিকেট ভেরিফিকেশন – AlamQuant ATTS</title>
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
    <h2>🔍 সার্টিফিকেট ভেরিফিকেশন</h2>
    <input type="text" id="verify-input" placeholder="ভেরিফিকেশন কোড লিখুন">
    <button class="btn" onclick="verify()">যাচাই করুন</button>
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
            <h3>বৈধ সার্টিফিকেট</h3>
            <p><strong>নাম:</strong> ${res.display_name || res.user}</p>
            <p><strong>ইস্যুর তারিখ:</strong> ${new Date(res.issued_at).toLocaleDateString('bn-BD')}</p>
            <p><strong>কোড:</strong> ${res.verification_code}</p>
          </div>`;
      } else {
        resultDiv.innerHTML = `
          <div style="color: var(--danger);">
            <p style="font-size:3rem;">❌</p>
            <h3>অবৈধ সার্টিফিকেট</h3>
            <p>এই কোডটি সিস্টেমে পাওয়া যায়নি।</p>
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
# 3. vercel.json (Routing & Cron)
# ============================================
$vercelJson = @'
{
  "functions": {
    "api/setup.js": {
      "runtime": "edge"
    }
  },
  "rewrites": [
    { "source": "/admin", "destination": "/admin.html" },
    { "source": "/api/(.*)", "destination": "/api/setup" }
  ],
  "crons": [
    {
      "path": "/api/setup/cron/streak-freeze-check",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/setup/cron/morning-reminder",
      "schedule": "0 6 * * *"
    }
  ]
}
'@
$vercelJson | Out-File -FilePath "$projectRoot\vercel.json" -Encoding utf8
Write-Host "Created vercel.json" -ForegroundColor Green

# ============================================
# 4. package.json
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
    "openai": "^4.0.0"
  }
}
'@
$packageJson | Out-File -FilePath "$projectRoot\package.json" -Encoding utf8
Write-Host "Created package.json" -ForegroundColor Green

# ============================================
# 5. server.js (Local Development Server)
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
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost:3000');

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
            if (done) res.end();
            else { res.write(value); pump(); }
          });
          pump();
        } else res.end();
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
  console.log('Server running at http://localhost:' + PORT);
});
'@
$serverJs | Out-File -FilePath "$projectRoot\server.js" -Encoding utf8
Write-Host "Created server.js" -ForegroundColor Green

# ============================================
# 6. .env.local (Placeholder)
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
# 7. .gitignore
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
# 8. styles.css (Complete Styles)
# ============================================
$stylesCss = @'
/* AlamQuant ATTS Premium Styles */
:root {
  --bg: #030510;
  --surface: rgba(12, 14, 34, 0.85);
  --gold: #c59b3b;
  --gold-bright: #f2d680;
  --gold-light: #ffe082;
  --accent: #00bcd4;
  --accent-bright: #00e5ff;
  --text: #e8e8f0;
  --text-secondary: #9898b0;
  --danger: #ff5252;
  --success: #69f0ae;
  --warning: #ffd740;
  --purple: #b388ff;
  --orange: #ff9100;
  --border-gold: rgba(197, 155, 59, 0.25);
  --border-accent: rgba(0,229,255,0.3);
  --font-en: 'Inter', sans-serif;
  --radius: 20px;
  --radius-sm: 12px;
  --transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
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
@keyframes gradientShift {
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
  background: linear-gradient(135deg, #0a0b16 0%, #1a0b2e 50%, #0a0b16 100%);
  background-size: 400% 400%;
  animation: gradientShift 15s ease infinite;
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
  background: radial-gradient(circle at top left, rgba(197,155,59,0.1), rgba(12,14,34,0.7));
  backdrop-filter: blur(30px) saturate(120%);
  -webkit-backdrop-filter: blur(30px) saturate(120%);
  border-radius: var(--radius);
  padding: 24px;
  margin-bottom: 18px;
  border: 1px solid var(--border-gold);
  box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03);
  transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
  position: relative;
  overflow: hidden;
}

.glass:hover {
  box-shadow: 0 14px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(197,155,59,0.3);
  transform: translateY(-2px);
  border-color: rgba(197,155,59,0.4);
}

h1,h2,h3,h4 {
  color: var(--gold);
  margin-bottom: 12px;
  text-shadow: 0 0 16px rgba(197,155,59,0.3);
  position:relative; z-index:1; font-weight:700;
}

h2 { font-size:1.6rem; }
h3 { font-size:1.25rem; }

.btn {
  background: linear-gradient(135deg, var(--gold), var(--gold-bright));
  color:#0a0a0a;
  border:none;
  padding:12px 24px;
  border-radius:30px;
  font-weight:700;
  cursor:pointer;
  transition: all var(--transition);
  font-size:0.9rem;
  box-shadow:0 4px 18px rgba(197,155,59,0.4);
  letter-spacing:0.5px;
  position:relative;
  overflow:hidden;
  z-index:1;
  font-family:var(--font-en);
}

.btn:hover { box-shadow:0 6px 24px rgba(197,155,59,0.6); transform:translateY(-1px); }
.btn:active { transform:scale(0.96); }

.btn-outline { background:transparent; border:2px solid var(--gold); color:var(--gold); box-shadow:none; }
.btn-outline:hover { background:rgba(197,155,59,0.1); }

.btn-accent { background:linear-gradient(135deg, var(--accent), var(--accent-bright)); box-shadow:0 4px 18px rgba(0,229,255,0.4); }
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
  box-shadow:0 0 0 3px rgba(197,155,59,0.15), 0 0 20px rgba(197,155,59,0.2);
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
  border: 1px solid rgba(197,155,59,0.3);
  box-shadow: 0 8px 30px rgba(0,0,0,0.8), 0 0 25px rgba(197,155,59,0.15);
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

/* Add all other component-specific styles that were in index.html <style> */
'@
$stylesCss | Out-File -FilePath "$projectRoot\styles.css" -Encoding utf8
Write-Host "Created styles.css" -ForegroundColor Green

# ============================================
# 9. sw.js (Service Worker)
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
# 10. manifest.json (PWA Manifest)
# ============================================
$manifestJson = @'
{
  "name": "AlamQuant ATTS",
  "short_name": "ATTS",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#030510",
  "theme_color": "#c59b3b",
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
# 11. index.html (placeholder)
# ============================================
@"
<!-- AlamQuant ATTS - Placeholder index.html (replace with final version) -->
"@ | Out-File -FilePath "$projectRoot\index.html" -Encoding utf8
Write-Host "Created index.html (placeholder)" -ForegroundColor Yellow

# ============================================
# 12. api/setup.js (placeholder)
# ============================================
$setupJsPlaceholder = @'
// AlamQuant ATTS - Placeholder api/setup.js (replace with final version)
export default async function handler(req) {
  return new Response("API not configured yet", { status: 501 });
}
'@
$setupJsPlaceholder | Out-File -FilePath "$projectRoot\api\setup.js" -Encoding utf8
Write-Host "Created api/setup.js (placeholder)" -ForegroundColor Yellow

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