"""
Assignment & Practical Submission System
Government Polytechnic Nagpur – Department of Computer Engineering
Backend: Flask + Supabase
"""

from flask import Flask, request, jsonify, session, render_template, redirect, url_for
from supabase import create_client, Client
import bcrypt
import os
from datetime import datetime, UTC
from functools import wraps

from dotenv import load_dotenv

load_dotenv()


app = Flask(__name__)

# Secret key (safe default allowed for dev)
app.secret_key = os.environ.get("SECRET_KEY", "dev-secret-key")

# ── Supabase configuration ──────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
SUPABASE_BUCKET = "submissions-gpn-cloud"

# Safety check (VERY IMPORTANT)
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Supabase environment variables not set!")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── Allowed file types & max size ───────────────────────────────────────────
ALLOWED_EXTENSIONS = {"pdf", "zip"}
MAX_FILE_SIZE_MB = 20

def allowed_file(filename):
    """Check if the file extension is allowed."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ── Auth decorators ─────────────────────────────────────────────────────────
def login_required(role=None):
    """Decorator to protect routes by session and optional role check."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if "user_id" not in session:
                return jsonify({"error": "Unauthorized. Please log in."}), 401
            if role and session.get("role") != role:
                return jsonify({"error": "Forbidden. Insufficient permissions."}), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator


# ── Page routes (serve HTML templates) ──────────────────────────────────────
@app.route("/")
def index():
    """Serve login page."""
    if "user_id" in session:
        if session.get("role") == "student":
            return redirect(url_for("student_dashboard_page"))
        return redirect(url_for("faculty_dashboard_page"))
    return render_template("index.html")


@app.route("/student")
def student_dashboard_page():
    """Serve student dashboard page."""
    if session.get("role") != "student":
        return redirect(url_for("index"))
    return render_template("student_dashboard.html")


@app.route("/faculty")
def faculty_dashboard_page():
    """Serve faculty dashboard page."""
    if session.get("role") != "faculty":
        return redirect(url_for("index"))
    return render_template("faculty_dashboard.html")


# ── API: Authentication ──────────────────────────────────────────────────────
@app.route("/login", methods=["POST"])
def login():
    """
    Unified login for both students and faculty.
    Body: { identifier, password, role }
      - role='student'  → identifier = enrollment_number
      - role='faculty'  → identifier = faculty_id
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Invalid request body."}), 400

    identifier = data.get("identifier", "").strip()
    password = data.get("password", "").strip()
    role = data.get("role", "").strip()

    if not identifier or not password or role not in ("student", "faculty"):
        return jsonify({"error": "All fields are required."}), 400

    # Build query based on role
    try:
        if role == "student":
            result = supabase.table("users").select("*").eq("enrollment_number", identifier).eq("role", "student").execute()
        else:
            result = supabase.table("users").select("*").eq("faculty_id", identifier).eq("role", "faculty").execute()
    except Exception as e:
        return jsonify({"error": f"Database error: {str(e)}"}), 500

    if not result.data:
        return jsonify({"error": "Invalid credentials. User not found."}), 401

    user = result.data[0]

    # Verify hashed password
    if not bcrypt.checkpw(password.encode("utf-8"), user["password"].encode("utf-8")):
        return jsonify({"error": "Invalid credentials. Wrong password."}), 401

    # Set session
    session["user_id"] = user["id"]
    session["name"] = user["name"]
    session["role"] = user["role"]
    session["batch"] = user.get("batch", "")
    session["enrollment_number"] = user.get("enrollment_number", "")
    session["faculty_id"] = user.get("faculty_id", "")

    return jsonify({
        "message": "Login successful.",
        "role": user["role"],
        "name": user["name"],
        "redirect": "/student" if user["role"] == "student" else "/faculty"
    })


@app.route("/logout", methods=["POST"])
def logout():
    """Clear session and redirect to login."""
    session.clear()
    return jsonify({"message": "Logged out successfully.", "redirect": "/"})


# ── API: Student dashboard data ──────────────────────────────────────────────
@app.route("/student/dashboard", methods=["GET"])
@login_required(role="student")
def student_dashboard():
    """Return student profile + their submissions."""
    try:
        result = supabase.table("submissions") \
            .select("*") \
            .eq("student_id", session["user_id"]) \
            .order("submitted_at", desc=True) \
            .execute()
    except Exception as e:
        return jsonify({"error": f"Failed to fetch submissions: {str(e)}"}), 500

    return jsonify({
        "profile": {
            "name": session["name"],
            "enrollment_number": session["enrollment_number"],
            "batch": session["batch"]
        },
        "submissions": result.data
    })


# ── API: File upload ─────────────────────────────────────────────────────────
@app.route("/upload", methods=["POST"])
@login_required(role="student")
def upload():
    """
    Upload assignment/practical/microproject file.
    Form fields: file, subject_code, title, submission_type
    """
    if "file" not in request.files:
        return jsonify({"error": "No file part in request."}), 400

    file = request.files["file"]
    subject_code = request.form.get("subject_code", "").strip()
    title = request.form.get("title", "").strip()
    submission_type = request.form.get("submission_type", "").strip()  # assignment/practical/microproject

    if not file.filename:
        return jsonify({"error": "No file selected."}), 400
    if not subject_code or not title or not submission_type:
        return jsonify({"error": "Subject code, title, and submission type are required."}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": "Only PDF and ZIP files are allowed."}), 400

    # Check file size
    file.seek(0, 2)  # Seek to end
    size_bytes = file.tell()
    file.seek(0)
    if size_bytes > MAX_FILE_SIZE_MB * 1024 * 1024:
        return jsonify({"error": f"File size exceeds {MAX_FILE_SIZE_MB}MB limit."}), 400

    # Build a unique storage path
    timestamp = datetime.now(UTC).strftime("%Y%m%d%H%M%S")
    ext = file.filename.rsplit(".", 1)[1].lower()
    safe_title = title.replace(" ", "_")[:30]
    storage_path = f"{session['enrollment_number']}/{subject_code}/{submission_type}_{safe_title}_{timestamp}.{ext}"

    try:
        file_bytes = file.read()
        content_type = "application/pdf" if ext == "pdf" else "application/zip"
        supabase.storage.from_(SUPABASE_BUCKET).upload(storage_path, file_bytes, {"content-type": content_type})

        # Get public URL
        public_url = supabase.storage.from_(SUPABASE_BUCKET).get_public_url(storage_path)
    except Exception as e:
        return jsonify({"error": f"File upload failed: {str(e)}"}), 500

    # Save submission record to database
    try:
        supabase.table("submissions").insert({
            "student_id": session["user_id"],
            "name": session["name"],
            "enrollment_number": session["enrollment_number"],
            "batch": session["batch"],
            "subject_code": subject_code,
            "title": f"[{submission_type.upper()}] {title}",
            "file_url": public_url,
            "status": "pending",
            "submitted_at": datetime.utcnow().isoformat()
        }).execute()
    except Exception as e:
        return jsonify({"error": f"Database record failed: {str(e)}"}), 500

    return jsonify({"message": "File uploaded successfully! Status: Pending review."})


# ── API: Faculty dashboard data ──────────────────────────────────────────────
@app.route("/faculty/dashboard", methods=["GET"])
@login_required(role="faculty")
def faculty_dashboard():
    """Return all submissions with optional filters."""
    subject_code = request.args.get("subject_code", "").strip()
    batch = request.args.get("batch", "").strip()

    try:
        query = supabase.table("submissions").select("*").order("submitted_at", desc=True)
        if subject_code:
            query = query.eq("subject_code", subject_code)
        if batch:
            query = query.eq("batch", batch)
        result = query.execute()
    except Exception as e:
        return jsonify({"error": f"Failed to fetch submissions: {str(e)}"}), 500

    return jsonify({
        "faculty_name": session["name"],
        "submissions": result.data
    })


# ── API: Approve submission ──────────────────────────────────────────────────
@app.route("/approve", methods=["POST"])
@login_required(role="faculty")
def approve():
    """Approve a submission by ID."""
    data = request.get_json()
    submission_id = data.get("id")
    if not submission_id:
        return jsonify({"error": "Submission ID required."}), 400

    try:
        supabase.table("submissions").update({"status": "approved"}).eq("id", submission_id).execute()
    except Exception as e:
        return jsonify({"error": f"Update failed: {str(e)}"}), 500

    return jsonify({"message": "Submission approved successfully."})


# ── API: Reject submission ───────────────────────────────────────────────────
@app.route("/reject", methods=["POST"])
@login_required(role="faculty")
def reject():
    """Reject a submission by ID."""
    data = request.get_json()
    submission_id = data.get("id")
    if not submission_id:
        return jsonify({"error": "Submission ID required."}), 400

    try:
        supabase.table("submissions").update({"status": "rejected"}).eq("id", submission_id).execute()
    except Exception as e:
        return jsonify({"error": f"Update failed: {str(e)}"}), 500

    return jsonify({"message": "Submission rejected."})


# ── API: Session info ────────────────────────────────────────────────────────
@app.route("/session-info", methods=["GET"])
def session_info():
    """Return current session details for frontend use."""
    if "user_id" not in session:
        return jsonify({"logged_in": False}), 200
    return jsonify({
        "logged_in": True,
        "name": session.get("name"),
        "role": session.get("role"),
        "batch": session.get("batch"),
        "enrollment_number": session.get("enrollment_number"),
        "faculty_id": session.get("faculty_id")
    })


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
