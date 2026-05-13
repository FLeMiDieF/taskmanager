const projectUuid = new URLSearchParams(location.search).get('project');
let projectId = null;       // integer ID для API задач
let projectInviteToken = null;
let currentTaskId = null;
let projectMembers = [];
let projectOwner = null;
let projectAdminIds = [];

function isCurrentUserAdmin() {
    const me = getUser();
    if (!me || !projectOwner) return false;
    return me.id === projectOwner.id || projectAdminIds.includes(me.id);
}

// ─── Инициализация ────────────────────────────────────────────────

async function loadProject() {
    // Ищем проект по UUID
    const res = await api('GET', `/api/projects/?uuid=${projectUuid}`);
    if (!res.ok) { location.href = '/'; return; }
    const list = await res.json();
    if (!list.length) { location.href = '/'; return; }
    const p = list[0];
    projectId = p.id;
    projectInviteToken = p.invite_token || null;
    document.getElementById('project-title').textContent = p.name;
    document.title = p.name + ' — TaskManager';
}

async function loadMembers() {
    if (!projectId) return;
    const res = await api('GET', `/api/projects/${projectId}/members/`);
    if (!res.ok) return;
    const data = await res.json();
    projectOwner = data.owner;
    projectMembers = data.members;
    projectAdminIds = data.admin_ids || [];
    renderMemberAvatars();
    renderMembersModal();
    populateAssigneeSelects();
    applyRoleUI();
}

function applyRoleUI() {
    const admin = isCurrentUserAdmin();
    // Кнопка "+ Новая задача"
    document.querySelectorAll('[onclick="openCreateTask()"]').forEach(b => b.classList.toggle('hidden', !admin));
    // Включить/выключить drag-and-drop
    document.querySelectorAll('.task-card').forEach(c => c.draggable = admin);
}

// ─── Аватары в navbar ─────────────────────────────────────────────

function avatarInitials(user) {
    const name = user.username || user.email || '?';
    return name.slice(0, 2).toUpperCase();
}

function avatarColor(user) {
    const colors = ['#6366f1','#22c55e','#f59e0b','#ef4444','#06b6d4','#a855f7','#ec4899'];
    let hash = 0;
    for (const c of (user.email || '')) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
    return colors[hash % colors.length];
}

function renderMemberAvatars() {
    const wrap = document.getElementById('members-avatars');
    const all = projectOwner ? [{ ...projectOwner, _owner: true }, ...projectMembers] : projectMembers;
    wrap.innerHTML = all.slice(0, 5).map(u => `
        <div class="member-avatar" style="background:${avatarColor(u)}" title="${u.username} (${u.email})${u._owner ? ' — владелец' : ''}">
            ${avatarInitials(u)}
        </div>
    `).join('');
    if (all.length > 5) {
        wrap.innerHTML += `<div class="member-avatar member-avatar-more">+${all.length - 5}</div>`;
    }
}

// ─── Модалка участников ───────────────────────────────────────────

function renderMembersModal() {
    const me = getUser();
    const isOwner = me && projectOwner && me.id === projectOwner.id;

    const list = document.getElementById('members-list');
    const all = projectOwner ? [{ ...projectOwner, _owner: true }, ...projectMembers] : projectMembers;

    list.innerHTML = all.map(u => {
        const isAdmin = projectAdminIds.includes(u.id);
        let badge;
        if (u._owner) badge = '<span class="role-badge role-owner">Владелец</span>';
        else if (isAdmin) badge = '<span class="role-badge role-owner">Админ</span>';
        else badge = '<span class="role-badge role-member">Участник</span>';

        let actions = '';
        if (isOwner && !u._owner) {
            actions += isAdmin
                ? `<button class="btn btn-outline btn-sm" onclick="toggleAdmin(${u.id}, false)">Снять админа</button>`
                : `<button class="btn btn-outline btn-sm" onclick="toggleAdmin(${u.id}, true)">Сделать админом</button>`;
            actions += `<button class="btn btn-danger btn-sm" onclick="removeMember(${u.id})">✕</button>`;
        }

        return `
            <div class="member-row">
                <div class="member-avatar-sm" style="background:${avatarColor(u)}">${avatarInitials(u)}</div>
                <div class="member-info">
                    <span class="member-name">${u.username}</span>
                    <span class="member-email">${u.email}</span>
                </div>
                <div class="member-badges">${badge}</div>
                ${actions}
            </div>
        `;
    }).join('') || '<p class="empty-col">Участников пока нет</p>';

    // Показать/скрыть секцию приглашения (только владелец)
    document.getElementById('invite-section').classList.toggle('hidden', !isOwner);

    // Кнопка "Покинуть" — только для участников (не владелец)
    const isMember = me && projectMembers.some(u => u.id === me.id);
    document.getElementById('leave-btn').classList.toggle('hidden', !isMember);

    // Кнопка копирования инвайт-ссылки (только владелец)
    const copyBtn = document.getElementById('copy-invite-btn');
    if (copyBtn) copyBtn.classList.toggle('hidden', !isOwner);
}

function copyInviteLink() {
    if (!projectInviteToken) return;
    const link = `${location.origin}/invite?token=${projectInviteToken}`;
    navigator.clipboard.writeText(link).then(() => {
        const btn = document.getElementById('copy-invite-btn');
        const orig = btn.textContent;
        btn.textContent = '✅ Скопировано!';
        setTimeout(() => btn.textContent = orig, 2000);
    });
}

function populateAssigneeSelects() {
    const all = projectOwner ? [projectOwner, ...projectMembers] : projectMembers;
    const options = '<option value="">— Не назначен —</option>' +
        all.map(u => `<option value="${u.id}">${u.username} (${u.email})</option>`).join('');

    document.getElementById('task-assignee').innerHTML = options;

    const filterSelect = document.getElementById('filter-assignee');
    filterSelect.innerHTML = '<option value="">Все исполнители</option>' +
        all.map(u => `<option value="${u.id}">${u.username}</option>`).join('');
}

async function inviteMember() {
    const username = document.getElementById('invite-username').value.trim();
    const errEl = document.getElementById('invite-error');
    const okEl = document.getElementById('invite-success');
    errEl.classList.add('hidden');
    okEl.classList.add('hidden');

    if (!username) { errEl.textContent = 'Введите имя пользователя'; errEl.classList.remove('hidden'); return; }

    const res = await api('POST', `/api/projects/${projectId}/members/`, { username });
    const data = await res.json();

    if (!res.ok) {
        errEl.textContent = data.detail || 'Ошибка';
        errEl.classList.remove('hidden');
        return;
    }

    okEl.textContent = `${data.username} добавлен в проект`;
    okEl.classList.remove('hidden');
    document.getElementById('invite-username').value = '';
    await loadMembers();
}

async function leaveProject() {
    if (!confirm('Покинуть проект?')) return;
    const res = await api('POST', `/api/projects/${projectId}/leave/`);
    if (res.ok) location.href = '/';
}

async function removeMember(userId) {
    const res = await api('DELETE', `/api/projects/${projectId}/members/${userId}/`);
    if (res.ok) await loadMembers();
}

async function toggleAdmin(userId, makeAdmin) {
    const method = makeAdmin ? 'POST' : 'DELETE';
    const res = await api(method, `/api/projects/${projectId}/admins/${userId}/`);
    if (res.ok) await loadMembers();
}

function openCreateTask() {
    document.getElementById('task-title').value = '';
    document.getElementById('task-desc').value = '';
    document.getElementById('task-deadline').value = '';
    document.getElementById('task-assignee').value = '';
    document.getElementById('task-error').classList.add('hidden');
    openModal('create-task-modal');
}

// ─── Задачи ───────────────────────────────────────────────────────

async function loadTasks() {
    const priority = document.getElementById('filter-priority').value;
    const assignee = document.getElementById('filter-assignee').value;
    let url = `/api/tasks/?project=${projectId}`;
    if (priority) url += `&priority=${priority}`;
    if (assignee) url += `&assignee=${assignee}`;
    const res = await api('GET', url);
    const tasks = await res.json();

    ['todo', 'in_progress', 'review', 'done'].forEach(s => {
        document.getElementById('col-' + s).innerHTML = '';
    });

    if (!tasks.length) {
        document.getElementById('col-todo').innerHTML = '<p class="empty-col">Задач нет</p>';
        return;
    }

    tasks.forEach(task => {
        const col = document.getElementById('col-' + task.status);
        if (!col) return;
        const card = document.createElement('div');
        card.className = 'task-card';
        card.draggable = isCurrentUserAdmin();
        card.dataset.id = task.id;

        const assigneeHtml = task.assignee
            ? `<div class="member-avatar member-avatar-xs" style="background:${avatarColor(task.assignee)}" title="${task.assignee.username}">${avatarInitials(task.assignee)}</div>`
            : '';

        card.innerHTML = `
            <h4>${task.title}</h4>
            <div class="task-card-footer">
                ${priorityBadge(task.priority)}
                <div style="display:flex;align-items:center;gap:6px">
                    ${formatDeadline(task.deadline)}
                    ${assigneeHtml}
                </div>
            </div>
        `;
        card.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', task.id));
        card.addEventListener('click', () => openTask(task));
        col.appendChild(card);
    });
}

function openTask(task) {
    currentTaskId = task.id;
    document.getElementById('edit-task-title').value = task.title || '';
    document.getElementById('edit-task-desc').value = task.description || '';
    document.getElementById('edit-task-priority').value = task.priority || 'medium';

    // datetime-local требует формат YYYY-MM-DDTHH:MM (без секунд/таймзоны)
    if (task.deadline) {
        const d = new Date(task.deadline);
        const pad = n => String(n).padStart(2, '0');
        const local = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        document.getElementById('edit-task-deadline').value = local;
    } else {
        document.getElementById('edit-task-deadline').value = '';
    }

    document.getElementById('edit-task-assignee').value = task.assignee ? task.assignee.id : '';
    document.getElementById('edit-task-error').classList.add('hidden');

    // Read-only режим для не-админов
    const admin = isCurrentUserAdmin();
    ['edit-task-title','edit-task-desc','edit-task-priority','edit-task-deadline','edit-task-assignee']
        .forEach(id => document.getElementById(id).disabled = !admin);
    document.querySelectorAll('#view-task-modal [onclick="saveTask()"], #view-task-modal [onclick="deleteCurrentTask()"]')
        .forEach(b => b.classList.toggle('hidden', !admin));

    openModal('view-task-modal');
}

async function saveTask() {
    if (!currentTaskId) return;
    const title = document.getElementById('edit-task-title').value.trim();
    const description = document.getElementById('edit-task-desc').value.trim();
    const priority = document.getElementById('edit-task-priority').value;
    const deadline = document.getElementById('edit-task-deadline').value;
    const assigneeId = document.getElementById('edit-task-assignee').value;
    const errEl = document.getElementById('edit-task-error');

    if (!title) {
        errEl.textContent = 'Введите название';
        errEl.classList.remove('hidden');
        return;
    }

    const body = {
        title,
        description,
        priority,
        deadline: deadline ? new Date(deadline).toISOString() : null,
        assignee_id: assigneeId ? parseInt(assigneeId) : null,
    };

    const res = await api('PATCH', `/api/tasks/${currentTaskId}/`, body);
    if (!res.ok) {
        errEl.textContent = 'Ошибка сохранения';
        errEl.classList.remove('hidden');
        return;
    }

    closeModal('view-task-modal');
    loadTasks();
}

async function deleteCurrentTask() {
    if (!currentTaskId) return;
    await api('DELETE', `/api/tasks/${currentTaskId}/`);
    closeModal('view-task-modal');
    loadTasks();
}

async function createTask() {
    const title = document.getElementById('task-title').value.trim();
    const description = document.getElementById('task-desc').value.trim();
    const priority = document.getElementById('task-priority').value;
    const deadline = document.getElementById('task-deadline').value;
    const assigneeId = document.getElementById('task-assignee').value;
    const errEl = document.getElementById('task-error');

    if (!title) { errEl.textContent = 'Введите название'; errEl.classList.remove('hidden'); return; }

    const body = { title, description, priority, project: parseInt(projectId) };
    if (deadline) body.deadline = new Date(deadline).toISOString();
    if (assigneeId) body.assignee_id = parseInt(assigneeId);

    const res = await api('POST', '/api/tasks/', body);
    if (!res.ok) { errEl.textContent = 'Ошибка создания задачи'; errEl.classList.remove('hidden'); return; }

    closeModal('create-task-modal');
    loadTasks();
}

// ─── Drag & Drop ──────────────────────────────────────────────────

function allowDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
}

async function dropTask(e, status) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    if (!isCurrentUserAdmin()) return;
    const taskId = e.dataTransfer.getData('text/plain');
    await api('PATCH', `/api/tasks/${taskId}/`, { status });
    loadTasks();
}

document.querySelectorAll('.col-body').forEach(col => {
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
});

// ─── Старт ────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', async () => {
    if (!projectUuid) { location.href = '/'; return; }

    const user = getUser();
    if (user) document.getElementById('nav-user').textContent = user.username || user.email;

    // Сначала грузим проект (получаем integer id), потом всё остальное
    await loadProject();
    if (!projectId) return; // редирект уже произошёл

    loadMembers();
    loadTasks();

    // WebSocket для real-time обновлений
    const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    let ws;

    function connectWs() {
        ws = new WebSocket(`${wsProtocol}//${location.host}/ws/projects/${projectId}/tasks/`);
        ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                if (msg.type === 'member_update') {
                    loadMembers();
                } else if (msg.deleted) {
                    document.querySelector(`.task-card[data-id="${msg.task_id}"]`)?.remove();
                } else {
                    loadTasks();
                }
            } catch {
                loadTasks();
            }
        };
        ws.onclose = () => setTimeout(connectWs, 3000);
    }

    connectWs();
});
