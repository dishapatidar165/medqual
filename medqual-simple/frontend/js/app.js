// js/app.js
// Main application logic - API calls, auth, UI management

const API_BASE = 'http://localhost:5000'; // Change if backend runs on different port

// ─── Auth Utilities ──────────────────────────────────────────────────────────

const Auth = {
    getToken: () => localStorage.getItem('token'),
    getUser:  () => JSON.parse(localStorage.getItem('user') || 'null'),
    isLoggedIn: () => !!localStorage.getItem('token'),

    save(token, user) {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
    },

    clear() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
};

// ─── API Helper ──────────────────────────────────────────────────────────────

async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = Auth.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Something went wrong');
    }
    return data;
}

// ─── Toast Notifications ─────────────────────────────────────────────────────

function showToast(message, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : '✕'}</span> ${message}`;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ─── Badge Helpers ────────────────────────────────────────────────────────────

function statusBadge(status) {
    const icons = { safe: '●', unsafe: '●', pending: '●', pass: '✓', fail: '✕' };
    const icon = icons[status] || '●';
    return `<span class="badge badge-${status}">${icon} ${status}</span>`;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

// ─── Navigation ───────────────────────────────────────────────────────────────

function navigate(page) {
    // Hide all tabs
    document.querySelectorAll('.page-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    // Show target tab
    const tab = document.getElementById(`tab-${page}`);
    if (tab) tab.classList.add('active');

    // Highlight nav item
    const navItem = document.querySelector(`[data-page="${page}"]`);
    if (navItem) navItem.classList.add('active');

    // Update topbar title
    const titles = {
        dashboard: 'Dashboard',
        medicines: 'Medicine Management',
        testing: 'Quality Testing',
        reports: 'Reports & Monitoring'
    };
    const titleEl = document.getElementById('topbar-title');
    if (titleEl) titleEl.textContent = titles[page] || page;

    // Load page data
    loadPageData(page);
}

function loadPageData(page) {
    switch(page) {
        case 'dashboard':  loadDashboard(); break;
        case 'medicines':  loadMedicines(); break;
        case 'testing':    loadAllTests(); loadMedicineDropdown(); break;
        case 'reports':    loadReports(); break;
    }
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

async function loadDashboard() {
    try {
        const data = await apiCall('/dashboard_stats');

        document.getElementById('stat-total-medicines').textContent = data.total_medicines;
        document.getElementById('stat-safe').textContent = data.safe_medicines;
        document.getElementById('stat-unsafe').textContent = data.unsafe_medicines;
        document.getElementById('stat-pending').textContent = data.pending_medicines;
        document.getElementById('stat-tests').textContent = data.total_tests;
        document.getElementById('stat-users').textContent = data.total_users;

        // Recent tests table
        const tbody = document.getElementById('recent-tests-body');
        if (data.recent_tests && data.recent_tests.length > 0) {
            tbody.innerHTML = data.recent_tests.map(t => `
                <tr>
                    <td>${t.medicine_name}</td>
                    <td>${formatDate(t.test_date)}</td>
                    <td>${statusBadge(t.result)}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--muted-foreground)">No tests yet</td></tr>`;
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ─── Medicines ────────────────────────────────────────────────────────────────

let allMedicines = [];

async function loadMedicines(search = '') {
    const tbody = document.getElementById('medicines-tbody');
    tbody.innerHTML = `
        <tr class="skeleton-row">
            <td><div class="skeleton skeleton-text"></div></td>
            <td><div class="skeleton skeleton-text"></div></td>
            <td><div class="skeleton skeleton-text short"></div></td>
            <td><div class="skeleton skeleton-text short"></div></td>
            <td><div class="skeleton skeleton-text short"></div></td>
            <td><div class="skeleton skeleton-badge"></div></td>
            <td><div class="skeleton skeleton-text tiny"></div></td>
        </tr>
        <tr class="skeleton-row">
            <td><div class="skeleton skeleton-text"></div></td>
            <td><div class="skeleton skeleton-text"></div></td>
            <td><div class="skeleton skeleton-text short"></div></td>
            <td><div class="skeleton skeleton-text short"></div></td>
            <td><div class="skeleton skeleton-text short"></div></td>
            <td><div class="skeleton skeleton-badge"></div></td>
            <td><div class="skeleton skeleton-text tiny"></div></td>
        </tr>
        <tr class="skeleton-row">
            <td><div class="skeleton skeleton-text"></div></td>
            <td><div class="skeleton skeleton-text"></div></td>
            <td><div class="skeleton skeleton-text short"></div></td>
            <td><div class="skeleton skeleton-text short"></div></td>
            <td><div class="skeleton skeleton-text short"></div></td>
            <td><div class="skeleton skeleton-badge"></div></td>
            <td><div class="skeleton skeleton-text tiny"></div></td>
        </tr>
    `;

    try {
        const endpoint = search ? `/get_medicines?search=${encodeURIComponent(search)}` : '/get_medicines';
        const data = await apiCall(endpoint);
        allMedicines = data.medicines;
        renderMedicinesTable(allMedicines);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--rose-500)">${err.message}</td></tr>`;
    }
}

function renderMedicinesTable(medicines) {
    const tbody = document.getElementById('medicines-tbody');
    const user = Auth.getUser();

    if (!medicines.length) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">💊</div><p>No medicines found</p></div></td></tr>`;
        return;
    }

    tbody.innerHTML = medicines.map(m => {
        const canEdit = user && (user.role === 'admin' || user.role === 'lab_staff');
        const canDelete = user && user.role === 'admin';

        return `
        <tr>
            <td><strong>${m.name}</strong></td>
            <td>${m.manufacturer}</td>
            <td><code style="font-family:'DM Mono',monospace;font-size:12px;color:var(--cyan-500)">${m.batch_no}</code></td>
            <td>${formatDate(m.mfg_date)}</td>
            <td>${formatDate(m.exp_date)}</td>
            <td>${m.quality_status ? statusBadge(m.quality_status) : statusBadge('pending')}</td>
            <td>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <button class="btn btn-secondary btn-sm" onclick="viewReport(${m.medicine_id})">📋 Report</button>
                    ${canEdit ? `<button class="btn btn-secondary btn-sm" onclick="openEditModal(${m.medicine_id})">✏️ Edit</button>` : ''}
                    ${canDelete ? `<button class="btn btn-danger btn-sm" onclick="deleteMedicine(${m.medicine_id}, '${m.name}')">🗑️</button>` : ''}
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function addMedicine(e) {
    e.preventDefault();
    const btn = document.getElementById('add-medicine-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Adding...';

    try {
        const formData = {
            name: document.getElementById('med-name').value,
            manufacturer: document.getElementById('med-manufacturer').value,
            batch_no: document.getElementById('med-batch').value,
            mfg_date: document.getElementById('med-mfg').value,
            exp_date: document.getElementById('med-exp').value
        };

        await apiCall('/add_medicine', 'POST', formData);
        showToast('Medicine added successfully!');
        document.getElementById('add-medicine-form').reset();
        loadMedicines();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '+ Add Medicine';
    }
}

async function deleteMedicine(id, name) {
    if (!confirm(`Delete "${name}"? This will also remove all associated tests and reports.`)) return;

    try {
        await apiCall(`/delete_medicine/${id}`, 'DELETE');
        showToast('Medicine deleted.');
        loadMedicines();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// Edit modal
function openEditModal(id) {
    const med = allMedicines.find(m => m.medicine_id === id);
    if (!med) return;

    document.getElementById('edit-medicine-id').value = med.medicine_id;
    document.getElementById('edit-med-name').value = med.name;
    document.getElementById('edit-med-manufacturer').value = med.manufacturer;
    document.getElementById('edit-med-batch').value = med.batch_no;
    document.getElementById('edit-med-mfg').value = med.mfg_date;
    document.getElementById('edit-med-exp').value = med.exp_date;
    document.getElementById('edit-modal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('edit-modal').style.display = 'none';
}

async function saveEdit(e) {
    e.preventDefault();
    const id = document.getElementById('edit-medicine-id').value;

    try {
        await apiCall(`/update_medicine/${id}`, 'PUT', {
            name: document.getElementById('edit-med-name').value,
            manufacturer: document.getElementById('edit-med-manufacturer').value,
            batch_no: document.getElementById('edit-med-batch').value,
            mfg_date: document.getElementById('edit-med-mfg').value,
            exp_date: document.getElementById('edit-med-exp').value
        });
        showToast('Medicine updated!');
        closeEditModal();
        loadMedicines();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ─── Quality Testing ──────────────────────────────────────────────────────────

async function loadMedicineDropdown() {
    try {
        const data = await apiCall('/get_medicines');
        const select = document.getElementById('test-medicine-select');
        select.innerHTML = '<option value="">-- Select Medicine --</option>';
        data.medicines.forEach(m => {
            select.innerHTML += `<option value="${m.medicine_id}">${m.name} (${m.batch_no})</option>`;
        });
    } catch (err) { /* silent */ }
}

async function loadAllTests() {
    const tbody = document.getElementById('tests-tbody');
    tbody.innerHTML = `
        <tr class="skeleton-row">
            <td><div class="skeleton skeleton-text"></div></td>
            <td><div class="skeleton skeleton-text"></div></td>
            <td><div class="skeleton skeleton-text short"></div></td>
            <td><div class="skeleton skeleton-badge"></div></td>
            <td><div class="skeleton skeleton-text"></div></td>
            <td><div class="skeleton skeleton-text short"></div></td>
        </tr>
        <tr class="skeleton-row">
            <td><div class="skeleton skeleton-text"></div></td>
            <td><div class="skeleton skeleton-text"></div></td>
            <td><div class="skeleton skeleton-text short"></div></td>
            <td><div class="skeleton skeleton-badge"></div></td>
            <td><div class="skeleton skeleton-text"></div></td>
            <td><div class="skeleton skeleton-text short"></div></td>
        </tr>
    `;

    try {
        const data = await apiCall('/all_tests');
        if (!data.tests.length) {
            tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">🧪</div><p>No tests yet</p></div></td></tr>`;
            return;
        }

        tbody.innerHTML = data.tests.map(t => `
            <tr>
                <td><strong>${t.medicine_name}</strong></td>
                <td>${t.tested_by_name || '—'}</td>
                <td>${formatDate(t.test_date)}</td>
                <td>${statusBadge(t.result)}</td>
                <td>${t.remarks || '—'}</td>
                <td>
                    ${t.parameters ? Object.entries(t.parameters).map(([k,v]) =>
                        `<span style="font-family:'DM Mono',monospace;font-size:11px;color:var(--muted-foreground)">${k}: <strong style="color:var(--foreground)">${v}</strong></span>`
                    ).join(' &nbsp;|&nbsp; ') : '—'}
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--rose-500)">${err.message}</td></tr>`;
    }
}

async function addTest(e) {
    e.preventDefault();
    const btn = document.getElementById('add-test-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Submitting...';

    try {
        const paramsRaw = document.getElementById('test-params').value;
        let parameters = {};
        if (paramsRaw.trim()) {
            try { parameters = JSON.parse(paramsRaw); }
            catch(e) { throw new Error('Parameters must be valid JSON. Example: {"potency":"98%"}'); }
        }

        await apiCall('/add_test', 'POST', {
            medicine_id: parseInt(document.getElementById('test-medicine-select').value),
            result: document.getElementById('test-result').value,
            test_date: document.getElementById('test-date').value,
            remarks: document.getElementById('test-remarks').value,
            parameters
        });

        showToast('Test result saved!');
        document.getElementById('add-test-form').reset();
        loadAllTests();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '+ Add Test Result';
    }
}

// ─── Reports ──────────────────────────────────────────────────────────────────

async function loadReports(statusFilter = '') {
    const container = document.getElementById('reports-container');
    container.innerHTML = `
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr><th>Medicine</th><th>Manufacturer</th><th>Batch No</th><th>Status</th><th>Generated</th><th>By</th><th>Actions</th></tr>
                </thead>
                <tbody>
                    <tr class="skeleton-row">
                        <td><div class="skeleton skeleton-text"></div></td>
                        <td><div class="skeleton skeleton-text"></div></td>
                        <td><div class="skeleton skeleton-text short"></div></td>
                        <td><div class="skeleton skeleton-badge"></div></td>
                        <td><div class="skeleton skeleton-text short"></div></td>
                        <td><div class="skeleton skeleton-text"></div></td>
                        <td><div class="skeleton skeleton-text tiny"></div></td>
                    </tr>
                    <tr class="skeleton-row">
                        <td><div class="skeleton skeleton-text"></div></td>
                        <td><div class="skeleton skeleton-text"></div></td>
                        <td><div class="skeleton skeleton-text short"></div></td>
                        <td><div class="skeleton skeleton-badge"></div></td>
                        <td><div class="skeleton skeleton-text short"></div></td>
                        <td><div class="skeleton skeleton-text"></div></td>
                        <td><div class="skeleton skeleton-text tiny"></div></td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;

    try {
        const endpoint = statusFilter ? `/get_all_reports?status=${statusFilter}` : '/get_all_reports';
        const data = await apiCall(endpoint);

        if (!data.reports.length) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">📊</div><p>No reports found</p></div>`;
            return;
        }

        container.innerHTML = `
            <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th>Medicine</th>
                        <th>Manufacturer</th>
                        <th>Batch No</th>
                        <th>Status</th>
                        <th>Generated</th>
                        <th>By</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.reports.map(r => `
                        <tr>
                            <td><strong>${r.medicine_name}</strong></td>
                            <td>${r.manufacturer}</td>
                            <td><code style="font-family:'DM Mono',monospace;font-size:12px;color:var(--cyan-500)">${r.batch_no}</code></td>
                            <td>${statusBadge(r.status)}</td>
                            <td>${formatDate(r.generated_date)}</td>
                            <td>${r.generated_by_name || '—'}</td>
                            <td><button class="btn btn-secondary btn-sm" onclick="viewReport(${r.medicine_id})">📋 View Detail</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            </div>
        `;
    } catch (err) {
        container.innerHTML = `<div style="color:var(--rose-500);padding:20px">${err.message}</div>`;
    }
}

async function viewReport(medicineId) {
    const modal = document.getElementById('report-modal');
    const content = document.getElementById('report-modal-content');
    modal.style.display = 'flex';
    content.innerHTML = `
        <div class="skeleton" style="height: 100px; width: 100%; margin-bottom: 24px; border-radius: 12px;"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
            <div class="skeleton" style="height: 200px; border-radius: 12px;"></div>
            <div class="skeleton" style="height: 200px; border-radius: 12px;"></div>
        </div>
    `;

    try {
        const data = await apiCall(`/get_report/${medicineId}`);
        const m = data.medicine;
        const status = data.latest_status;
        const icons = { safe: '✅', unsafe: '❌', pending: '⏳' };

        content.innerHTML = `
            <div class="report-status-banner ${status}">
                <div class="status-icon">${icons[status] || '⏳'}</div>
                <div class="status-text">
                    <h2>${m.name}</h2>
                    <p>Quality Status: <strong>${status.toUpperCase()}</strong> &nbsp;·&nbsp; Batch: ${m.batch_no}</p>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
                <div class="card" style="margin:0">
                    <div class="card-title">📦 Medicine Details</div>
                    <table style="width:100%">
                        <tr><td style="color:var(--muted-foreground);padding:6px 0">Manufacturer</td><td>${m.manufacturer}</td></tr>
                        <tr><td style="color:var(--muted-foreground);padding:6px 0">Batch No.</td><td><code style="font-family:'DM Mono',monospace;color:var(--cyan-500)">${m.batch_no}</code></td></tr>
                        <tr><td style="color:var(--muted-foreground);padding:6px 0">Mfg. Date</td><td>${formatDate(m.mfg_date)}</td></tr>
                        <tr><td style="color:var(--muted-foreground);padding:6px 0">Exp. Date</td><td>${formatDate(m.exp_date)}</td></tr>
                    </table>
                </div>
                <div class="card" style="margin:0">
                    <div class="card-title">🧪 Test Summary</div>
                    ${data.test_summary ? `
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;text-align:center">
                        <div><div style="font-size:28px;font-weight:700;font-family:'DM Mono',monospace">${data.test_summary.total_tests}</div><div style="font-size:12px;color:var(--muted-foreground)">Total Tests</div></div>
                        <div><div style="font-size:28px;font-weight:700;color:var(--emerald-500);font-family:'DM Mono',monospace">${data.test_summary.passed}</div><div style="font-size:12px;color:var(--muted-foreground)">Passed</div></div>
                        <div><div style="font-size:28px;font-weight:700;color:var(--rose-500);font-family:'DM Mono',monospace">${data.test_summary.failed}</div><div style="font-size:12px;color:var(--muted-foreground)">Failed</div></div>
                        <div><div style="font-size:28px;font-weight:700;color:var(--amber-500);font-family:'DM Mono',monospace">${data.test_summary.pending}</div><div style="font-size:12px;color:var(--muted-foreground)">Pending</div></div>
                    </div>` : '<p style="color:var(--muted-foreground)">No tests conducted</p>'}
                </div>
            </div>

            ${data.latest_test ? `
            <div class="card" style="margin-bottom:24px">
                <div class="card-title">🔬 Latest Test Result</div>
                <div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap">
                    <div>${statusBadge(data.latest_test.result)}</div>
                    <div style="color:var(--muted-foreground);font-size:14px">Date: <strong style="color:var(--foreground)">${formatDate(data.latest_test.test_date)}</strong></div>
                    <div style="color:var(--muted-foreground);font-size:14px">By: <strong style="color:var(--foreground)">${data.latest_test.tested_by_name || '—'}</strong></div>
                </div>
                ${data.latest_test.remarks ? `<p style="margin-top:12px;color:var(--muted-foreground);font-size:14px">Remarks: ${data.latest_test.remarks}</p>` : ''}
                ${data.latest_test.parameters ? `
                <div style="margin-top:12px;display:flex;gap:16px;flex-wrap:wrap">
                    ${Object.entries(data.latest_test.parameters).map(([k,v]) => `
                        <div style="background:var(--accent);border:1px solid var(--border);border-radius:8px;padding:8px 14px">
                            <div style="font-family:'DM Mono',monospace;font-size:11px;color:var(--muted-foreground);text-transform:uppercase">${k}</div>
                            <div style="font-weight:600;font-size:16px">${v}</div>
                        </div>
                    `).join('')}
                </div>` : ''}
            </div>` : ''}
        `;
    } catch (err) {
        content.innerHTML = `<div style="color:var(--rose-500);padding:20px">${err.message}</div>`;
    }
}

function closeReportModal() {
    document.getElementById('report-modal').style.display = 'none';
}

// ─── Login / Logout ───────────────────────────────────────────────────────────

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Signing in...';
    errEl.style.display = 'none';

    try {
        const data = await apiCall('/login', 'POST', {
            email: document.getElementById('login-email').value,
            password: document.getElementById('login-password').value
        });

        Auth.save(data.token, data.user);
        window.location.href = 'dashboard.html';
    } catch (err) {
        errEl.textContent = err.message;
        errEl.style.display = 'flex';
        btn.disabled = false;
        btn.innerHTML = 'Sign In';
    }
}

function logout() {
    Auth.clear();
    window.location.href = 'index.html';
}

// ─── Guard: redirect to login if not authenticated ────────────────────────────

function requireAuth() {
    if (!Auth.isLoggedIn()) {
        window.location.href = 'index.html';
        return null;
    }
    return Auth.getUser();
}

function populateUserInfo() {
    const user = Auth.getUser();
    if (!user) return;

    const nameEl = document.getElementById('user-name-display');
    const roleEl = document.getElementById('user-role-display');
    const avatarEl = document.getElementById('user-avatar');

    if (nameEl) nameEl.textContent = user.name;
    if (roleEl) roleEl.textContent = user.role.replace('_', ' ');
    if (avatarEl) avatarEl.textContent = user.name.charAt(0).toUpperCase();
}

// Close modals on backdrop click
document.addEventListener('click', (e) => {
    if (e.target.id === 'edit-modal') closeEditModal();
    if (e.target.id === 'report-modal') closeReportModal();
});
