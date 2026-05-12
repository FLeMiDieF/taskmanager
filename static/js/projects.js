async function loadProjects() {
    const res = await api('GET', '/api/projects/');
    const projects = await res.json();
    const grid = document.getElementById('projects-grid');
    const me = getUser();

    if (!projects.length) {
        grid.innerHTML = '<p class="loading">Проектов пока нет. Создайте первый!</p>';
        return;
    }

    grid.innerHTML = projects.map(p => {
        const isOwner = me && p.owner.id === me.id;
        return `
        <div class="project-card" onclick="location.href='/board?project=${p.uuid}'">
            <h2>${p.name}</h2>
            <p>${p.description || 'Без описания'}</p>
            <div class="project-card-footer">
                <span>👤 ${p.owner.username}</span>
                <span>${new Date(p.created_at).toLocaleDateString('ru')}</span>
            </div>
            <div class="project-card-actions" onclick="event.stopPropagation()">
                ${isOwner
                    ? `<button class="btn btn-danger btn-sm" onclick="deleteProject(${p.id})">🗑 Удалить</button>`
                    : `<button class="btn btn-outline btn-sm" onclick="leaveProject(${p.id})">🚪 Покинуть</button>`
                }
            </div>
        </div>
        `;
    }).join('');
}

async function deleteProject(id) {
    if (!confirm('Удалить проект? Все задачи будут удалены.')) return;
    await api('DELETE', `/api/projects/${id}/`);
    loadProjects();
}

async function leaveProject(id) {
    if (!confirm('Покинуть проект?')) return;
    const res = await api('POST', `/api/projects/${id}/leave/`);
    if (res.ok) loadProjects();
}

async function createProject() {
    const name = document.getElementById('project-name').value.trim();
    const description = document.getElementById('project-desc').value.trim();
    const errEl = document.getElementById('project-error');
    if (!name) { errEl.textContent = 'Введите название'; errEl.classList.remove('hidden'); return; }
    const res = await api('POST', '/api/projects/', { name, description });
    if (!res.ok) { errEl.textContent = 'Ошибка создания'; errEl.classList.remove('hidden'); return; }
    closeModal('create-project-modal');
    document.getElementById('project-name').value = '';
    document.getElementById('project-desc').value = '';
    loadProjects();
}

window.addEventListener('DOMContentLoaded', loadProjects);
