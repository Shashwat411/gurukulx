/**
 * login.js – Handles login form for GPN Submission Portal
 */

let currentRole = "student";

/** Switch active role tab and update form labels */
function switchRole(role) {
  currentRole = role;

  // Update tab UI
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.role === role);
  });

  // Update identifier label & placeholder
  const label = document.getElementById("identifierLabel");
  const input = document.getElementById("identifier");
  if (role === "student") {
    label.textContent = "Enrollment Number";
    input.placeholder = "e.g. 2200100001";
    input.value = "";
  } else {
    label.textContent = "Faculty ID";
    input.placeholder = "e.g. FAC001";
    input.value = "";
  }

  hideAlert("alertBox");
}

/** Show an alert message */
function showAlert(id, message, type = "error") {
  const box = document.getElementById(id);
  box.textContent = message;
  box.className = `alert ${type}`;
  box.classList.remove("hidden");
}

function hideAlert(id) {
  document.getElementById(id).classList.add("hidden");
}

/** Toggle password visibility */
function togglePassword() {
  const input = document.getElementById("password");
  input.type = input.type === "password" ? "text" : "password";
}

/** Handle login form submission */
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert("alertBox");

  const identifier = document.getElementById("identifier").value.trim();
  const password   = document.getElementById("password").value.trim();

  if (!identifier || !password) {
    showAlert("alertBox", "Please fill in all fields.");
    return;
  }

  // Loading state
  const btn    = document.getElementById("loginBtn");
  const text   = document.getElementById("btnText");
  const loader = document.getElementById("btnLoader");
  btn.disabled = true;
  text.textContent = "Signing in…";
  loader.classList.remove("hidden");

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password, role: currentRole })
    });
    const data = await res.json();

    if (!res.ok) {
      showAlert("alertBox", data.error || "Login failed. Please try again.");
    } else {
      showAlert("alertBox", `Welcome, ${data.name}! Redirecting…`, "success");
      setTimeout(() => { window.location.href = data.redirect; }, 800);
    }
  } catch (err) {
    showAlert("alertBox", "Network error. Please check your connection.");
  } finally {
    btn.disabled = false;
    text.textContent = "Sign In";
    loader.classList.add("hidden");
  }
});
