/**
 * student.js – Student dashboard logic for GPN Submission Portal
 */

let allSubmissions = [];

// ── On page load ─────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", async () => {
  await loadDashboard();
  setupDropzone();
  setupUploadForm();
});

// ── Show / hide sidebar sections ─────────────────────────────
function showSection(name, linkEl) {
  document.querySelectorAll(".dash-section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".sidebar-link").forEach(l => l.classList.remove("active"));
  document.getElementById(`section-${name}`).classList.add("active");
  if (linkEl) linkEl.classList.add("active");

  // Lazy load submissions on first visit
  if (name === "submissions") renderSubmissions();
}

// ── Load dashboard data ───────────────────────────────────────
async function loadDashboard() {
  try {
    const res = await fetch("/student/dashboard");
    if (res.status === 401) { window.location.href = "/"; return; }
    const data = await res.json();

    if (!res.ok) { showGlobalAlert(data.error || "Failed to load data.", "error"); return; }

    // Populate profile
    const { profile, submissions } = data;
    allSubmissions = submissions;

    const initial = profile.name ? profile.name[0].toUpperCase() : "?";
    document.getElementById("navAvatar").textContent    = initial;
    document.getElementById("navName").textContent      = profile.name;
    document.getElementById("profileAvatar").textContent = initial;
    document.getElementById("profileName").textContent   = profile.name;
    document.getElementById("profileEnroll").textContent = profile.enrollment_number;
    document.getElementById("profileBatch").textContent  = `Batch ${profile.batch}`;

    // Stats
    document.getElementById("statTotal").textContent    = submissions.length;
    document.getElementById("statApproved").textContent = submissions.filter(s => s.status === "approved").length;
    document.getElementById("statPending").textContent  = submissions.filter(s => s.status === "pending").length;
    document.getElementById("statRejected").textContent = submissions.filter(s => s.status === "rejected").length;

  } catch (err) {
    showGlobalAlert("Could not connect to server.", "error");
  }
}

// ── Render submissions list ───────────────────────────────────
function renderSubmissions() {
  const container = document.getElementById("submissionsContainer");

  if (!allSubmissions || allSubmissions.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📭</span>
        <p>No submissions yet. Upload your first file!</p>
      </div>`;
    return;
  }

  const items = allSubmissions.map(s => `
    <div class="submission-card">
      <div class="sub-info">
        <div class="sub-title">${escHtml(s.title)}</div>
        <div class="sub-meta">
          ${escHtml(s.subject_code)} &nbsp;·&nbsp; Batch ${escHtml(s.batch)}
          &nbsp;·&nbsp; ${formatDate(s.submitted_at)}
        </div>
      </div>
      <div class="sub-right">
        <a class="file-link" href="${escHtml(s.file_url)}" target="_blank" rel="noopener">📄 View File</a>
        <span class="badge ${s.status}">${s.status}</span>
      </div>
    </div>
  `).join("");

  container.innerHTML = `<div class="submission-list">${items}</div>`;
}

// ── Upload form logic ─────────────────────────────────────────
function setupUploadForm() {
  document.getElementById("uploadForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert("uploadAlert");

    const type    = document.getElementById("submissionType").value;
    const subject = document.getElementById("subjectCode").value.trim();
    const title   = document.getElementById("submissionTitle").value.trim();
    const fileIn  = document.getElementById("fileInput");

    if (!type || !subject || !title) {
      showAlert("uploadAlert", "Please fill in all fields.", "error"); return;
    }
    if (!fileIn.files.length) {
      showAlert("uploadAlert", "Please select a file to upload.", "error"); return;
    }

    const file = fileIn.files[0];
    const ext  = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "zip"].includes(ext)) {
      showAlert("uploadAlert", "Only PDF and ZIP files are allowed.", "error"); return;
    }
    if (file.size > 20 * 1024 * 1024) {
      showAlert("uploadAlert", "File exceeds the 20 MB size limit.", "error"); return;
    }

    // Build FormData
    const formData = new FormData();
    formData.append("file", file);
    formData.append("submission_type", type);
    formData.append("subject_code", subject);
    formData.append("title", title);

    // Loading state
    const btn    = document.getElementById("uploadBtn");
    const text   = document.getElementById("uploadBtnText");
    const loader = document.getElementById("uploadLoader");
    btn.disabled = true;
    text.textContent = "Uploading…";
    loader.classList.remove("hidden");

    try {
      const res = await fetch("/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) {
        showAlert("uploadAlert", data.error || "Upload failed.", "error");
      } else {
        showAlert("uploadAlert", data.message, "success");
        document.getElementById("uploadForm").reset();
        document.getElementById("fileInfo").classList.add("hidden");
        // Refresh dashboard data
        await loadDashboard();
      }
    } catch (err) {
      showAlert("uploadAlert", "Network error during upload.", "error");
    } finally {
      btn.disabled = false;
      text.textContent = "Upload Submission";
      loader.classList.add("hidden");
    }
  });
}

// ── Dropzone ──────────────────────────────────────────────────
function setupDropzone() {
  const zone  = document.getElementById("dropzone");
  const input = document.getElementById("fileInput");
  const info  = document.getElementById("fileInfo");

  zone.addEventListener("click", () => input.click());

  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("dragover");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragover"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("dragover");
    if (e.dataTransfer.files.length) {
      input.files = e.dataTransfer.files;
      showFileInfo(e.dataTransfer.files[0]);
    }
  });

  input.addEventListener("change", () => {
    if (input.files.length) showFileInfo(input.files[0]);
  });

  function showFileInfo(file) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
    info.textContent = `📎 ${file.name} — ${sizeMB} MB`;
    info.classList.remove("hidden");
  }
}

// ── Logout ────────────────────────────────────────────────────
async function logout() {
  await fetch("/logout", { method: "POST" });
  window.location.href = "/";
}

// ── Helpers ───────────────────────────────────────────────────
function showAlert(id, msg, type = "error") {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = `alert ${type}`;
  el.classList.remove("hidden");
}
function hideAlert(id) { document.getElementById(id).classList.add("hidden"); }

function showGlobalAlert(msg, type = "error") {
  const el = document.getElementById("globalAlert");
  el.textContent = msg;
  el.className = `alert ${type}`;
  el.classList.remove("hidden");
}

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
}
