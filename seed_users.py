"""
seed_users.py – Run this ONCE to add test users to your Supabase database.
Usage: python seed_users.py
"""

import os
import bcrypt
from supabase import create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://vmqoppfetktphzkrjamp.supabase.co")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZtcW9wcGZldGt0cGh6a3JqYW1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjQ2MjgsImV4cCI6MjA5MDI0MDYyOH0.jwho8HUcUvLpzHZQrlzn-zl4wQPvfDluwjcE2rFbd14")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


STUDENTS = [
    {"name": "Soumya Hinge",   "enrollment_number": "2313023", "password": "student123", "batch": "A"},
    {"name": "Abhishek Jadhav", "enrollment_number": "2313025", "password": "student123", "batch": "B"},
    {"name": "Shashwat Vaidya",      "enrollment_number": "2313064", "password": "student123", "batch": "C"},
]

FACULTY = [
    {"name": "Prof. Sumit Khatri",   "faculty_id": "FAC001", "password": "faculty123"},
    {"name": "Prof. Ujwala Aher","faculty_id": "FAC002", "password": "faculty123"},
]



def seed():
    print("Seeding students…")
    for s in STUDENTS:
        supabase.table("users").upsert({
            "name": s["name"],
            "enrollment_number": s["enrollment_number"],
            "password": hash_password(s["password"]),
            "role": "student",
            "batch": s["batch"]
        }, on_conflict="enrollment_number").execute()
        print(f"  ✓ Student: {s['name']} ({s['enrollment_number']})")

    print("Seeding faculty…")
    for f in FACULTY:
        supabase.table("users").upsert({
            "name": f["name"],
            "faculty_id": f["faculty_id"],
            "password": hash_password(f["password"]),
            "role": "faculty"
        }, on_conflict="faculty_id").execute()
        print(f"  ✓ Faculty: {f['name']} ({f['faculty_id']})")

    print("\nDone! Test credentials:")
    print("  Student login → Enrollment: 2200100001 | Password: student123")
    print("  Faculty login → Faculty ID: FAC001     | Password: faculty123")


if __name__ == "__main__":
    seed()
