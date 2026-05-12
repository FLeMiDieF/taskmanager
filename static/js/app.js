const API = '';

function getToken() { return localStorage.getItem('access'); }
function getUser() { return JSON.parse(localStorage.getItem('user') || '{}'); }

async function api(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 401) { localStorage.clear(); location.href = '/login'; return; }
    return res;
}

function logout() { localStorage.clear(); location.href = '/login'; }

function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
    document.querySelector('.modal-overlay').classList.remove('hidden');
}
function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    document.querySelector('.modal-overlay').classList.add('hidden');
}
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
    document.querySelector('.modal-overlay').classList.add('hidden');
}

function priorityBadge(p) {
    const map = { high: ['badge-high', 'Высокий'], medium: ['badge-medium', 'Средний'], low: ['badge-low', 'Низкий'] };
    const [cls, label] = map[p] || ['badge-low', p];
    return `<span class="badge ${cls}">${label}</span>`;
}

function formatDeadline(d) {
    if (!d) return '';
    const dt = new Date(d);
    const overdue = dt < new Date();
    return `<span class="task-deadline ${overdue ? 'overdue' : ''}">⏰ ${dt.toLocaleDateString('ru')}</span>`;
}

// Показываем имя пользователя в навбаре
window.addEventListener('DOMContentLoaded', () => {
    const el = document.getElementById('nav-user');
    const u = getUser();
    if (el) el.textContent = u.username || u.email || '';
    if (!getToken() && !location.pathname.includes('login') && !location.pathname.includes('invite')) location.href = '/login';
});
