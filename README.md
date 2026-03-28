# GPN Assignment & Practical Submission System
**Government Polytechnic Nagpur – Department of Computer Engineering**

---

## Quick Start

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Set environment variables
Create a `.env` file in the project root:
```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_KEY=your-anon-or-service-role-key
SECRET_KEY=any-random-secret-string
```

Or export them directly:
```bash
export SUPABASE_URL="https://your-project-ref.supabase.co"
export SUPABASE_KEY="your-anon-key"
export SECRET_KEY="my-secret"
```

### 3. Set up Supabase (see SQL below)

### 4. Run the app
```bash
python app.py
```
Visit: **http://localhost:5000**

---

## Supabase Setup

### Step 1 – Create Database Tables
Run this SQL in your Supabase SQL editor:

```sql
-- Users table
CREATE TABLE users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  enrollment_number TEXT UNIQUE,          -- Students only
  faculty_id        TEXT UNIQUE,          -- Faculty only
  password          TEXT NOT NULL,        -- bcrypt hashed
  role              TEXT NOT NULL CHECK (role IN ('student','faculty')),
  batch             TEXT CHECK (batch IN ('A','B','C'))  -- Students only
);

-- Submissions table
CREATE TABLE submissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  enrollment_number TEXT NOT NULL,
  batch             TEXT,
  subject_code      TEXT NOT NULL,
  title             TEXT NOT NULL,
  file_url          TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  submitted_at      TIMESTAMPTZ DEFAULT now()
);
```

### Step 2 – Create Storage Bucket
1. Go to **Storage** in Supabase dashboard
2. Create a bucket named `submissions`
3. Set it as **Public** (so file URLs are accessible)

### Step 3 – Add Test Users

Run this Python script once to hash passwords and insert test users:

```python
import bcrypt
from supabase import create_client

SUPABASE_URL = "your-url"
SUPABASE_KEY = "your-key"
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def hash_pw(plain):
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()

# Add a student
supabase.table("users").insert({
    "name": "Shashwat Vaidya",
    "enrollment_number": "2313064",
    "password": hash_pw("student123"),
    "role": "student",
    "batch": "C"
}).execute()

# Add a faculty
supabase.table("users").insert({
    "name": "Prof. Sumit Khatri",
    "faculty_id": "FAC001",
    "password": hash_pw("faculty123"),
    "role": "faculty"
}).execute()

print("Users inserted!")
```

---

## Project Structure
```
gpn_submission/
├── app.py                  # Flask backend (all API routes)
├── requirements.txt        # Python dependencies
├── README.md               # This file
├── static/
│   ├── css/
│   │   ├── main.css        # Login page + shared styles
│   │   └── dashboard.css   # Dashboard-specific styles
│   └── js/
│       ├── login.js        # Login form logic
│       ├── student.js      # Student dashboard logic
│       └── faculty.js      # Faculty dashboard logic
└── templates/
    ├── index.html              # Login page
    ├── student_dashboard.html  # Student portal
    └── faculty_dashboard.html  # Faculty portal
```

---

## API Endpoints

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/login` | Public | Login for student/faculty |
| POST | `/logout` | Any | Clear session |
| GET | `/session-info` | Any | Get current session |
| GET | `/student/dashboard` | Student | Profile + submissions |
| POST | `/upload` | Student | Upload file |
| GET | `/faculty/dashboard` | Faculty | All submissions (filterable) |
| POST | `/approve` | Faculty | Approve a submission |
| POST | `/reject` | Faculty | Reject a submission |

---

## Features
- ✅ Role-based auth (student / faculty)
- ✅ bcrypt password hashing
- ✅ File upload to Supabase Storage (PDF/ZIP, max 20MB)
- ✅ Submission status tracking (pending / approved / rejected)
- ✅ Faculty filters by subject code and batch
- ✅ Inline approve/reject without page reload
- ✅ Responsive UI (mobile + desktop)
- ✅ Drag & drop file upload
- ✅ Session-based authentication

---

## Tech Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Backend**: Python 3.10+ / Flask
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Auth**: Server-side sessions + bcrypt
