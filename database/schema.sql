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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    image_data TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'fixed')),
    fix_image_data TEXT,
    fix_note TEXT,
    resolved_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (resolved_by) REFERENCES users(id)
);
