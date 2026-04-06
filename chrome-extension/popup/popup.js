const loginView = document.getElementById('login-view');
const statusView = document.getElementById('status-view');
const errorEl = document.getElementById('error');

async function showStatus() {
  const response = await chrome.runtime.sendMessage({ action: 'getStatus' });
  if (response.loggedIn) {
    loginView.style.display = 'none';
    statusView.style.display = 'block';
    document.getElementById('user-name').textContent = response.userName || 'مستخدم';
    updateToggle(response.paused);
  } else {
    loginView.style.display = 'block';
    statusView.style.display = 'none';
  }
}

function updateToggle(paused) {
  const badge = document.getElementById('status-badge');
  const btn = document.getElementById('toggle-btn');
  if (paused) {
    badge.innerHTML = '<span class="badge badge-paused">متوقف مؤقتاً</span>';
    btn.textContent = 'استئناف المراقبة';
  } else {
    badge.innerHTML = '<span class="badge badge-active">يراقب</span>';
    btn.textContent = 'إيقاف مؤقت';
  }
}

// Login
document.getElementById('login-btn').addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const apiUrl = document.getElementById('api-url').value.trim();

  if (!email || !password) {
    errorEl.textContent = 'أدخل البريد وكلمة المرور';
    errorEl.style.display = 'block';
    return;
  }

  errorEl.style.display = 'none';
  const result = await chrome.runtime.sendMessage({ action: 'login', email, password, apiUrl });

  if (result.success) {
    showStatus();
  } else {
    errorEl.textContent = result.error || 'فشل تسجيل الدخول';
    errorEl.style.display = 'block';
  }
});

// Toggle pause
document.getElementById('toggle-btn').addEventListener('click', async () => {
  const { paused } = await chrome.storage.local.get('paused');
  const newState = !paused;
  await chrome.storage.local.set({ paused: newState });
  updateToggle(newState);
});

// Logout
document.getElementById('logout-btn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ action: 'logout' });
  showStatus();
});

// Init
showStatus();
