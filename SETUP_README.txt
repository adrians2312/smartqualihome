SMARTQUALIHOME - FRIEND SETUP (SUPER SIMPLE)
================================================================
You received smartqualihome.zip

WHAT TO DO (3 STEPS ONLY):
================================================================
1) START XAMPP
   - Open XAMPP Control Panel
   - Click "Start" for Apache
   - Click "Start" for MySQL (must be green/running)

2) EXTRACT ZIP
   - Right-click smartqualihome.zip -> Extract All
   - Open the extracted folder: smartqualihome

3) DOUBLE-CLICK START.bat
   - That's the file named "START" with gear icon
   - It will AUTOMATICALLY:
     * Create virtual environment
     * Install requirements.txt (pip install)
     * Create database "smartqualihome" in MySQL
     * Import migrations/schema.sql (no copy-paste needed!)
     * Start the server
     * Open http://127.0.0.1:5000 in your browser

DONE! No manual pip, no manual phpMyAdmin needed.

================================================================
IF XAMPP MYSQL IS NOT RUNNING?
================================================================
- The installer will automatically use SQLite instead (no setup needed)
- It creates instance/smartqualihome.db locally
- Still works at http://127.0.0.1:5000

================================================================
LOGIN ACCOUNTS (auto-created)
================================================================
Admin  : admin@smartqualihome.com  / Admin@2026!
Agent  : agent@smartqualihome.com  / Agent@2026!  (Ann Regar)
Client : client@smartqualihome.com / Client@2026!

================================================================
TO STOP / RESTART
================================================================
- To stop: Close the black window or press CTRL+C
- To start again: Double-click START.bat again (much faster 2nd time)
- To reset DB: Delete instance/smartqualihome.db (SQLite) OR
              drop database smartqualihome in phpMyAdmin then re-run START.bat

================================================================
MANUAL METHOD (old way, still works)
================================================================
If you prefer manual:
  1) pip install -r requirements.txt
  2) In phpMyAdmin create DB smartqualihome -> Import migrations/schema.sql
  3) python run.py

But START.bat does all 3 automatically.
