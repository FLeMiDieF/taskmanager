function showTab(tab) {
    document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
    document.querySelectorAll('.tab').forEach((t, i) => t.classList.toggle('active', (i === 0) === (tab === 'login')));
}

async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.classList.add('hidden');
    const res = await fetch('/api/auth/token/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) { errEl.textContent = 'Неверный email или пароль'; errEl.classList.remove('hidden'); return; }
    localStorage.setItem('access', data.access);
    localStorage.setItem('refresh', data.refresh);
    const me = await fetch('/api/users/me/', { headers: { Authorization: 'Bearer ' + data.access } });
    localStorage.setItem('user', JSON.stringify(await me.json()));
    location.href = '/';
}

async function register() {
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const errEl = document.getElementById('reg-error');
    errEl.classList.add('hidden');
    const res = await fetch('/api/auth/register/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
    });
    const data = await res.json();
    if (!res.ok) {
        errEl.textContent = Object.values(data).flat().join(' ');
        errEl.classList.remove('hidden'); return;
    }
    document.getElementById('login-email').value = email;
    showTab('login');
    document.getElementById('login-error').textContent = '✅ Аккаунт создан! Войдите.';
    document.getElementById('login-error').style.background = '#052e16';
    document.getElementById('login-error').style.color = '#86efac';
    document.getElementById('login-error').classList.remove('hidden');
}

if (!localStorage.getItem('access')) {} else { location.href = '/'; }
