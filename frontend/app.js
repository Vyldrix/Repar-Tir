(function () {
  let mode = 'login';
  let currentView = 'active'; // 'active' | 'trash'
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
  const participantsCountInput = document.getElementById('participantsCount');
  const idempotencyKeyInput = document.getElementById('idempotencyKey');
  const btnGenKey = document.getElementById('btnGenKey');
  const btnRefreshLists = document.getElementById('btnRefreshLists');
  const listsContainer = document.getElementById('listsContainer');
  const httpLog = document.getElementById('httpLog');
  const btnClearLog = document.getElementById('btnClearLog');

  // Papelera elements
  const tabActiveView = document.getElementById('tabActiveView');
  const tabTrashView = document.getElementById('tabTrashView');
  const activeViewContainer = document.getElementById('activeViewContainer');
  const trashViewContainer = document.getElementById('trashViewContainer');
  const trashContainer = document.getElementById('trashContainer');
  const trashBadgeCount = document.getElementById('trashBadgeCount');
  const btnRefreshTrash = document.getElementById('btnRefreshTrash');
  const btnPurgeTrash = document.getElementById('btnPurgeTrash');

  function appendLog(method, endpoint, status, payload, type) {
    const entry = document.createElement('div');
    const level = type || (status >= 200 && status < 300 ? 'ok' : 'err');
    entry.className = 'log-entry ' + level;
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
    entry.textContent = `[${method} ${endpoint}] -> HTTP ${status}: ${text}`;
    httpLog.prepend(entry);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
      loadTrash();
    } else {
      authStatusPill.textContent = 'No autenticado';
      authStatusPill.classList.remove('online');
      btnLogout.classList.add('hidden');
      listsContainer.innerHTML =
        '<div class="empty-state">Iniciá sesión para consultar y gestionar tus listas.</div>';
      trashContainer.innerHTML =
        '<div class="empty-state">Iniciá sesión para consultar la papelera.</div>';
      trashBadgeCount.textContent = '0';
    }
  }

  // Pestañas de Login / Registro
  document.querySelectorAll('.card .tabs:not(.view-tabs) .tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.card .tabs:not(.view-tabs) .tab').forEach((b) => b.classList.remove('active'));
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

  // Pestañas de Vista (Listas Activas vs Papelera)
  if (tabActiveView && tabTrashView) {
    tabActiveView.addEventListener('click', () => {
      tabActiveView.classList.add('active');
      tabTrashView.classList.remove('active');
      activeViewContainer.style.display = 'block';
      trashViewContainer.style.display = 'none';
      currentView = 'active';
      loadLists();
    });

    tabTrashView.addEventListener('click', () => {
      tabTrashView.classList.add('active');
      tabActiveView.classList.remove('active');
      activeViewContainer.style.display = 'none';
      trashViewContainer.style.display = 'block';
      currentView = 'trash';
      loadTrash();
    });
  }

  // Auth Submit
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

  // Logout
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

  // Crear Lista con participantes e Idempotencia
  createListForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = listTitleInput.value.trim();
    const participantsCount = parseInt(participantsCountInput.value, 10) || 1;
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
      body: JSON.stringify({ title, participantsCount }),
    });
    const data = await res.json();
    appendLog('POST', '/api/lists', res.status, data);

    if (res.ok) {
      listTitleInput.value = '';
      participantsCountInput.value = '1';
      generateKey();
      loadLists();
    }
  });

  // Cargar listas activas
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

  // Cargar papelera
  async function loadTrash() {
    if (!accessToken) return;
    const res = await fetch('/api/lists/trash', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await res.json();
    if (!res.ok) {
      appendLog('GET', '/api/lists/trash', res.status, data);
      return;
    }
    const trashList = Array.isArray(data) ? data : [];
    trashBadgeCount.textContent = String(trashList.length);
    renderTrash(trashList);
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

  // Máquina de estados
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

  // Mover a papelera (Soft Delete)
  window.moveListToTrash = async function (listId) {
    const endpoint = `/api/lists/${listId}`;
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await res.json();
    appendLog('DELETE', endpoint, res.status, data);

    if (res.ok) {
      loadLists();
      loadTrash();
    }
  };

  // Restaurar desde la papelera
  window.restoreFromTrash = async function (listId) {
    const endpoint = `/api/lists/${listId}/restore`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await res.json();
    appendLog('POST', endpoint, res.status, data);

    if (res.ok) {
      loadTrash();
      loadLists();
    }
  };

  // Purgar papelera (+30 días)
  if (btnPurgeTrash) {
    btnPurgeTrash.addEventListener('click', async () => {
      const endpoint = '/api/lists/trash/purge?days=30';
      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const data = await res.json();
      appendLog('DELETE', endpoint, res.status, data);

      if (res.ok) {
        loadTrash();
      }
    });
  }

  // Agregar ítem a una lista
  window.addItemToList = async function (listId) {
    const nameInput = document.getElementById(`itemName_${listId}`);
    const priceInput = document.getElementById(`itemPrice_${listId}`);
    const qtyInput = document.getElementById(`itemQty_${listId}`);

    if (!nameInput || !priceInput || !qtyInput) return;

    const name = nameInput.value.trim();
    const price = parseFloat(priceInput.value) || 0;
    const quantity = parseInt(qtyInput.value, 10) || 1;

    if (!name) {
      alert('Por favor ingresá una descripción para el ítem');
      return;
    }

    const endpoint = `/api/lists/${listId}/items`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name, price, quantity }),
    });
    const data = await res.json();
    appendLog('POST', endpoint, res.status, data);

    if (res.ok) {
      nameInput.value = '';
      priceInput.value = '';
      qtyInput.value = '1';
      loadLists();
    }
  };

  // Eliminar ítem de una lista
  window.deleteItem = async function (listId, itemId) {
    const endpoint = `/api/lists/${listId}/items/${itemId}`;
    const res = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    const data = await res.json();
    appendLog('DELETE', endpoint, res.status, data);

    if (res.ok) {
      loadLists();
    }
  };

  function renderLists(lists) {
    if (!lists.length) {
      listsContainer.innerHTML = '<div class="empty-state">Aún no creaste ninguna lista activa.</div>';
      return;
    }

    listsContainer.innerHTML = lists
      .map((item) => {
        const sseInfo = sseResults[item.id]
          ? `<div class="sse-banner">⚡ Worker Thread #${sseResults[item.id].processedInThread}: ${sseResults[item.id].summary} (Hash: ${sseResults[item.id].checksum})</div>`
          : '';

        const items = item.items || [];
        const itemsRows = items.length
          ? items
              .map(
                (it) => `
            <tr class="item-row">
              <td>${escapeHtml(it.name)}</td>
              <td>$${Number(it.price).toFixed(2)}</td>
              <td>x${it.quantity}</td>
              <td><strong>$${Number(it.subtotal).toFixed(2)}</strong></td>
              <td style="text-align: right;">
                <button class="btn btn-xs btn-danger" onclick="deleteItem('${item.id}', '${it.id}')" title="Eliminar ítem">✖</button>
              </td>
            </tr>
          `
              )
              .join('')
          : '<tr><td colspan="5" class="empty-items">No hay ítems cargados en esta lista todavía.</td></tr>';

        return `
        <div class="list-item">
          <div class="list-item-header">
            <span class="list-title">${escapeHtml(item.title)}</span>
            <span class="badge badge-${item.status}">${item.status}</span>
          </div>
          <div class="list-meta">ID: <code>${item.id}</code></div>

          <!-- Cuadro de Cálculo de Gastos y Reparto -->
          <div class="expense-box">
            <div class="expense-col">
              <span class="expense-label">Total Gastos</span>
              <span class="expense-total">$${Number(item.totalAmount || 0).toFixed(2)}</span>
            </div>
            <div class="expense-divider"></div>
            <div class="expense-col">
              <span class="expense-label">Personas</span>
              <span class="expense-people">👥 ${item.participantsCount || 1}</span>
            </div>
            <div class="expense-divider"></div>
            <div class="expense-col highlight">
              <span class="expense-label">Gasto por Persona</span>
              <span class="expense-per-person">$${Number(item.amountPerPerson || 0).toFixed(2)}</span>
            </div>
          </div>

          <!-- Desglose de Ítems -->
          <div class="items-container">
            <table class="items-table">
              <thead>
                <tr>
                  <th>Ítem</th>
                  <th>Precio</th>
                  <th>Cant.</th>
                  <th>Subtotal</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${itemsRows}
              </tbody>
            </table>

            <!-- Formulario Rápido de Nuevo Ítem -->
            <div class="add-item-bar flex items-center gap-2 pt-2">
              <input type="text" id="itemName_${item.id}" placeholder="Nuevo ítem (ej: Bebidas)" class="input-sm flex-1 bg-surface-900 text-slate-100 placeholder-slate-500 border border-surface-750 focus:border-brand-500 rounded-lg text-xs" autocomplete="off" />
              <input type="number" id="itemPrice_${item.id}" placeholder="Precio $" min="0" step="0.01" class="input-sm bg-surface-900 text-slate-100 placeholder-slate-500 border border-surface-750 focus:border-brand-500 rounded-lg text-xs font-mono text-right" style="width: 95px;" autocomplete="off" />
              <input type="number" id="itemQty_${item.id}" placeholder="Cant." min="1" value="1" class="input-sm bg-surface-900 text-slate-100 placeholder-slate-500 border border-surface-750 focus:border-brand-500 rounded-lg text-xs font-mono text-center" style="width: 65px;" autocomplete="off" />
              <button class="btn btn-sm btn-primary px-3 py-2 rounded-lg text-xs font-semibold shadow-sm flex items-center gap-1.5" onclick="addItemToList('${item.id}')">➕ Agregar</button>
            </div>
          </div>

          ${sseInfo}

          <!-- Acciones de Estado y Papelera -->
          <div class="actions-row">
            <button class="btn btn-sm btn-success" onclick="changeListStatus('${item.id}', 'CONFIRMADA')">
              ➔ CONFIRMADA
            </button>
            <button class="btn btn-sm btn-danger" onclick="changeListStatus('${item.id}', 'ELIMINADA')">
              ➔ ELIMINADA
            </button>
            <button class="btn btn-sm btn-warning" onclick="moveListToTrash('${item.id}')">
              🗑️ Enviar a Papelera
            </button>
          </div>
        </div>
      `;
      })
      .join('');
  }

  function renderTrash(trashLists) {
    if (!trashLists.length) {
      trashContainer.innerHTML = '<div class="empty-state">No hay listas en la papelera de reciclaje.</div>';
      return;
    }

    trashContainer.innerHTML = trashLists
      .map((item) => {
        return `
        <div class="list-item trash-item">
          <div class="list-item-header">
            <span class="list-title">${escapeHtml(item.title)}</span>
            <span class="badge badge-warning">En Papelera (${item.daysRemaining} días restantes)</span>
          </div>
          <div class="list-meta">
            ID: <code>${item.id}</code> | Enviada a papelera: ${new Date(item.deletedAt).toLocaleString()}
          </div>

          <div class="expense-box">
            <div class="expense-col">
              <span class="expense-label">Total Gastos</span>
              <span class="expense-total">$${Number(item.totalAmount || 0).toFixed(2)}</span>
            </div>
            <div class="expense-divider"></div>
            <div class="expense-col">
              <span class="expense-label">Participantes</span>
              <span class="expense-people">👥 ${item.participantsCount || 1}</span>
            </div>
            <div class="expense-divider"></div>
            <div class="expense-col highlight">
              <span class="expense-label">Por Persona</span>
              <span class="expense-per-person">$${Number(item.amountPerPerson || 0).toFixed(2)}</span>
            </div>
          </div>

          <div class="actions-row">
            <button class="btn btn-sm btn-success" onclick="restoreFromTrash('${item.id}')">
              ♻️ Restaurar Lista
            </button>
          </div>
        </div>
      `;
      })
      .join('');
  }

  btnGenKey.addEventListener('click', generateKey);
  btnRefreshLists.addEventListener('click', loadLists);
  if (btnRefreshTrash) btnRefreshTrash.addEventListener('click', loadTrash);
  btnClearLog.addEventListener('click', () => {
    httpLog.innerHTML = '';
  });

  generateKey();
  updateSessionUI();
})();
