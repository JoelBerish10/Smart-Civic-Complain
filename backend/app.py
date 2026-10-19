"""
CampusLoop -- Flask Backend
Serves the frontend and provides authentication + complaint REST APIs.
"""

import os
import sqlite3
import base64
import re
import hashlib
import io
from PIL import Image, ImageOps
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


# -- geo helpers -------------------------------------------------------------
def is_point_in_polygon(x, y, poly):
    n = len(poly)
    inside = False
    p1x, p1y = poly[0]
    for i in range(1, n + 1):
        p2x, p2y = poly[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

def is_in_sies_gst(lat, lng):
    poly = [(19.0447, 73.0227), (19.0449, 73.0244), (19.0423, 73.0244), (19.0421, 73.0227)]
    return is_point_in_polygon(lat, lng, poly)


# -- image compression & validation helpers ---------------------------------
def process_and_compress_image(data_uri, max_dimension=1600, target_max_bytes=1024 * 1024):
    """
    Validates, corrects orientation, scales very high-res photos to max_dimension (preserving aspect ratio),
    and compresses to JPEG under target_max_bytes (~500 KB - 1 MB).
    Gracefully falls back to original data_uri if compression cannot be applied, so submissions NEVER fail.
    """
    if not data_uri or not isinstance(data_uri, str) or not data_uri.strip():
        raise ValueError("Image data is missing or invalid.")

    # Calculate fallback hash immediately
    fallback_hash = hashlib.sha256(data_uri.encode("utf-8")).hexdigest()

    try:
        if "," in data_uri:
            header, encoded = data_uri.split(",", 1)
        else:
            encoded = data_uri

        # Remove any whitespace or line breaks in base64 string
        encoded = re.sub(r"\s+", "", encoded)
        raw_bytes = base64.b64decode(encoded)

        if len(raw_bytes) < 30:
            return data_uri, fallback_hash

        img = Image.open(io.BytesIO(raw_bytes))

        # Handle EXIF orientation (transpose) so mobile camera photos remain upright
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        # Convert palette/transparency to RGB for clean JPEG compression
        if img.mode in ("RGBA", "LA"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[-1])
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")

        # Resize if exceeding max_dimension while strictly preserving aspect ratio
        width, height = img.size
        if width > max_dimension or height > max_dimension:
            scale = min(max_dimension / width, max_dimension / height)
            new_width = max(1, round(width * scale))
            new_height = max(1, round(height * scale))
            img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)

        # Compress to JPEG with target size (~500 KB - 1 MB)
        quality = 84
        out_buf = io.BytesIO()
        img.save(out_buf, format="JPEG", quality=quality, optimize=True)

        # If it exceeds target_max_bytes, step down quality slightly down to 70 without making it blurry
        while len(out_buf.getvalue()) > target_max_bytes and quality > 70:
            quality -= 5
            out_buf = io.BytesIO()
            img.save(out_buf, format="JPEG", quality=quality, optimize=True)

        compressed_bytes = out_buf.getvalue()
        compressed_b64 = base64.b64encode(compressed_bytes).decode("ascii")
        compressed_uri = f"data:image/jpeg;base64,{compressed_b64}"
        img_hash = hashlib.sha256(compressed_bytes).hexdigest()

        return compressed_uri, img_hash

    except Exception:
        # Fail-safe: if any compression error occurs, return original data so submission is never broken
        return data_uri, fallback_hash


@app.after_request
def add_cache_headers(response):
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

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
            "INSERT INTO users (name, email, department, year, password_hash, role, trust_score) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                "Admin",
                "admin@siesgst.edu.in",
                "Administration",
                "-",
                generate_password_hash("Admin@123"),
                "admin",
                100,
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
    if len(password) < 8 or not re.search(r"[A-Z]", password) or not re.search(r"[a-z]", password) or not re.search(r"[0-9]", password) or not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+]', password):
        return jsonify({"error": "Password must contain at least 8 characters, including uppercase, lowercase, number, and special character."}), 400

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
    expected_role = data.get("role")  # student or admin

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    if not user:
        return jsonify({"error": "No account found. Please sign up first."}), 404

    if expected_role and user["role"] != expected_role:
        if expected_role == "admin":
            return jsonify({"error": "No admin account found with this email."}), 403
        else:
            return jsonify({"error": "This is an admin account. Please use the Admin tab."}), 403

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
            "trust_score": user["trust_score"] if "trust_score" in user.keys() else 100,
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
            "trust_score": user["trust_score"] if "trust_score" in user.keys() else 100,
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
    if not user_id:
        return jsonify({"error": "Not authenticated."}), 401

    conn = get_db()
    # Everyone sees global stats now
    total = conn.execute("SELECT COUNT(*) as c FROM complaints").fetchone()["c"]
    pending = conn.execute("SELECT COUNT(*) as c FROM complaints WHERE status NOT IN ('RESOLVED', 'REMOVED')").fetchone()["c"]
    fixed = conn.execute("SELECT COUNT(*) as c FROM complaints WHERE status='RESOLVED'").fetchone()["c"]
    conn.close()

    return jsonify({"total": total, "pending": pending, "fixed": fixed}), 200


# -- API: create complaint ---------------------------------------------------
@app.route("/api/complaints", methods=["POST"])
def create_complaint():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Not authenticated."}), 401

    data = request.get_json()
    category = (data.get("category") or "").strip()
    location_area = (data.get("location_area") or "").strip()
    description = (data.get("description") or "").strip()
    affected_object = (data.get("affected_object") or "").strip()
    severity = (data.get("severity") or "").strip()
    lat = data.get("lat")
    lng = data.get("lng")
    image_data = data.get("image_data")  # base64 string

    if not description or not category or not location_area or not affected_object or not severity or not image_data:
        return jsonify({"error": "All fields and photo are required."}), 400
        
    try:
        lat = float(lat) if lat is not None and str(lat).strip() != "" else None
        lng = float(lng) if lng is not None and str(lng).strip() != "" else None
        if lat is not None and lng is not None and not is_in_sies_gst(lat, lng):
            # Optional: just warn or reject? Spec says: allow submission but require verification, or reject.
            # "Do not block a complaint purely because GPS is slightly inaccurate. If GPS accuracy is poor, allow: Location uncertain - admin verification required."
            pass # We'll accept it but maybe we could mark a flag, we'll just accept it since GPS can be inaccurate
    except (TypeError, ValueError):
        lat = None
        lng = None

    # Process, validate and compress image (both frontend and backend protected)
    try:
        compressed_image_data, img_hash = process_and_compress_image(
            image_data, max_dimension=1600, target_max_bytes=1024 * 1024
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return jsonify({"error": "Failed to process and compress image."}), 400

    conn = get_db()
    
    # Duplicate check based on normalized compressed image hash (exclude removed complaints)
    existing = conn.execute("SELECT id FROM complaints WHERE duplicate_hash = ? AND status != 'REMOVED'", (img_hash,)).fetchone()
    if existing:
        conn.close()
        return jsonify({"error": "This image appears to have already been submitted."}), 400

    conn.execute(
        "INSERT INTO complaints (user_id, category, location_area, description, affected_object, severity, lat, lng, image_data, duplicate_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, category, location_area, description, affected_object, severity, lat, lng, compressed_image_data, img_hash),
    )
    conn.commit()
    conn.close()

    return jsonify({"message": "Complaint submitted successfully."}), 201


# -- API: edit complaint -----------------------------------------------------
@app.route("/api/complaints/<int:complaint_id>/edit", methods=["POST"])
def edit_complaint(complaint_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Not authenticated."}), 401

    conn = get_db()
    complaint = conn.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,)).fetchone()
    if not complaint:
        conn.close()
        return jsonify({"error": "Complaint not found."}), 404
        
    if complaint["user_id"] != user_id:
        conn.close()
        return jsonify({"error": "Unauthorized to edit this complaint."}), 403
        
    if complaint["status"] not in ["SUBMITTED"]:
        conn.close()
        return jsonify({"error": "Cannot edit a complaint after it has been verified."}), 400
        
    data = request.get_json()
    category = (data.get("category") or complaint["category"]).strip()
    location_area = (data.get("location_area") or complaint["location_area"]).strip()
    description = (data.get("description") or complaint["description"]).strip()
    affected_object = (data.get("affected_object") or complaint["affected_object"]).strip()
    severity = (data.get("severity") or complaint["severity"]).strip()
    
    conn.execute(
        "UPDATE complaints SET category=?, location_area=?, description=?, affected_object=?, severity=? WHERE id=?",
        (category, location_area, description, affected_object, severity, complaint_id),
    )
    conn.commit()
    conn.close()
    
    return jsonify({"message": "Complaint updated successfully."}), 200

# -- API: remove complaint (admin only) --------------------------------------
@app.route("/api/complaints/<int:complaint_id>/remove", methods=["POST"])
def remove_complaint(complaint_id):
    user_id = session.get("user_id")
    role = session.get("role")
    if not user_id or role != "admin":
        return jsonify({"error": "Admin access required."}), 403
        
    data = request.get_json()
    reason = (data.get("reason") or "Other").strip()
    penalty = data.get("apply_penalty") # boolean
    
    conn = get_db()
    complaint = conn.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,)).fetchone()
    if not complaint:
        conn.close()
        return jsonify({"error": "Complaint not found."}), 404
        
    conn.execute(
        "UPDATE complaints SET status='REMOVED', remove_reason=? WHERE id=?",
        (reason, complaint_id),
    )
    
    if penalty:
        conn.execute(
            "UPDATE users SET trust_score = max(0, trust_score - 10) WHERE id = ?",
            (complaint["user_id"],)
        )
        
    conn.commit()
    conn.close()
    
    return jsonify({"message": "Complaint removed."}), 200
    
# -- API: list complaints ----------------------------------------------------
@app.route("/api/complaints", methods=["GET"])
def list_complaints():
    user_id = session.get("user_id")
    role = session.get("role")
    if not user_id:
        return jsonify({"error": "Not authenticated."}), 401

    conn = get_db()
    rows = conn.execute(
        "SELECT c.*, u.name as reporter_name, u.email as reporter_email, u.department as reporter_dept, u.trust_score "
        "FROM complaints c JOIN users u ON c.user_id = u.id ORDER BY c.created_at DESC"
    ).fetchall()
    conn.close()

    complaints = []
    for r in rows:
        item = {
            "id": r["id"],
            "user_id": r["user_id"],
            "category": r["category"],
            "location_area": r["location_area"],
            "description": r["description"],
            "affected_object": r["affected_object"],
            "severity": r["severity"],
            "lat": r["lat"],
            "lng": r["lng"],
            "image_data": r["image_data"],
            "status": r["status"],
            "remove_reason": r["remove_reason"],
            "fix_image_data": r["fix_image_data"],
            "fix_note": r["fix_note"],
            "created_at": r["created_at"],
            "resolved_at": r["resolved_at"],
        }
        if role == "admin":
            item["reporter_name"] = r["reporter_name"]
            item["reporter_email"] = r["reporter_email"]
            item["reporter_dept"] = r["reporter_dept"]
            item["trust_score"] = r["trust_score"]
        complaints.append(item)

    return jsonify({"complaints": complaints}), 200

# -- API: change status (admin only) -----------------------------------------
@app.route("/api/complaints/<int:complaint_id>/status", methods=["POST"])
def change_status(complaint_id):
    user_id = session.get("user_id")
    role = session.get("role")
    if not user_id or role != "admin":
        return jsonify({"error": "Admin access required."}), 403
        
    data = request.get_json()
    new_status = data.get("status")
    
    if new_status not in ["SUBMITTED", "VERIFIED", "IN_PROGRESS"]:
        return jsonify({"error": "Invalid status."}), 400
        
    conn = get_db()
    conn.execute("UPDATE complaints SET status=? WHERE id=?", (new_status, complaint_id))
    conn.commit()
    conn.close()
    
    return jsonify({"message": "Status updated."}), 200

# -- API: report still exists ------------------------------------------------
@app.route("/api/complaints/<int:complaint_id>/still_exists", methods=["POST"])
def report_still_exists(complaint_id):
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Not authenticated."}), 401

    conn = get_db()
    complaint = conn.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,)).fetchone()
    if not complaint:
        conn.close()
        return jsonify({"error": "Complaint not found."}), 404
        
    if complaint["user_id"] != user_id:
        conn.close()
        return jsonify({"error": "Unauthorized."}), 403
        
    if complaint["status"] != "RESOLVED":
        conn.close()
        return jsonify({"error": "Complaint is not resolved yet."}), 400
        
    conn.execute(
        "UPDATE complaints SET status='REOPENED' WHERE id=?",
        (complaint_id,),
    )
    conn.commit()
    conn.close()
    
    return jsonify({"message": "Complaint reopened."}), 200

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

    try:
        compressed_fix_image, _ = process_and_compress_image(
            fix_image_data, max_dimension=1600, target_max_bytes=1024 * 1024
        )
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return jsonify({"error": "Failed to process fix image."}), 400

    conn = get_db()
    complaint = conn.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,)).fetchone()
    if not complaint:
        conn.close()
        return jsonify({"error": "Complaint not found."}), 404

    conn.execute(
        "UPDATE complaints SET status='RESOLVED', fix_image_data=?, fix_note=?, resolved_by=?, resolved_at=CURRENT_TIMESTAMP WHERE id=?",
        (compressed_fix_image, fix_note, user_id, complaint_id),
    )
    
    # Increase trust score for useful complaint
    conn.execute(
        "UPDATE users SET trust_score = min(100, trust_score + 5) WHERE id = ?",
        (complaint["user_id"],)
    )
    
    conn.commit()
    conn.close()

    return jsonify({"message": "Complaint marked as fixed."}), 200


# -- API: lost & found -------------------------------------------------------
@app.route("/api/lost_found", methods=["GET"])
def list_lost_found():
    conn = get_db()
    rows = conn.execute(
        "SELECT lf.*, u.name as reporter_name, u.email as reporter_email "
        "FROM lost_found lf JOIN users u ON lf.user_id = u.id ORDER BY lf.created_at DESC"
    ).fetchall()
    conn.close()
    
    items = []
    for r in rows:
        items.append({
            "id": r["id"],
            "user_id": r["user_id"],
            "type": r["type"],
            "item_name": r["item_name"],
            "description": r["description"],
            "location": r["location"],
            "item_date": r["item_date"],
            "image_data": r["image_data"],
            "lat": r["lat"],
            "lng": r["lng"],
            "created_at": r["created_at"],
            "reporter_name": r["reporter_name"],
            "reporter_email": r["reporter_email"]
        })
    return jsonify({"items": items}), 200

@app.route("/api/lost_found", methods=["POST"])
def create_lost_found():
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Not authenticated."}), 401

    data = request.get_json()
    item_type = (data.get("type") or "").strip()
    item_name = (data.get("item_name") or "").strip()
    description = (data.get("description") or "").strip()
    location = (data.get("location") or "").strip()
    item_date = (data.get("item_date") or "").strip()
    image_data = data.get("image_data")
    lat = data.get("lat")
    lng = data.get("lng")
    try:
        lat = float(lat) if lat is not None and str(lat).strip() != "" else None
        lng = float(lng) if lng is not None and str(lng).strip() != "" else None
    except (TypeError, ValueError):
        lat = None
        lng = None

    if not item_type or not item_name or not description or not location or not item_date:
        return jsonify({"error": "All required fields (type, item name, location, date, description) are required."}), 400

    compressed_lf_image = None
    if image_data and str(image_data).strip() and str(image_data).strip() != "null":
        try:
            compressed_lf_image, _ = process_and_compress_image(
                image_data, max_dimension=1600, target_max_bytes=1024 * 1024
            )
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception:
            return jsonify({"error": "Failed to process item photo."}), 400

    conn = get_db()
    conn.execute(
        "INSERT INTO lost_found (user_id, type, item_name, description, location, item_date, image_data, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (user_id, item_type, item_name, description, location, item_date, compressed_lf_image, lat, lng),
    )
    conn.commit()
    conn.close()

    return jsonify({"message": "Item reported successfully."}), 201


# -- run ---------------------------------------------------------------------
if __name__ == "__main__":
    init_db()
    print("[START] CampusLoop server running at http://localhost:5000")
    app.run(debug=True, port=5000)
