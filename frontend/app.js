(function () {
  let mode = 'login';
  let accessToken = localStorage.getItem('repartir_access_token') || '';
  let refreshToken = localStorage.getItem('repartir_refresh_token') || '';
  let currentUser = JSON.parse(localStorage.getItem('repartir_user') || 'null');
  const sseResults = {};

  const authStatusPill = document.getElementById('authStatusPill');
  const btnLogout = document.getElementById('btnLogout');
  const authForm = document.getElementById('authForm');
  const usernameGroup = document.getElementById('usernameGroup');
  const usernameInput = document.getElementById('username');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const btnAuthSubmit = document.getElementById('btnAuthSubmit');
  const createListForm = document.getElementById('createListForm');
  const listTitleInput = document.getElementById('listTitle');
  const idempotencyKeyInput = document.getElementById('idempotencyKey');
  const btnGenKey = document.getElementById('btnGenKey');
  const btnRefreshLists = document.getElementById('btnRefreshLists');
  const listsContainer = document.getElementById('listsContainer');
  const httpLog = document.getElementById('httpLog');
  const btnClearLog = document.getElementById('btnClearLog');

  function appendLog(method, endpoint, status, payload, type) {
    const entry = document.createElement('div');
    const level = type || (status >= 200 && status < 300 ? 'ok' : 'err');
    entry.className = 'log-entry ' + level;
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
    entry.textContent = `[${method} ${endpoint}] -> HTTP ${status}: ${text}`;
    httpLog.prepend(entry);
  }

  function generateKey() {
    idempotencyKeyInput.value = 'idem-' + Math.random().toString(36).substring(2, 10);
  }

  function updateSessionUI() {
    if (accessToken && currentUser) {
      authStatusPill.textContent = `Conectado: ${currentUser.username || currentUser.email}`;
      authStatusPill.classList.add('online');
      btnLogout.classList.remove('hidden');
      loadLists();
    } else {
      authStatusPill.textContent = 'No autenticado';
      authStatusPill.classList.remove('online');
      btnLogout.classList.add('hidden');
      listsContainer.innerHTML =
        '<div class="empty-state">Iniciá sesión para consultar y gestionar tus listas.</div>';
    }
  }

  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      mode = btn.getAttribute('data-tab');
      if (mode === 'register') {
        usernameGroup.style.display = 'block';
        btnAuthSubmit.textContent = 'Crear Cuenta';
      } else {
        usernameGroup.style.display = 'none';
        btnAuthSubmit.textContent = 'Iniciar Sesión';
      }
    });
  });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const username = usernameInput.value.trim();

    const endpoint = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const body = mode === 'register' ? { username, email, password } : { email, password };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    appendLog('POST', endpoint, res.status, data);

    if (res.ok && mode === 'login') {
      accessToken = data.accessToken || data.token;
      refreshToken = data.refreshToken || '';
      currentUser = data.user;
      localStorage.setItem('repartir_access_token', accessToken);
      localStorage.setItem('repartir_refresh_token', refreshToken);
      localStorage.setItem('repartir_user', JSON.stringify(currentUser));
      updateSessionUI();
    }
  });

  btnLogout.addEventListener('click', async () => {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await res.json();
    appendLog('POST', '/api/auth/logout', res.status, data);

    accessToken = '';
    refreshToken = '';
    currentUser = null;
    localStorage.removeItem('repartir_access_token');
    localStorage.removeItem('repartir_refresh_token');
    localStorage.removeItem('repartir_user');
    updateSessionUI();
  });

  createListForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = listTitleInput.value.trim();
    const idemKey = idempotencyKeyInput.value.trim();

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    };
    if (idemKey) {
      headers['Idempotency-Key'] = idemKey;
    }

    const res = await fetch('/api/lists', {
      method: 'POST',
      headers,
      body: JSON.stringify({ title }),
    });
    const data = await res.json();
    appendLog('POST', '/api/lists', res.status, data);

    if (res.ok) {
      loadLists();
    }
  });

  async function loadLists() {
    if (!accessToken) return;
    const res = await fetch('/api/lists/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ page: 1, limit: 20 }),
    });
    const data = await res.json();
    if (!res.ok) {
      appendLog('POST', '/api/lists/search', res.status, data);
      return;
    }
    renderLists(data.lists || []);
  }

  function subscribeSse(listId) {
    const url = `/api/lists/${listId}/events?token=${encodeURIComponent(accessToken)}`;
    const source = new EventSource(url);

    source.addEventListener('list_processed', (ev) => {
      const payload = JSON.parse(ev.data);
      sseResults[listId] = payload;
      appendLog('SSE', `/api/lists/${listId}/events`, 200, payload, 'sse');
      source.close();
      loadLists();
    });

    source.onerror = () => {
      source.close();
    };
  }

  window.changeListStatus = async function (listId, targetStatus) {
    const endpoint = `/api/lists/${listId}/status`;
    const res = await fetch(endpoint, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ status: targetStatus }),
    });
    const data = await res.json();
    appendLog('PATCH', endpoint, res.status, data);

    if (res.ok) {
      if (targetStatus === 'CONFIRMADA') {
        subscribeSse(listId);
      }
      loadLists();
    }
  };

  function renderLists(lists) {
    if (!lists.length) {
      listsContainer.innerHTML = '<div class="empty-state">Aún no creaste ninguna lista.</div>';
      return;
    }

    listsContainer.innerHTML = lists
      .map((item) => {
        const sseInfo = sseResults[item.id]
          ? `<div class="sse-banner">⚡ Worker Thread #${sseResults[item.id].processedInThread}: ${sseResults[item.id].summary} (Hash: ${sseResults[item.id].checksum})</div>`
          : '';
        return `
        <div class="list-item">
          <div class="list-item-header">
            <span class="list-title">${item.title}</span>
            <span class="badge badge-${item.status}">${item.status}</span>
          </div>
          <div class="list-meta">ID: <code>${item.id}</code></div>
          ${sseInfo}
          <div class="actions-row">
            <button class="btn btn-sm btn-success" onclick="changeListStatus('${item.id}', 'CONFIRMADA')">
              ➔ CONFIRMADA
            </button>
            <button class="btn btn-sm btn-danger" onclick="changeListStatus('${item.id}', 'ELIMINADA')">
              ➔ ELIMINADA
            </button>
            <button class="btn btn-sm btn-secondary" onclick="changeListStatus('${item.id}', 'BORRADOR')">
              ➔ BORRADOR (Probar Rechazo 400)
            </button>
          </div>
        </div>
      `;
      })
      .join('');
  }

  btnGenKey.addEventListener('click', generateKey);
  btnRefreshLists.addEventListener('click', loadLists);
  btnClearLog.addEventListener('click', () => {
    httpLog.innerHTML = '';
  });

  generateKey();
  updateSessionUI();
})();
