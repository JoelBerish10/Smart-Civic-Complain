// script.js — CampusLoop login/signup logic with real API calls

const API = window.location.origin;

const roleTabs = document.getElementById('roleTabs');
const panels = {
    student: ['student-login', 'student-signup'],
    admin: ['admin-login']
};

function showRole(role) {
    roleTabs.dataset.active = role;
    roleTabs.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.role === role));
    Object.values(panels).flat().forEach(id => document.getElementById(id).style.display = 'none');
    if (role === 'student') {
        document.getElementById('student-login').style.display = 'block';
    } else {
        document.getElementById('admin-login').style.display = 'block';
    }
}

roleTabs.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => showRole(btn.dataset.role));
});

function showSub(sub) {
    document.getElementById('student-login').style.display = sub === 'login' ? 'block' : 'none';
    document.getElementById('student-signup').style.display = sub === 'signup' ? 'block' : 'none';
    document.querySelectorAll('.subtoggle button').forEach(b => {
        b.classList.toggle('active', b.dataset.sub === sub);
    });
}

document.querySelectorAll('.subtoggle button').forEach(btn => {
    btn.addEventListener('click', () => showSub(btn.dataset.sub));
});

document.querySelectorAll('[data-goto-sub]').forEach(btn => {
    btn.addEventListener('click', () => showSub(btn.dataset.gotoSub));
});

// password show/hide
document.querySelectorAll('.pwtoggle').forEach(btn => {
    btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        const isPw = input.type === 'password';
        input.type = isPw ? 'text' : 'password';
        btn.textContent = isPw ? 'Hide' : 'Show';
    });
});

// toast
let toastTimer;
function toast(msg, isError) {
    const t = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    t.classList.toggle('error', !!isError);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

function setErr(field, on) {
    field.classList.toggle('has-err', on);
}

const emailLike = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// ── helper: call API ──────────────────────────────────────────────────
async function apiCall(endpoint, body) {
    const res = await fetch(API + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
    });
    const data = await res.json();
    return { ok: res.ok, status: res.status, data };
}

// ── student login ─────────────────────────────────────────────────────
document.getElementById('formStudentLogin').addEventListener('submit', async e => {
    e.preventDefault();
    const idField = e.target.querySelector('[data-field="id"]');
    const pwField = e.target.querySelector('[data-field="pw"]');
    const idVal = document.getElementById('sl-id').value.trim();
    const pwVal = document.getElementById('sl-pw').value;

    setErr(idField, !idVal);
    setErr(pwField, !pwVal);
    if (!idVal || !pwVal) return;

    const { ok, data } = await apiCall('/api/login', { email: idVal, password: pwVal });

    if (!ok) {
        if (data.error && data.error.includes('No account')) {
            setErr(idField, true);
            idField.querySelector('.err').textContent = data.error;
        } else if (data.error && data.error.includes('password')) {
            setErr(pwField, true);
        }
        toast(data.error || 'Login failed.', true);
        return;
    }

    toast('Welcome back, ' + data.user.name.split(' ')[0] + '!');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
});

// ── student signup ────────────────────────────────────────────────────
document.getElementById('formStudentSignup').addEventListener('submit', async e => {
    e.preventDefault();
    const f = id => e.target.querySelector('[data-field="' + id + '"]');
    const name = document.getElementById('ss-name').value.trim();
    const dept = document.getElementById('ss-dept').value;
    const year = document.getElementById('ss-year').value;
    const email = document.getElementById('ss-email').value.trim();
    const pw = document.getElementById('ss-pw').value;
    const cpw = document.getElementById('ss-cpw').value;

    let ok = true;
    setErr(f('name'), !name); if (!name) ok = false;
    setErr(f('dept'), !dept); if (!dept) ok = false;
    setErr(f('year'), !year); if (!year) ok = false;
    setErr(f('email'), !emailLike(email)); if (!emailLike(email)) ok = false;
    setErr(f('pw'), pw.length < 8); if (pw.length < 8) ok = false;
    setErr(f('cpw'), cpw !== pw || !cpw); if (cpw !== pw || !cpw) ok = false;

    if (!ok) return;

    const result = await apiCall('/api/register', { name, email, department: dept, year, password: pw });

    if (!result.ok) {
        if (result.status === 409) {
            setErr(f('email'), true);
            f('email').querySelector('.err').textContent = result.data.error;
        }
        toast(result.data.error || 'Registration failed.', true);
        return;
    }

    toast('Account created! You can log in now.');
    e.target.reset();
    setTimeout(() => showSub('login'), 900);
});

// ── admin login ───────────────────────────────────────────────────────
document.getElementById('formAdminLogin').addEventListener('submit', async e => {
    e.preventDefault();
    const idField = e.target.querySelector('[data-field="id"]');
    const pwField = e.target.querySelector('[data-field="pw"]');
    const idVal = document.getElementById('al-id').value.trim();
    const pwVal = document.getElementById('al-pw').value;

    setErr(idField, !idVal);
    setErr(pwField, !pwVal);
    if (!idVal || !pwVal) return;

    const { ok, data } = await apiCall('/api/login', { email: idVal, password: pwVal });

    if (!ok) {
        if (data.error && data.error.includes('No account')) {
            setErr(idField, true);
        } else if (data.error && data.error.includes('password')) {
            setErr(pwField, true);
        }
        toast(data.error || 'Login failed.', true);
        return;
    }

    toast('Admin session started for ' + data.user.name);
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 800);
});
