#!/usr/bin/env python3
"""
SMARTQUALIHOME - One-Click Local Installer
For friend: Start XAMPP (Apache + MySQL) -> Extract ZIP -> Double-click START.bat
This script: creates venv, installs requirements, auto-imports migrations/schema.sql to MySQL, starts server.
If MySQL is not available, it automatically falls back to SQLite (no XAMPP needed).
"""
import os
import sys
import subprocess
import pathlib
import time
import webbrowser

ROOT = pathlib.Path(__file__).parent.resolve()
VENV = ROOT / ".venv"
VENV_PY = VENV / "Scripts" / "python.exe" if os.name == "nt" else VENV / "bin" / "python"
VENV_PIP = VENV / "Scripts" / "pip.exe" if os.name == "nt" else VENV / "bin" / "pip"
REQ = ROOT / "requirements.txt"
SCHEMA = ROOT / "migrations" / "schema.sql"
ENV_FILE = ROOT / ".env"

def log(msg):
    print(f"[INSTALL] {msg}", flush=True)

def run(cmd, **kw):
    log(f"$ {' '.join(map(str,cmd))}")
    return subprocess.run(cmd, **kw)

def ensure_venv():
    if VENV_PY.exists():
        log("venv already exists")
        return str(VENV_PY)
    log("Creating virtual environment (.venv)...")
    r = run([sys.executable, "-m", "venv", str(VENV)])
    if r.returncode != 0:
        log("Failed to create venv, will use system python")
        return sys.executable
    return str(VENV_PY)

def pip_install(py_exe):
    pip = str(VENV_PIP) if VENV_PIP.exists() else f"{py_exe} -m pip"
    log("Installing requirements.txt (this may take 1-2 minutes)...")
    # Use venv pip if exists
    if VENV_PIP.exists():
        r = run([str(VENV_PIP), "install", "-r", str(REQ)])
    else:
        r = run([py_exe, "-m", "pip", "install", "-r", str(REQ)])
    if r.returncode != 0:
        log("WARNING: pip install had errors, trying again with --no-cache...")
        if VENV_PIP.exists():
            run([str(VENV_PIP), "install", "--no-cache-dir", "-r", str(REQ)])
        else:
            run([py_exe, "-m", "pip", "install", "--no-cache-dir", "-r", str(REQ)])
    log("Requirements done.")

def parse_env():
    env = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line=line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k,v=line.split("=",1)
            env[k.strip()]=v.strip().strip('"').strip("'")
    return env

def try_mysql_import():
    """
    Try to connect to local MySQL (XAMPP) and import schema.sql automatically.
    Returns True if MySQL was used, False if we should fallback to SQLite.
    """
    env = parse_env()
    use_sqlite = env.get("DB_USE_SQLITE","false").lower()=="true"
    if use_sqlite:
        log("DB_USE_SQLITE=true -> will use SQLite (instance/smartqualihome.db)")
        return False

    host = env.get("DB_HOST","localhost")
    port = int(env.get("DB_PORT","3306"))
    user = env.get("DB_USER","root")
    pwd = env.get("DB_PASSWORD","")
    dbname = env.get("DB_NAME","smartqualihome")

    # Try XAMPP default mysql path first
    xampp_mysql = pathlib.Path("C:/xampp/mysql/bin/mysql.exe")
    if xampp_mysql.exists():
        log(f"Found XAMPP MySQL at {xampp_mysql}")

    # Try pymysql
    try:
        import pymysql  # may be from system or venv
    except ImportError:
        # try with venv python
        py = str(VENV_PY) if VENV_PY.exists() else sys.executable
        log("pymysql not found, installing minimal deps first...")
        subprocess.run([py, "-m", "pip", "install", "pymysql"], check=False)
        try:
            import pymysql
        except:
            log("Cannot import pymysql, fallback to SQLite")
            return False

    log(f"Trying MySQL {user}@{host}:{port}/{dbname} ...")
    try:
        conn = pymysql.connect(host=host, port=port, user=user, password=pwd, charset="utf8mb4", autocommit=True)
        cur = conn.cursor()
        # Create DB if not exists
        cur.execute(f"CREATE DATABASE IF NOT EXISTS `{dbname}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")
        conn.select_db(dbname)
        log(f"Database `{dbname}` ready.")

        # Check if tables already exist
        cur.execute("SHOW TABLES;")
        existing = cur.fetchall()
        if existing:
            log(f"Found {len(existing)} existing tables, will NOT re-import schema (keeps data).")
            log("To reset DB, drop database in phpMyAdmin and re-run this installer.")
            conn.close()
            return True

        # Import schema.sql
        if not SCHEMA.exists():
            log(f"ERROR: {SCHEMA} not found!")
            conn.close()
            return False

        sql = SCHEMA.read_text(encoding="utf-8")
        # Remove the commented CREATE DATABASE / USE lines and execute
        # pymysql can execute multiple statements if we split by ';'
        log(f"Importing {SCHEMA} ({len(sql)} chars)...")
        # Simple split - schema uses IF NOT EXISTS so safe to run as-is
        cur.execute(f"USE `{dbname}`;")
        # Execute whole file at once (pymysql doesn't support multi, so split)
        statements = []
        for stmt in sql.split(";"):
            s = stmt.strip()
            if not s or s.startswith("--") or s.startswith("/*"):
                continue
            # Skip the commented CREATE DATABASE lines
            if "CREATE DATABASE" in s and s.strip().startswith("--"):
                continue
            statements.append(s + ";")

        count=0
        for stmt in statements:
            # Skip empty or comment-only
            t = stmt.strip()
            if not t or t.startswith("--"):
                continue
            # Skip the note lines
            if t.startswith("--"):
                continue
            try:
                cur.execute(stmt)
                count+=1
            except Exception as e:
                # Ignore "already exists" etc, log others
                if "already exists" in str(e).lower():
                    continue
                log(f"  SQL warning: {e}")
        conn.commit()
        conn.close()
        log(f"Schema imported! Executed {count} statements.")
        return True

    except Exception as e:
        log(f"MySQL connect/import failed: {e}")
        log("-> Did you START XAMPP -> MySQL -> Start button?")
        log("-> Will fallback to SQLite automatically (no XAMPP needed).")
        # Auto-switch .env to SQLite for this run
        try:
            text = ENV_FILE.read_text(encoding="utf-8")
            text = text.replace("DB_USE_SQLITE=false", "DB_USE_SQLITE=true")
            if "DB_USE_SQLITE=true" not in text:
                text += "\nDB_USE_SQLITE=true\n"
            ENV_FILE.write_text(text, encoding="utf-8")
            log("Switched .env to DB_USE_SQLITE=true for this session (SQLite fallback).")
        except Exception as ex:
            log(f"Could not update .env: {ex}")
        return False

def start_server(py_exe):
    log("Starting SmartQualiHome server...")
    log("URL: http://127.0.0.1:5000")
    log("Accounts: admin@smartqualihome.com / Admin@2026!  |  agent@... / Agent@2026!  |  client@... / Client@2026!")
    log("Press CTRL+C to stop server.")
    # Open browser after 2 sec
    def open_browser():
        time.sleep(2.5)
        try:
            webbrowser.open("http://127.0.0.1:5000")
        except:
            pass
    import threading
    threading.Thread(target=open_browser, daemon=True).start()
    # Run flask
    env = os.environ.copy()
    env["FLASK_APP"]="run.py"
    try:
        subprocess.run([py_exe, "run.py"], cwd=str(ROOT), env=env)
    except KeyboardInterrupt:
        log("Server stopped.")

def main():
    print("="*60)
    print(" SMARTQUALIHOME - One-Click Installer")
    print(" Steps: XAMPP running? -> install deps -> import DB -> start")
    print("="*60)
    py_exe = ensure_venv()
    # If we just created venv, pymysql may not be there, install reqs first
    pip_install(py_exe)
    # Now try DB import using the venv python's pymysql
    # Re-run the DB import via venv python to ensure deps
    if VENV_PY.exists():
        log("Running DB setup with venv python...")
        r = run([str(VENV_PY), __file__, "--db-only"])
        # If db-only failed, continue anyway (SQLite fallback works)
    else:
        try_mysql_import()

    # Start server
    py = str(VENV_PY) if VENV_PY.exists() else sys.executable
    start_server(py)

if __name__ == "__main__":
    if "--db-only" in sys.argv:
        ok = try_mysql_import()
        sys.exit(0 if ok else 0)
    else:
        main()
