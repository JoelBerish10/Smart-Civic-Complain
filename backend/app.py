"""
CampusLoop -- Flask Backend
Serves the frontend and provides authentication + complaint REST APIs.
"""

import os
import sqlite3
import base64
from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash

# -- paths -------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(BASE_DIR)
DB_PATH = os.path.join(ROOT_DIR, "database", "campusloop.db")
SCHEMA_PATH = os.path.join(ROOT_DIR, "database", "schema.sql")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")

# -- app setup ---------------------------------------------------------------
app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")
app.secret_key = "campusloop-dev-secret-key-change-in-prod"
CORS(app, supports_credentials=True)


# -- database helpers --------------------------------------------------------
def get_db():
    """Return a connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Create tables from schema.sql and seed the default admin."""
    conn = get_db()
    with open(SCHEMA_PATH, "r") as f:
        conn.executescript(f.read())

    # Seed admin if not exists
    existing = conn.execute(
        "SELECT id FROM users WHERE email = ?", ("admin@siesgst.edu.in",)
    ).fetchone()
    if not existing:
        conn.execute(
            "INSERT INTO users (name, email, department, year, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)",
            (
                "Admin",
                "admin@siesgst.edu.in",
                "Administration",
                "-",
                generate_password_hash("admin123"),
                "admin",
            ),
        )
        conn.commit()
        print("[OK] Default admin seeded: admin@siesgst.edu.in / admin123")
    conn.close()


# -- frontend routes ---------------------------------------------------------
@app.route("/")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(FRONTEND_DIR, path)


# -- API: register -----------------------------------------------------------
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json()
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    dept = (data.get("department") or "").strip()
    year = (data.get("year") or "").strip()
    password = data.get("password") or ""

    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required."}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400

    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        return jsonify({"error": "An account already exists for this email."}), 409

    conn.execute(
        "INSERT INTO users (name, email, department, year, password_hash, role) VALUES (?, ?, ?, ?, ?, ?)",
        (name, email, dept, year, generate_password_hash(password), "student"),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Account created successfully."}), 201


# -- API: login --------------------------------------------------------------
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    if not user:
        return jsonify({"error": "No account found. Please sign up first."}), 404

    if not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "Incorrect password."}), 401

    session["user_id"] = user["id"]
    session["role"] = user["role"]

    return jsonify({
        "message": "Login successful.",
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "department": user["department"],
            "year": user["year"],
            "role": user["role"],
        },
    }), 200


# -- API: me (current user) -------------------------------------------------
@app.route("/api/me", methods=["GET"])
def me():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Not authenticated."}), 401

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()

    if not user:
        return jsonify({"error": "User not found."}), 404

    return jsonify({
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "department": user["department"],
            "year": user["year"],
            "role": user["role"],
        }
    }), 200


# -- API: logout -------------------------------------------------------------
@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out."}), 200


# -- API: stats --------------------------------------------------------------
@app.route("/api/stats", methods=["GET"])
def stats():
    user_id = session.get("user_id")
    role = session.get("role")
    if not user_id:
        return jsonify({"error": "Not authenticated."}), 401

    conn = get_db()
    if role == "admin":
        total = conn.execute("SELECT COUNT(*) as c FROM complaints").fetchone()["c"]
        pending = conn.execute("SELECT COUNT(*) as c FROM complaints WHERE status='pending'").fetchone()["c"]
        fixed = conn.execute("SELECT COUNT(*) as c FROM complaints WHERE status='fixed'").fetchone()["c"]
    else:
        total = conn.execute("SELECT COUNT(*) as c FROM complaints WHERE user_id=?", (user_id,)).fetchone()["c"]
        pending = conn.execute("SELECT COUNT(*) as c FROM complaints WHERE user_id=? AND status='pending'", (user_id,)).fetchone()["c"]
        fixed = conn.execute("SELECT COUNT(*) as c FROM complaints WHERE user_id=? AND status='fixed'", (user_id,)).fetchone()["c"]
    conn.close()

    return jsonify({"total": total, "pending": pending, "fixed": fixed}), 200


# -- API: create complaint ---------------------------------------------------
@app.route("/api/complaints", methods=["POST"])
def create_complaint():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Not authenticated."}), 401

    data = request.get_json()
    description = (data.get("description") or "").strip()
    image_data = data.get("image_data")  # base64 string

    if not description:
        return jsonify({"error": "Description is required."}), 400

    conn = get_db()
    conn.execute(
        "INSERT INTO complaints (user_id, description, image_data) VALUES (?, ?, ?)",
        (user_id, description, image_data),
    )
    conn.commit()
    conn.close()

    return jsonify({"message": "Complaint submitted successfully."}), 201


# -- API: list complaints ----------------------------------------------------
@app.route("/api/complaints", methods=["GET"])
def list_complaints():
    user_id = session.get("user_id")
    role = session.get("role")
    if not user_id:
        return jsonify({"error": "Not authenticated."}), 401

    conn = get_db()
    if role == "admin":
        rows = conn.execute(
            "SELECT c.*, u.name as reporter_name, u.email as reporter_email, u.department as reporter_dept "
            "FROM complaints c JOIN users u ON c.user_id = u.id ORDER BY c.created_at DESC"
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM complaints WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    conn.close()

    complaints = []
    for r in rows:
        item = {
            "id": r["id"],
            "description": r["description"],
            "image_data": r["image_data"],
            "status": r["status"],
            "fix_image_data": r["fix_image_data"],
            "fix_note": r["fix_note"],
            "created_at": r["created_at"],
            "resolved_at": r["resolved_at"],
        }
        if role == "admin":
            item["reporter_name"] = r["reporter_name"]
            item["reporter_email"] = r["reporter_email"]
            item["reporter_dept"] = r["reporter_dept"]
        complaints.append(item)

    return jsonify({"complaints": complaints}), 200


# -- API: resolve complaint (admin only) -------------------------------------
@app.route("/api/complaints/<int:complaint_id>/resolve", methods=["POST"])
def resolve_complaint(complaint_id):
    user_id = session.get("user_id")
    role = session.get("role")
    if not user_id:
        return jsonify({"error": "Not authenticated."}), 401
    if role != "admin":
        return jsonify({"error": "Admin access required."}), 403

    data = request.get_json()
    fix_image_data = data.get("fix_image_data")
    fix_note = (data.get("fix_note") or "").strip()

    if not fix_image_data:
        return jsonify({"error": "You must upload a fix image before resolving."}), 400

    conn = get_db()
    complaint = conn.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,)).fetchone()
    if not complaint:
        conn.close()
        return jsonify({"error": "Complaint not found."}), 404

    conn.execute(
        "UPDATE complaints SET status='fixed', fix_image_data=?, fix_note=?, resolved_by=?, resolved_at=CURRENT_TIMESTAMP WHERE id=?",
        (fix_image_data, fix_note, user_id, complaint_id),
    )
    conn.commit()
    conn.close()

    return jsonify({"message": "Complaint marked as fixed."}), 200


# -- run ---------------------------------------------------------------------
if __name__ == "__main__":
    init_db()
    print("[START] CampusLoop server running at http://localhost:5000")
    app.run(debug=True, port=5000)
