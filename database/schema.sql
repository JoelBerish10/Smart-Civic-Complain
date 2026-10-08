-- CampusLoop Database Schema
-- SQLite

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    department TEXT,
    year TEXT,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student', 'admin')),
    trust_score INTEGER DEFAULT 50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category TEXT NOT NULL,
    location_area TEXT NOT NULL,
    description TEXT NOT NULL,
    affected_object TEXT NOT NULL,
    severity TEXT NOT NULL,
    lat REAL,
    lng REAL,
    image_data TEXT,
    duplicate_hash TEXT,
    is_duplicate BOOLEAN DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN ('SUBMITTED', 'VERIFIED', 'IN_PROGRESS', 'RESOLVED', 'REMOVED', 'REOPENED')),
    remove_reason TEXT,
    fix_image_data TEXT,
    fix_note TEXT,
    resolved_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (resolved_by) REFERENCES users(id)
);
