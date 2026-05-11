# app.py - Run this file to start the backend
# Command: python app.py

from flask import Flask, request, jsonify
from flask_cors import CORS
import pymysql
import bcrypt
import jwt
import datetime

app = Flask(__name__)
CORS(app)

# ── CHANGE THESE TO MATCH YOUR MYSQL ──────────────────
DB_HOST     = 'localhost'
DB_USER     = 'root'
DB_PASSWORD = 'root'   # <-- PUT YOUR PASSWORD HERE
DB_NAME     = 'medicine_quality_db'
SECRET_KEY  = 'mysecretkey123'
# ──────────────────────────────────────────────────────


def get_db():
    return pymysql.connect(
        host=DB_HOST, user=DB_USER,
        password=DB_PASSWORD, database=DB_NAME,
        cursorclass=pymysql.cursors.DictCursor
    )


# ── USER ROUTES ────────────────────────────────────────

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    name     = data.get('name', '').strip()
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')
    role     = data.get('role', 'viewer')

    if not name or not email or not password:
        return jsonify({'error': 'All fields required'}), 400

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    db = get_db()
    try:
        with db.cursor() as c:
            c.execute("SELECT user_id FROM users WHERE email=%s", (email,))
            if c.fetchone():
                return jsonify({'error': 'Email already exists'}), 409
            c.execute("INSERT INTO users (name,email,password,role) VALUES (%s,%s,%s,%s)",
                      (name, email, hashed, role))
            db.commit()
        return jsonify({'message': 'Registered successfully'}), 201
    finally:
        db.close()


@app.route('/login', methods=['POST'])
def login():
    data     = request.get_json()
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')

    db = get_db()
    try:
        with db.cursor() as c:
            c.execute("SELECT * FROM users WHERE email=%s", (email,))
            user = c.fetchone()

        if not user or not bcrypt.checkpw(password.encode(), user['password'].encode()):
            return jsonify({'error': 'Invalid email or password'}), 401

        token = jwt.encode({
            'user_id': user['user_id'],
            'email':   user['email'],
            'role':    user['role'],
            'exp':     datetime.datetime.utcnow() + datetime.timedelta(hours=24)
        }, SECRET_KEY, algorithm='HS256')

        return jsonify({
            'message': 'Login successful',
            'token': token,
            'user': {'user_id': user['user_id'], 'name': user['name'],
                     'email': user['email'], 'role': user['role']}
        })
    finally:
        db.close()


# ── MEDICINE ROUTES ────────────────────────────────────

@app.route('/get_medicines', methods=['GET'])
def get_medicines():
    search = request.args.get('search', '')
    db = get_db()
    try:
        with db.cursor() as c:
            if search:
                c.execute("""SELECT m.*, r.status as quality_status
                             FROM medicines m
                             LEFT JOIN reports r ON r.medicine_id = m.medicine_id
                             WHERE m.name LIKE %s OR m.manufacturer LIKE %s OR m.batch_no LIKE %s
                             ORDER BY m.created_at DESC""",
                          (f'%{search}%', f'%{search}%', f'%{search}%'))
            else:
                c.execute("""SELECT m.*, r.status as quality_status
                             FROM medicines m
                             LEFT JOIN reports r ON r.medicine_id = m.medicine_id
                             ORDER BY m.created_at DESC""")
            meds = c.fetchall()
        for m in meds:
            m['mfg_date'] = str(m['mfg_date']) if m.get('mfg_date') else ''
            m['exp_date'] = str(m['exp_date']) if m.get('exp_date') else ''
            m['created_at'] = str(m['created_at']) if m.get('created_at') else ''
        return jsonify({'medicines': meds, 'total': len(meds)})
    finally:
        db.close()


@app.route('/add_medicine', methods=['POST'])
def add_medicine():
    data = request.get_json()
    db = get_db()
    try:
        with db.cursor() as c:
            c.execute("""INSERT INTO medicines (name,manufacturer,batch_no,mfg_date,exp_date)
                         VALUES (%s,%s,%s,%s,%s)""",
                      (data['name'], data['manufacturer'], data['batch_no'],
                       data['mfg_date'], data['exp_date']))
            db.commit()
        return jsonify({'message': 'Medicine added', 'medicine_id': c.lastrowid}), 201
    finally:
        db.close()


@app.route('/update_medicine/<int:mid>', methods=['PUT'])
def update_medicine(mid):
    data = request.get_json()
    db = get_db()
    try:
        with db.cursor() as c:
            c.execute("""UPDATE medicines SET name=%s, manufacturer=%s,
                         batch_no=%s, mfg_date=%s, exp_date=%s
                         WHERE medicine_id=%s""",
                      (data['name'], data['manufacturer'], data['batch_no'],
                       data['mfg_date'], data['exp_date'], mid))
            db.commit()
        return jsonify({'message': 'Updated'})
    finally:
        db.close()


@app.route('/delete_medicine/<int:mid>', methods=['DELETE'])
def delete_medicine(mid):
    db = get_db()
    try:
        with db.cursor() as c:
            c.execute("DELETE FROM medicines WHERE medicine_id=%s", (mid,))
            db.commit()
        return jsonify({'message': 'Deleted'})
    finally:
        db.close()


# ── TEST ROUTES ────────────────────────────────────────

@app.route('/add_test', methods=['POST'])
def add_test():
    data = request.get_json()
    db = get_db()
    try:
        with db.cursor() as c:
            c.execute("""INSERT INTO quality_tests (medicine_id,tested_by,result,test_date,remarks)
                         VALUES (%s,1,%s,%s,%s)""",
                      (data['medicine_id'], data['result'],
                       data['test_date'], data.get('remarks', '')))
            status = 'safe' if data['result'] == 'pass' else \
                     ('unsafe' if data['result'] == 'fail' else 'pending')
            c.execute("""INSERT INTO reports (medicine_id, status, generated_by)
                         VALUES (%s,%s,1)""", (data['medicine_id'], status))
            db.commit()
        return jsonify({'message': 'Test added'}), 201
    finally:
        db.close()


@app.route('/all_tests', methods=['GET'])
def all_tests():
    db = get_db()
    try:
        with db.cursor() as c:
            c.execute("""SELECT qt.*, m.name as medicine_name, u.name as tested_by_name
                         FROM quality_tests qt
                         LEFT JOIN medicines m ON m.medicine_id = qt.medicine_id
                         LEFT JOIN users u ON u.user_id = qt.tested_by
                         ORDER BY qt.created_at DESC LIMIT 50""")
            tests = c.fetchall()
        for t in tests:
            t['test_date']  = str(t['test_date'])  if t.get('test_date')  else ''
            t['created_at'] = str(t['created_at']) if t.get('created_at') else ''
        return jsonify({'tests': tests})
    finally:
        db.close()


@app.route('/get_tests/<int:mid>', methods=['GET'])
def get_tests(mid):
    db = get_db()
    try:
        with db.cursor() as c:
            c.execute("""SELECT qt.*, u.name as tested_by_name
                         FROM quality_tests qt
                         LEFT JOIN users u ON u.user_id = qt.tested_by
                         WHERE qt.medicine_id=%s ORDER BY qt.test_date DESC""", (mid,))
            tests = c.fetchall()
        for t in tests:
            t['test_date']  = str(t['test_date'])  if t.get('test_date')  else ''
            t['created_at'] = str(t['created_at']) if t.get('created_at') else ''
        return jsonify({'tests': tests})
    finally:
        db.close()


# ── REPORT ROUTES ──────────────────────────────────────

@app.route('/get_all_reports', methods=['GET'])
def get_all_reports():
    status = request.args.get('status', '')
    db = get_db()
    try:
        with db.cursor() as c:
            if status:
                c.execute("""SELECT r.*, m.name as medicine_name, m.batch_no, m.manufacturer
                             FROM reports r LEFT JOIN medicines m ON m.medicine_id=r.medicine_id
                             WHERE r.status=%s ORDER BY r.generated_date DESC""", (status,))
            else:
                c.execute("""SELECT r.*, m.name as medicine_name, m.batch_no, m.manufacturer
                             FROM reports r LEFT JOIN medicines m ON m.medicine_id=r.medicine_id
                             ORDER BY r.generated_date DESC""")
            reports = c.fetchall()
        for r in reports:
            r['generated_date'] = str(r['generated_date']) if r.get('generated_date') else ''
        return jsonify({'reports': reports, 'total': len(reports)})
    finally:
        db.close()


@app.route('/get_report/<int:mid>', methods=['GET'])
def get_report(mid):
    db = get_db()
    try:
        with db.cursor() as c:
            c.execute("SELECT * FROM medicines WHERE medicine_id=%s", (mid,))
            med = c.fetchone()
            c.execute("SELECT * FROM reports WHERE medicine_id=%s ORDER BY generated_date DESC", (mid,))
            reports = c.fetchall()
            c.execute("""SELECT COUNT(*) as total,
                         SUM(result='pass') as passed,
                         SUM(result='fail') as failed,
                         SUM(result='pending') as pending
                         FROM quality_tests WHERE medicine_id=%s""", (mid,))
            summary = c.fetchone()
            c.execute("""SELECT qt.*, u.name as tested_by_name
                         FROM quality_tests qt LEFT JOIN users u ON u.user_id=qt.tested_by
                         WHERE qt.medicine_id=%s ORDER BY qt.test_date DESC LIMIT 1""", (mid,))
            latest = c.fetchone()

        if med:
            med['mfg_date']   = str(med['mfg_date'])   if med.get('mfg_date')   else ''
            med['exp_date']   = str(med['exp_date'])    if med.get('exp_date')   else ''
            med['created_at'] = str(med['created_at'])  if med.get('created_at') else ''
        for r in reports:
            r['generated_date'] = str(r['generated_date']) if r.get('generated_date') else ''
        if latest:
            latest['test_date']  = str(latest['test_date'])  if latest.get('test_date')  else ''
            latest['created_at'] = str(latest['created_at']) if latest.get('created_at') else ''

        return jsonify({
            'medicine': med,
            'latest_status': reports[0]['status'] if reports else 'pending',
            'reports': reports,
            'test_summary': summary,
            'latest_test': latest
        })
    finally:
        db.close()


@app.route('/dashboard_stats', methods=['GET'])
def dashboard_stats():
    db = get_db()
    try:
        with db.cursor() as c:
            c.execute("SELECT COUNT(*) as n FROM medicines");          total_med  = c.fetchone()['n']
            c.execute("SELECT COUNT(*) as n FROM quality_tests");      total_test = c.fetchone()['n']
            c.execute("SELECT COUNT(*) as n FROM reports WHERE status='safe'");    safe    = c.fetchone()['n']
            c.execute("SELECT COUNT(*) as n FROM reports WHERE status='unsafe'");  unsafe  = c.fetchone()['n']
            c.execute("SELECT COUNT(*) as n FROM reports WHERE status='pending'"); pending = c.fetchone()['n']
            c.execute("SELECT COUNT(*) as n FROM users");              total_usr  = c.fetchone()['n']
            c.execute("""SELECT qt.result, qt.test_date, m.name as medicine_name
                         FROM quality_tests qt LEFT JOIN medicines m ON m.medicine_id=qt.medicine_id
                         ORDER BY qt.created_at DESC LIMIT 5""")
            recent = c.fetchall()
        for r in recent:
            r['test_date'] = str(r['test_date']) if r.get('test_date') else ''
        return jsonify({
            'total_medicines': total_med,  'total_tests': total_test,
            'safe_medicines': safe,        'unsafe_medicines': unsafe,
            'pending_medicines': pending,  'total_users': total_usr,
            'recent_tests': recent
        })
    finally:
        db.close()


@app.route('/')
def index():
    return jsonify({'status': 'Backend is running!'})


if __name__ == '__main__':
    app.run(debug=True, port=5000)
