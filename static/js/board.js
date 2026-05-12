const projectId = new URLSearchParams(location.search).get('project');
let currentTaskId = null;
let projectMembers = [];   // [{id, username, email}, ...]
let projectOwner = null;   // {id, username, email}

// ─── Инициализация ────────────────────────────────────────────────

async function loadProject() {
    const res = await api('GET', `/api/projects/${projectId}/`);
    if (!res.ok) {
        // Нет доступа или проект не существует — редирект на главную
        location.href = '/';
        return;
    }
    const p = await res.json();
    document.getElementById('project-title').textContent = p.name;
    document.title = p.name + ' — TaskManager';
}

async function loadMembers() {
    const res = await api('GET', `/api/projects/${projectId}/members/`);
    if (!res.ok) return;
    const data = await res.json();
    projectOwner = data.owner;
    projectMembers = data.members;
    renderMemberAvatars();
    renderMembersModal();
    populateAssigneeSelects();
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

    list.innerHTML = all.map(u => `
        <div class="member-row">
            <div class="member-avatar-sm" style="background:${avatarColor(u)}">${avatarInitials(u)}</div>
            <div class="member-info">
                <span class="member-name">${u.username}</span>
                <span class="member-email">${u.email}</span>
            </div>
            <div class="member-badges">
                ${u._owner ? '<span class="role-badge role-owner">Владелец</span>' : '<span class="role-badge role-member">Участник</span>'}
            </div>
            ${isOwner && !u._owner
                ? `<button class="btn btn-danger btn-sm" onclick="removeMember(${u.id})">✕</button>`
                : ''}
        </div>
    `).join('') || '<p class="empty-col">Участников пока нет</p>';

    // Показать/скрыть секцию приглашения (только владелец)
    document.getElementById('invite-section').classList.toggle('hidden', !isOwner);

    // Кнопка "Покинуть" — только для участников (не владелец)
    const isMember = me && projectMembers.some(u => u.id === me.id);
    document.getElementById('leave-btn').classList.toggle('hidden', !isMember);
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
        card.draggable = true;
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
    document.getElementById('view-task-title').textContent = task.title;
    document.getElementById('view-task-desc').textContent = task.description || 'Описание отсутствует';
    document.getElementById('view-task-priority').outerHTML = priorityBadge(task.priority);
    document.getElementById('view-task-deadline').innerHTML = formatDeadline(task.deadline);

    const assigneeRow = document.getElementById('view-task-assignee');
    if (task.assignee) {
        assigneeRow.classList.remove('hidden');
        assigneeRow.innerHTML = `
            <div class="member-avatar-sm" style="background:${avatarColor(task.assignee)}">${avatarInitials(task.assignee)}</div>
            <span class="assignee-label">Исполнитель: <strong>${task.assignee.username}</strong> (${task.assignee.email})</span>
        `;
    } else {
        assigneeRow.classList.add('hidden');
    }

    openModal('view-task-modal');
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
    const taskId = e.dataTransfer.getData('text/plain');
    await api('PATCH', `/api/tasks/${taskId}/`, { status });
    loadTasks();
}

document.querySelectorAll('.col-body').forEach(col => {
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
});

// ─── Старт ────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
    if (!projectId) { location.href = '/'; return; }

    const user = getUser();
    if (user) document.getElementById('nav-user').textContent = user.username || user.email;

    loadProject();
    loadMembers();
    loadTasks();

    // WebSocket для real-time обновлений
    const ws = new WebSocket(`ws://${location.host}/ws/projects/${projectId}/tasks/`);
    ws.onmessage = () => loadTasks();
});
