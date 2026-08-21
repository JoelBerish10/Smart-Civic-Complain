# CampusLoop

CampusLoop is a student-run hub for cleanliness drives and lost & found at SIES GST. It allows students to report campus issues (with photo uploads), and allows administrators to resolve them and track live campus cleanliness stats.

## Tech Stack
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Python, Flask
- **Database**: SQLite (Local)

## How to Run the Project Locally

If you just cloned or pulled this project to your PC, follow these exact steps to get it running:

### Prerequisites
Make sure you have [Python](https://www.python.org/downloads/) installed on your computer.

### Step 1: Install Dependencies
Open a terminal in the root folder of the project (`Smart-Civic-Complain-1`) and run the following command to install the required Python packages (Flask and Flask-CORS):

```bash
pip install -r backend/requirements.txt
```

### Step 2: Start the Backend Server
Once the dependencies are installed, start the local server by running:

```bash
python backend/app.py
```
*Note: The first time you run this, it will automatically create the `campusloop.db` database file and insert the default admin account.*

### Step 3: Open the App
Do **not** open the HTML files directly from your file explorer. 

Instead, open your web browser (Chrome, Edge, Safari, etc.) and go to:
**http://localhost:5000**

---

### Default Admin Account
To test the admin features (resolving complaints), you can log in with the auto-generated admin credentials:
- **Email:** `admin@siesgst.edu.in`
- **Password:** `admin123`
