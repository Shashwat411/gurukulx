/**
 * faculty.js – Faculty dashboard logic for GPN Submission Portal
 */

let allSubmissions = [];

// ── On page load ─────────────────────────────────────────────
window.addEventListener("DOMContentLoaded", async () => {
  await loadSubmissions();
});

// ── Load all submissions ──────────────────────────────────────
async function loadSubmissions(subjectCode = "", batch = "") {
  const tableWrapper = document.getElementById("tableWrapper");
  tableWrapper.innerHTML = `<div class="loading-state"><span class="spinner"></span> Loading submissions…</div>`;

  try {
    const params = new URLSearchParams();
    if (subjectCode) params.append("subject_code", subjectCode);
    if (batch) params.append("batch", batch);

    const res = await fetch(`/faculty/dashboard?${params}`);
    if (res.status === 401) { window.location.href = "/"; return; }
    const data = await res.json();

    if (!res.ok) { showGlobalAlert(data.error || "Failed to load data.", "error"); return; }

    // Update nav
    document.getElementById("navName").textContent = data.faculty_name || "Faculty";

    allSubmissions = data.submissions || [];
    updateStats(allSubmissions);
    renderTable(allSubmissions);

  } catch (err) {
    tableWrapper.innerHTML = `<div class="empty-state"><span class="empty-icon">⚠️</span><p>Could not connect to server.</p></div>`;
  }
}

// ── Update stats bar ──────────────────────────────────────────
function updateStats(subs) {
  document.getElementById("statTotal").textContent    = subs.length;
  document.getElementById("statApproved").textContent = subs.filter(s => s.status === "approved").length;
  document.getElementById("statPending").textContent  = subs.filter(s => s.status === "pending").length;
  document.getElementById("statRejected").textContent = subs.filter(s => s.status === "rejected").length;
}

// ── Render submissions table ──────────────────────────────────
function renderTable(subs) {
  const wrapper = document.getElementById("tableWrapper");

  if (!subs || subs.length === 0) {
    wrapper.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📭</span>
        <p>No submissions found for the selected filters.</p>
      </div>`;
    return;
  }

  const rows = subs.map(s => `
    <tr id="row-${s.id}">
      <td>${escHtml(s.enrollment_number)}</td>
      <td>${escHtml(s.name)}</td>
      <td><span class="badge-batch">Batch ${escHtml(s.batch)}</span></td>
      <td>${escHtml(s.subject_code)}</td>
      <td>${escHtml(s.title)}</td>
      <td>${formatDate(s.submitted_at)}</td>
      <td>
        <a href="${escHtml(s.file_url)}" target="_blank" rel="noopener" class="file-link">📄 View</a>
      </td>
      <td><span class="badge ${s.status}" id="badge-${s.id}">${s.status}</span></td>
      <td>
        <div class="action-btns" id="actions-${s.id}">
          ${s.status !== "approved" ? `<button class="btn-approve" onclick="updateStatus('${s.id}', 'approve')">✓ Approve</button>` : ""}
          ${s.status !== "rejected" ? `<button class="btn-reject" onclick="updateStatus('${s.id}', 'reject')">✕ Reject</button>` : ""}
          ${s.status === "approved" || s.status === "rejected" ? `<span style="color:var(--grey-4);font-size:0.8rem;">—</span>` : ""}
        </div>
      </td>
    </tr>
  `).join("");

  wrapper.innerHTML = `
    <table class="submissions-table">
      <thead>
        <tr>
          <th>Enroll No.</th>
          <th>Student Name</th>
          <th>Batch</th>
          <th>Subject</th>
          <th>Title</th>
          <th>Submitted On</th>
          <th>File</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ── Approve / Reject handler ──────────────────────────────────
async function updateStatus(id, action) {
  const endpoint = action === "approve" ? "/approve" : "/reject";
  const label    = action === "approve" ? "Approved" : "Rejected";

  // Disable action buttons for this row
  const actDiv = document.getElementById(`actions-${id}`);
  actDiv.innerHTML = `<span class="spinner"></span>`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    const data = await res.json();

    if (!res.ok) {
      showGlobalAlert(data.error || `${label} failed.`, "error");
      // Re-render to restore buttons
      await loadSubmissions(
        document.getElementById("filterSubject").value.trim(),
        document.getElementById("filterBatch").value
      );
      return;
    }

    // Update badge & clear action buttons in-place (no full reload)
    const badge = document.getElementById(`badge-${id}`);
    badge.className = `badge ${action === "approve" ? "approved" : "rejected"}`;
    badge.textContent = action === "approve" ? "approved" : "rejected";
    actDiv.innerHTML = `<span style="color:var(--grey-4);font-size:0.8rem;">—</span>`;

    // Update local data & stats
    const sub = allSubmissions.find(s => s.id == id);
    if (sub) sub.status = action === "approve" ? "approved" : "rejected";
    updateStats(allSubmissions);

    showGlobalAlert(data.message, "success");

  } catch (err) {
    showGlobalAlert("Network error. Please try again.", "error");
  }
}

// ── Filters ───────────────────────────────────────────────────
function applyFilters() {
  const subject = document.getElementById("filterSubject").value.trim();
  const batch   = document.getElementById("filterBatch").value;
  loadSubmissions(subject, batch);
}

function clearFilters() {
  document.getElementById("filterSubject").value = "";
  document.getElementById("filterBatch").value   = "";
  loadSubmissions();
}

// ── Logout ────────────────────────────────────────────────────
async function logout() {
  await fetch("/logout", { method: "POST" });
  window.location.href = "/";
}

// ── Helpers ───────────────────────────────────────────────────
function showGlobalAlert(msg, type = "error") {
  const el = document.getElementById("globalAlert");
  el.textContent = msg;
  el.className = `alert ${type}`;
  el.classList.remove("hidden");
  // Auto-hide after 4s
  setTimeout(() => el.classList.add("hidden"), 4000);
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
