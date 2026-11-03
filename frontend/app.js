(function () {
  let mode = 'login';
  let currentView = 'active';
  let searchFilter = '';
  let searchTimeout = null;
  let accessToken = localStorage.getItem('repartir_access_token') || '';
  let refreshToken = localStorage.getItem('repartir_refresh_token') || '';
  let currentUser = null;
  try {
    currentUser = JSON.parse(localStorage.getItem('repartir_user') || 'null');
  } catch {
    currentUser = null;
  }

  const sseResults = {};
  const activeSseConnections = new Map();
  let cachedActiveLists = [];
  let modalConfirmHandler = null;

  const authStatusPill = document.getElementById('authStatusPill');
  const btnLogout = document.getElementById('btnLogout');
  const authForm = document.getElementById('authForm');
  const usernameGroup = document.getElementById('usernameGroup');
  const usernameInput = document.getElementById('username');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const btnTogglePassword = document.getElementById('btnTogglePassword');
  const btnAuthSubmit = document.getElementById('btnAuthSubmit');
  const createListForm = document.getElementById('createListForm');
  const listTitleInput = document.getElementById('listTitle');
  const participantsCountInput = document.getElementById('participantsCount');
  const btnDecParticipants = document.getElementById('btnDecParticipants');
  const btnIncParticipants = document.getElementById('btnIncParticipants');
  const idempotencyKeyInput = document.getElementById('idempotencyKey');
  const btnGenKey = document.getElementById('btnGenKey');
  const btnCreateListSubmit = document.getElementById('btnCreateListSubmit');
  const btnRefreshLists = document.getElementById('btnRefreshLists');
  const searchListsInput = document.getElementById('searchListsInput');
  const listsContainer = document.getElementById('listsContainer');
  const activeBadgeCount = document.getElementById('activeBadgeCount');
  const httpLog = document.getElementById('httpLog');
  const btnClearLog = document.getElementById('btnClearLog');
  const toastContainer = document.getElementById('toastContainer');

  // Modal elements
  const customModal = document.getElementById('customModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const btnModalClose = document.getElementById('btnModalClose');
  const btnModalCancel = document.getElementById('btnModalCancel');
  const btnModalConfirm = document.getElementById('btnModalConfirm');

  // Papelera elements
  const tabActiveView = document.getElementById('tabActiveView');
  const tabTrashView = document.getElementById('tabTrashView');
  const activeViewContainer = document.getElementById('activeViewContainer');
  const trashViewContainer = document.getElementById('trashViewContainer');
  const trashContainer = document.getElementById('trashContainer');
  const trashBadgeCount = document.getElementById('trashBadgeCount');
  const btnRefreshTrash = document.getElementById('btnRefreshTrash');
  const btnPurgeTrash = document.getElementById('btnPurgeTrash');

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(message, type = 'info') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    const variant = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
    toast.className = `toast-notification toast-${variant}`;

    const icons = {
      success: '<i class="fa-solid fa-circle-check text-emerald-400 mt-0.5"></i>',
      error: '<i class="fa-solid fa-circle-exclamation text-rose-400 mt-0.5"></i>',
      warning: '<i class="fa-solid fa-triangle-exclamation text-amber-400 mt-0.5"></i>',
      info: '<i class="fa-solid fa-bolt text-sky-400 mt-0.5"></i>',
    };

    toast.innerHTML = `
      ${icons[variant]}
      <div class="flex-1 font-medium text-slate-100">${escapeHtml(message)}</div>
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(16px)';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 220);
    }, 3400);
  }

  function setButtonLoading(btn, isLoading, loadingLabel) {
    if (!btn) return;
    if (isLoading) {
      btn.dataset.originalHtml = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i><span>${escapeHtml(loadingLabel || 'Procesando...')}</span>`;
    } else {
      btn.disabled = false;
      if (btn.dataset.originalHtml) {
        btn.innerHTML = btn.dataset.originalHtml;
      }
    }
  }

  function openModal(titleText, bodyHtml, onConfirm) {
    if (!customModal || !modalTitle || !modalBody) return;
    modalTitle.innerHTML = `<i class="fa-solid fa-pen-to-square text-sky-400"></i><span>${escapeHtml(titleText)}</span>`;
    modalBody.innerHTML = bodyHtml;
    modalConfirmHandler = onConfirm;
    customModal.classList.remove('hidden');
    customModal.classList.add('flex');
  }

  function closeModal() {
    if (!customModal) return;
    customModal.classList.add('hidden');
    customModal.classList.remove('flex');
    modalConfirmHandler = null;
  }

  if (btnModalClose) btnModalClose.addEventListener('click', closeModal);
  if (btnModalCancel) btnModalCancel.addEventListener('click', closeModal);
  if (btnModalConfirm) {
    btnModalConfirm.addEventListener('click', async () => {
      if (typeof modalConfirmHandler === 'function') {
        await modalConfirmHandler();
      }
    });
  }

  function closeAllSseConnections() {
    activeSseConnections.forEach((source) => {
      try {
        source.close();
      } catch {
        // Ignore already closed connections
      }
    });
    activeSseConnections.clear();
  }

  function appendLog(method, endpoint, status, payload, type) {
    if (!httpLog) return;
    const entry = document.createElement('div');
    const level = type || (status >= 200 && status < 300 ? 'ok' : 'err');
    entry.className = 'log-entry ' + level;
    const text = typeof payload === 'string' ? payload : JSON.stringify(payload);
    entry.textContent = `[${method} ${endpoint}] -> HTTP ${status}: ${text}`;
    httpLog.prepend(entry);
  }

  function generateKey() {
    if (!idempotencyKeyInput) return;
    idempotencyKeyInput.value = 'idem-' + Math.random().toString(36).substring(2, 10);
  }

  function updateSessionUI() {
    if (accessToken && currentUser) {
      const displayUser = escapeHtml(currentUser.username || currentUser.email);
      authStatusPill.innerHTML = `<i class="fa-solid fa-circle-check text-[11px]"></i><span>Conectado: ${displayUser}</span>`;
      authStatusPill.classList.add('online');
      btnLogout.classList.remove('hidden');
      loadLists();
      loadTrash();
    } else {
      authStatusPill.innerHTML = `<i class="fa-solid fa-user-slash text-[11px]"></i><span>No autenticado</span>`;
      authStatusPill.classList.remove('online');
      btnLogout.classList.add('hidden');
      listsContainer.innerHTML =
        '<div class="empty-state">Iniciá sesión para consultar y gestionar tus listas.</div>';
      trashContainer.innerHTML =
        '<div class="empty-state">Iniciá sesión para consultar la papelera.</div>';
      trashBadgeCount.textContent = '0';
      if (activeBadgeCount) activeBadgeCount.textContent = '0';
    }
  }

  if (btnTogglePassword && passwordInput) {
    btnTogglePassword.addEventListener('click', () => {
      passwordInput.type = passwordInput.type === 'password' ? 'text' : 'password';
    });
  }

  if (btnDecParticipants && participantsCountInput) {
    btnDecParticipants.addEventListener('click', () => {
      const current = parseInt(participantsCountInput.value || '1', 10) || 1;
      participantsCountInput.value = String(Math.max(1, current - 1));
    });
  }

  if (btnIncParticipants && participantsCountInput) {
    btnIncParticipants.addEventListener('click', () => {
      const current = parseInt(participantsCountInput.value || '1', 10) || 1;
      participantsCountInput.value = String(current + 1);
    });
  }

  // Pestañas de Login / Registro
  document.querySelectorAll('.card .tabs:not(.view-tabs) .tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.card .tabs:not(.view-tabs) .tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      mode = btn.getAttribute('data-tab');
      if (mode === 'register') {
        usernameGroup.style.display = 'block';
        btnAuthSubmit.innerHTML = '<i class="fa-solid fa-user-plus"></i><span>Crear Cuenta</span>';
      } else {
        usernameGroup.style.display = 'none';
        btnAuthSubmit.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i><span>Iniciar Sesión</span>';
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

  // Buscador en vivo de listas activas
  if (searchListsInput) {
    searchListsInput.addEventListener('input', () => {
      searchFilter = searchListsInput.value.trim();
      if (searchTimeout) clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        loadLists();
      }, 220);
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

    setButtonLoading(btnAuthSubmit, true, mode === 'register' ? 'Registrando...' : 'Iniciando...');
    try {
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
        showToast(`¡Bienvenido, ${currentUser.username || currentUser.email}!`, 'success');
        updateSessionUI();
      } else if (res.ok && mode === 'register') {
        showToast('Cuenta creada con éxito. Ahora podés iniciar sesión.', 'success');
        const loginTab = document.getElementById('tab-login');
        if (loginTab) loginTab.click();
      } else {
        showToast(data.message || 'Error de autenticación', 'error');
      }
    } catch {
      showToast('Error de red al conectar con el servidor', 'error');
    } finally {
      setButtonLoading(btnAuthSubmit, false);
    }
  });


  // Google Login via gRPC (Google Identity Services OAuth2 + gRPC Backend)
  const googleGsiButtonContainer = document.getElementById('googleGsiButtonContainer');
  let activeGoogleClientId = localStorage.getItem('repartir_google_client_id') || '';

  async function loginWithGoogleGrpc(idToken) {
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      appendLog('POST (gRPC)', '/api/auth/google', res.status, data);
      if (res.ok) {
        accessToken = data.accessToken || data.token;
        refreshToken = data.refreshToken || '';
        currentUser = data.user;
        localStorage.setItem('repartir_access_token', accessToken);
        localStorage.setItem('repartir_refresh_token', refreshToken);
        localStorage.setItem('repartir_user', JSON.stringify(currentUser));
        showToast(`¡Sesión iniciada con Google (gRPC) como ${currentUser.email}!`, 'success');
        updateSessionUI();
      } else {
        showToast(data.message || 'Error al autenticar con Google vía gRPC', 'error');
      }
    } catch {
      showToast('Error de red al conectar con el servicio gRPC', 'error');
    }
  }

  function renderRealGoogleSignInButton(clientId) {
    if (!clientId || !window.google || !window.google.accounts || !window.google.accounts.id) {
      return false;
    }
    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response && response.credential) {
            loginWithGoogleGrpc(response.credential);
          }
        },
      });
      if (googleGsiButtonContainer) {
        googleGsiButtonContainer.innerHTML = '';
        const containerWidth = Math.min(Math.max((googleGsiButtonContainer.offsetWidth || 340) - 8, 240), 380);
        window.google.accounts.id.renderButton(googleGsiButtonContainer, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'left',
          width: containerWidth,
        });
      }
      return true;
    } catch {
      return false;
    }
  }

  async function initGoogleGsiConfig() {
    try {
      const res = await fetch('/api/auth/google/config');
      if (res.ok) {
        const cfg = await res.json();
        if (cfg.clientId) {
          activeGoogleClientId = cfg.clientId;
        }
      }
    } catch {
      // Ignorar si aún no está disponible
    }
    if (activeGoogleClientId) {
      let attempts = 0;
      const timer = setInterval(() => {
        attempts += 1;
        if (renderRealGoogleSignInButton(activeGoogleClientId) || attempts > 20) {
          clearInterval(timer);
        }
      }, 250);
    }
  }

  void initGoogleGsiConfig();

  // Logout
  btnLogout.addEventListener('click', async () => {
    setButtonLoading(btnLogout, true, 'Cerrando...');
    try {
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
    } finally {
      closeAllSseConnections();
      accessToken = '';
      refreshToken = '';
      currentUser = null;
      localStorage.removeItem('repartir_access_token');
      localStorage.removeItem('repartir_refresh_token');
      localStorage.removeItem('repartir_user');
      setButtonLoading(btnLogout, false);
      showToast('Sesión cerrada y credenciales revocadas.', 'info');
      updateSessionUI();
    }
  });

  // Crear Lista con participantes e Idempotencia
  createListForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!accessToken) {
      showToast('Iniciá sesión primero para crear una lista.', 'warning');
      return;
    }

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

    setButtonLoading(btnCreateListSubmit, true, 'Creando lista...');
    try {
      const res = await fetch('/api/lists', {
        method: 'POST',
        headers,
        body: JSON.stringify({ title, participantsCount }),
      });
      const data = await res.json();
      appendLog('POST', '/api/lists', res.status, data);

      if (res.ok) {
        if (res.status === 200) {
          showToast('Respuesta Idempotente (HTTP 200): Se devolvió la lista existente sin duplicar.', 'info');
        } else {
          showToast(`Lista "${data.title}" creada exitosamente.`, 'success');
        }
        listTitleInput.value = '';
        participantsCountInput.value = '1';
        generateKey();
        loadLists();
      } else {
        showToast(data.message || 'No se pudo crear la lista', 'error');
      }
    } finally {
      setButtonLoading(btnCreateListSubmit, false);
    }
  });

  // Cargar listas activas
  async function loadLists() {
    if (!accessToken) return;
    const payload = { page: 1, limit: 20 };
    if (searchFilter) {
      payload.search = searchFilter;
    }

    const res = await fetch('/api/lists/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      appendLog('POST', '/api/lists/search', res.status, data);
      return;
    }
    cachedActiveLists = data.lists || [];
    if (activeBadgeCount) {
      activeBadgeCount.textContent = String(cachedActiveLists.length);
    }
    renderLists(cachedActiveLists);
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
    if (activeSseConnections.has(listId)) {
      try {
        activeSseConnections.get(listId).close();
      } catch {
        // Ignore
      }
    }

    const url = `/api/lists/${listId}/events?token=${encodeURIComponent(accessToken)}`;
    const source = new EventSource(url);
    activeSseConnections.set(listId, source);

    source.addEventListener('list_processed', (ev) => {
      const payload = JSON.parse(ev.data);
      sseResults[listId] = payload;
      appendLog('SSE', `/api/lists/${listId}/events`, 200, payload, 'sse');
      showToast(`Worker Thread #${payload.processedInThread} finalizó el cierre de la lista.`, 'success');
      source.close();
      activeSseConnections.delete(listId);
      loadLists();
    });

    source.onerror = () => {
      source.close();
      activeSseConnections.delete(listId);
    };
  }

  // Editar detalles de una lista (PUT /api/lists/:id)
  async function updateListDetails(listId, title, participantsCount) {
    const endpoint = `/api/lists/${listId}`;
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ title, participantsCount }),
    });
    const data = await res.json();
    appendLog('PUT', endpoint, res.status, data);

    if (res.ok) {
      showToast('Lista actualizada correctamente.', 'success');
      closeModal();
      loadLists();
    } else {
      showToast(data.message || 'Error al actualizar la lista', 'error');
    }
  }

  window.openEditListModal = function (listId) {
    const found = cachedActiveLists.find((l) => l.id === listId);
    if (!found) return;

    const bodyHtml = `
      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1" for="modalListTitle">Título de la Lista</label>
        <input id="modalListTitle" type="text" value="${escapeHtml(found.title)}" class="w-full bg-surface-900 text-slate-100 text-xs rounded-xl px-3 py-2 border border-surface-750" />
      </div>
      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1" for="modalListParticipants">Cantidad de Personas</label>
        <input id="modalListParticipants" type="number" min="1" value="${found.participantsCount || 1}" class="w-full bg-surface-900 text-slate-100 text-xs rounded-xl px-3 py-2 border border-surface-750 font-mono" />
      </div>
    `;

    openModal('Editar Lista y Participantes', bodyHtml, async () => {
      const newTitle = document.getElementById('modalListTitle').value.trim();
      const newParticipants = parseInt(document.getElementById('modalListParticipants').value, 10) || 1;
      if (!newTitle) {
        showToast('El título de la lista no puede estar vacío.', 'warning');
        return;
      }
      await updateListDetails(listId, newTitle, newParticipants);
    });
  };

  // Editar un ítem de la lista (PUT /api/lists/:id/items/:itemId)
  async function updateItemInList(listId, itemId, payload) {
    const endpoint = `/api/lists/${listId}/items/${itemId}`;
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    appendLog('PUT', endpoint, res.status, data);

    if (res.ok) {
      showToast('Ítem actualizado y totales recalculados.', 'success');
      closeModal();
      loadLists();
    } else {
      showToast(data.message || 'Error al actualizar el ítem', 'error');
    }
  }

  window.openEditItemModal = function (listId, itemId) {
    const foundList = cachedActiveLists.find((l) => l.id === listId);
    if (!foundList || !Array.isArray(foundList.items)) return;
    const foundItem = foundList.items.find((it) => it.id === itemId);
    if (!foundItem) return;

    const bodyHtml = `
      <div>
        <label class="block text-xs font-medium text-slate-300 mb-1" for="modalItemName">Descripción del Ítem</label>
        <input id="modalItemName" type="text" value="${escapeHtml(foundItem.name)}" class="w-full bg-surface-900 text-slate-100 text-xs rounded-xl px-3 py-2 border border-surface-750" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1" for="modalItemPrice">Precio Unitario ($)</label>
          <input id="modalItemPrice" type="number" min="0" step="0.01" value="${foundItem.price}" class="w-full bg-surface-900 text-slate-100 text-xs rounded-xl px-3 py-2 border border-surface-750 font-mono" />
        </div>
        <div>
          <label class="block text-xs font-medium text-slate-300 mb-1" for="modalItemQty">Cantidad</label>
          <input id="modalItemQty" type="number" min="1" value="${foundItem.quantity}" class="w-full bg-surface-900 text-slate-100 text-xs rounded-xl px-3 py-2 border border-surface-750 font-mono" />
        </div>
      </div>
    `;

    openModal('Editar Ítem y Recalcular Gasto', bodyHtml, async () => {
      const name = document.getElementById('modalItemName').value.trim();
      const price = parseFloat(document.getElementById('modalItemPrice').value) || 0;
      const quantity = parseInt(document.getElementById('modalItemQty').value, 10) || 1;
      if (!name) {
        showToast('El nombre del ítem es obligatorio.', 'warning');
        return;
      }
      await updateItemInList(listId, itemId, { name, price, quantity });
    });
  };

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
      showToast(`Estado actualizado a ${targetStatus}.`, 'success');
      if (targetStatus === 'CONFIRMADA') {
        subscribeSse(listId);
      }
      loadLists();
    } else {
      showToast(data.message || 'Transición de estado inválida', 'error');
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
      if (activeSseConnections.has(listId)) {
        activeSseConnections.get(listId).close();
        activeSseConnections.delete(listId);
      }
      showToast('Lista enviada a la papelera de reciclaje (30 días).', 'warning');
      loadLists();
      loadTrash();
    } else {
      showToast(data.message || 'No se pudo enviar a la papelera', 'error');
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
      showToast('Lista restaurada exitosamente a tus listas activas.', 'success');
      loadTrash();
      loadLists();
    } else {
      showToast(data.message || 'No se pudo restaurar la lista', 'error');
    }
  };

  // Purgar papelera (+30 días)
  if (btnPurgeTrash) {
    btnPurgeTrash.addEventListener('click', async () => {
      setButtonLoading(btnPurgeTrash, true, 'Purgando...');
      try {
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
          showToast(`Purga completada: ${data.purgedCount || 0} listas expiradas eliminadas.`, 'info');
          loadTrash();
        } else {
          showToast(data.message || 'Error al purgar papelera', 'error');
        }
      } finally {
        setButtonLoading(btnPurgeTrash, false);
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
      showToast('Por favor ingresá una descripción para el ítem.', 'warning');
      nameInput.focus();
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
      showToast(`Ítem "${name}" agregado al reparto.`, 'success');
      loadLists();
    } else {
      showToast(data.message || 'Error al agregar ítem', 'error');
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
      showToast('Ítem eliminado de la lista.', 'info');
      loadLists();
    } else {
      showToast(data.message || 'Error al eliminar ítem', 'error');
    }
  };

  function renderLists(lists) {
    if (!lists.length) {
      listsContainer.innerHTML = '<div class="empty-state">Aún no creaste ninguna lista activa o no hay coincidencias con el filtro.</div>';
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
              <td style="text-align: right;" class="space-x-1">
                <button class="btn btn-xs btn-secondary" onclick="openEditItemModal('${item.id}', '${it.id}')" title="Editar ítem">✎</button>
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
            <div class="flex items-center gap-2">
              <button class="btn btn-xs btn-secondary" onclick="openEditListModal('${item.id}')" title="Editar título o participantes">
                <i class="fa-solid fa-pen text-[10px]"></i> Editar
              </button>
              <span class="badge badge-${item.status}">${item.status}</span>
            </div>
          </div>
          <div class="list-meta">
            <span>ID: <code>${item.id}</code></span>
            <span>Actualizada: ${new Date(item.updatedAt || item.createdAt).toLocaleTimeString()}</span>
          </div>

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
              <input type="text" id="itemName_${item.id}" placeholder="Nuevo ítem (ej: Bebidas)" class="input-sm flex-1 bg-surface-900 text-slate-100 placeholder-slate-500 border border-surface-750 focus:border-brand-500 rounded-lg text-xs" style="background-color: #0f172a !important; color: #f1f5f9 !important; border-color: #27354d !important;" autocomplete="off" />
              <input type="number" id="itemPrice_${item.id}" placeholder="Precio $" min="0" step="0.01" class="input-sm bg-surface-900 text-slate-100 placeholder-slate-500 border border-surface-750 focus:border-brand-500 rounded-lg text-xs font-mono text-right" style="width: 95px; background-color: #0f172a !important; color: #f1f5f9 !important; border-color: #27354d !important;" autocomplete="off" />
              <input type="number" id="itemQty_${item.id}" placeholder="Cant." min="1" value="1" class="input-sm bg-surface-900 text-slate-100 placeholder-slate-500 border border-surface-750 focus:border-brand-500 rounded-lg text-xs font-mono text-center" style="width: 65px; background-color: #0f172a !important; color: #f1f5f9 !important; border-color: #27354d !important;" autocomplete="off" />
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
            <span>ID: <code>${item.id}</code></span>
            <span>Enviada a papelera: ${new Date(item.deletedAt).toLocaleString()}</span>
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
