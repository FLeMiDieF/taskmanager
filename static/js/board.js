const projectId = new URLSearchParams(location.search).get('project');
let currentTaskId = null;

async function loadProject() {
    const res = await api('GET', `/api/projects/${projectId}/`);
    const p = await res.json();
    document.getElementById('project-title').textContent = p.name;
    document.title = p.name + ' — TaskManager';
}

async function loadTasks() {
    const priority = document.getElementById('filter-priority').value;
    let url = `/api/tasks/?project=${projectId}`;
    if (priority) url += `&priority=${priority}`;
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
        card.innerHTML = `
            <h4>${task.title}</h4>
            <div class="task-card-footer">
                ${priorityBadge(task.priority)}
                ${formatDeadline(task.deadline)}
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
    const errEl = document.getElementById('task-error');
    if (!title) { errEl.textContent = 'Введите название'; errEl.classList.remove('hidden'); return; }
    const body = { title, description, priority, project: parseInt(projectId) };
    if (deadline) body.deadline = new Date(deadline).toISOString();
    const res = await api('POST', '/api/tasks/', body);
    if (!res.ok) { errEl.textContent = 'Ошибка создания задачи'; errEl.classList.remove('hidden'); return; }
    closeModal('create-task-modal');
    document.getElementById('task-title').value = '';
    document.getElementById('task-desc').value = '';
    loadTasks();
}

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

window.addEventListener('DOMContentLoaded', () => {
    if (!projectId) { location.href = '/'; return; }
    loadProject();
    loadTasks();

    // WebSocket для real-time обновлений
    const ws = new WebSocket(`ws://${location.host}/ws/projects/${projectId}/tasks/`);
    ws.onmessage = () => loadTasks();
});
