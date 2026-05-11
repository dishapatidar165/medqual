-- Run this in MySQL Workbench

CREATE DATABASE IF NOT EXISTS medicine_quality_db;
USE medicine_quality_db;

CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin','lab_staff','viewer') DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medicines (
    medicine_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    manufacturer VARCHAR(150) NOT NULL,
    batch_no VARCHAR(100) NOT NULL,
    mfg_date DATE NOT NULL,
    exp_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quality_tests (
    test_id INT AUTO_INCREMENT PRIMARY KEY,
    medicine_id INT NOT NULL,
    tested_by INT,
    result ENUM('pass','fail','pending') DEFAULT 'pending',
    test_date DATE NOT NULL,
    remarks TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
    report_id INT AUTO_INCREMENT PRIMARY KEY,
    medicine_id INT NOT NULL,
    status ENUM('safe','unsafe','pending') DEFAULT 'pending',
    generated_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    generated_by INT,
    FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id) ON DELETE CASCADE
);

-- Sample users (password is: password123)
INSERT INTO users (name, email, password, role) VALUES
('Admin User',      'admin@medlab.com',  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewFRpOsQkR4K0k6m', 'admin'),
('Lab Technician',  'lab@medlab.com',    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewFRpOsQkR4K0k6m', 'lab_staff'),
('Quality Viewer',  'viewer@medlab.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewFRpOsQkR4K0k6m', 'viewer');

-- Sample medicines
INSERT INTO medicines (name, manufacturer, batch_no, mfg_date, exp_date) VALUES
('Paracetamol 500mg', 'PharmaCo Ltd',      'PCM-2024-001', '2024-01-15', '2026-01-14'),
('Amoxicillin 250mg', 'MedTech Industries','AMX-2024-045', '2024-03-10', '2025-03-09'),
('Ibuprofen 400mg',   'HealthCare Pharma', 'IBU-2024-012', '2024-02-20', '2026-02-19');

-- Sample tests
INSERT INTO quality_tests (medicine_id, tested_by, result, test_date, remarks) VALUES
(1, 1, 'pass',    '2024-06-01', 'All parameters within range'),
(2, 1, 'fail',    '2024-06-05', 'Potency below threshold'),
(3, 1, 'pending', '2024-06-10', 'Awaiting final analysis');

-- Sample reports
INSERT INTO reports (medicine_id, status, generated_by) VALUES
(1, 'safe',    1),
(2, 'unsafe',  1),
(3, 'pending', 1);
