/**
 * Saul-Finanzas Client (API Version 2.5)
 * Conecta con backend Node.js + SQLite
 */

let chart;
let currentViewYear = new Date().getFullYear();
let currentViewMonth = new Date().getMonth();

// --- API CLIENT ---
const API = {
    async get(endpoint) {
        const res = await fetch(`/api/${endpoint}`);
        if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
        return res.json();
    },
    async post(endpoint, data) {
        const res = await fetch(`/api/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
        return res.json();
    },
    async put(endpoint, data) {
        const res = await fetch(`/api/${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(error.error || res.statusText);
        }
        return res.json();
    },
    async delete(endpoint) {
        const res = await fetch(`/api/${endpoint}`, { method: 'DELETE' });
        if (!res.ok) {
            const error = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(error.error || res.statusText);
        }
        return res.json();
    }
};

// --- INIT ---
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    try {
        const user = await API.get('me');
        const greeting = document.getElementById('userGreeting');
        if (greeting) greeting.textContent = `Hola, ${user.username} 👋`;

        updateMonthDisplay();
        await loadDashboard();

        initMobileMenu();
        initModalHandlers();
        initNavigation();
    } catch (err) {
        console.error('Auth failed:', err);
        window.location.href = '/login.html';
    }
}

// --- NAVIGATION ---
function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            if (view) showView(view);
        });
    });
}

function showView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const view = document.getElementById(`view-${viewName}`);
    const navItem = document.querySelector(`.nav-item[data-view="${viewName}"]`);

    if (view) view.classList.add('active');
    if (navItem) navItem.classList.add('active');

    // Cerrar menú móvil
    document.querySelector('.sidebar')?.classList.remove('active');
    document.getElementById('sidebarOverlay')?.classList.remove('active');

    if (viewName === 'dashboard') loadDashboard();
    if (viewName === 'transacciones') loadTransactionsView();
    if (viewName === 'ahorros') loadSavingsView();
}

// --- DASHBOARD ---
async function loadDashboard() {
    try {
        await Promise.all([
            updateStats(),
            updateCharts()
        ]);
    } catch (err) {
        console.error('Error loading dashboard:', err);
    }
}

async function updateStats() {
    const txs = await API.get('transactions');
    const monthFilter = getMonthFilter();
    const filtered = txs.filter(t => t.fecha && t.fecha.startsWith(monthFilter));

    let income = 0, expense = 0;
    filtered.forEach(t => {
        if (t.tipo === 'ingreso') income += t.monto;
        if (t.tipo === 'gasto') expense += t.monto;
    });

    const totalIncome = document.getElementById('totalIncome');
    const totalExpenses = document.getElementById('totalExpenses');
    const totalBalance = document.getElementById('totalBalance');

    if (totalIncome) totalIncome.textContent = formatCurrency(income);
    if (totalExpenses) totalExpenses.textContent = formatCurrency(expense);
    if (totalBalance) totalBalance.textContent = formatCurrency(income - expense);
}

// --- TRANSACTIONS VIEW ---
async function loadTransactionsView() {
    await renderTable('incomeTable', 'ingreso');
    await renderTable('expenseTable', 'gasto');
}

async function renderTable(tableId, type) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5">Cargando...</td></tr>';

    try {
        const txs = await API.get('transactions');
        const monthFilter = getMonthFilter();
        const filtered = txs
            .filter(t => t.tipo === type && t.fecha && t.fecha.startsWith(monthFilter))
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

        tbody.innerHTML = '';
        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted)">Sin movimientos</td></tr>';
            return;
        }

        filtered.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td data-label="Fecha">${row.fecha}</td>
                <td data-label="Concepto">${row.descripcion || '-'}</td>
                <td data-label="Categoría">${row.categoria}</td>
                <td data-label="Monto" style="color: ${row.tipo === 'ingreso' ? 'var(--income)' : 'var(--expense)'}">
                    ${row.tipo === 'ingreso' ? '+' : '-'} ${formatCurrency(row.monto)}
                </td>
                <td data-label="Acciones">
                    <button class="btn-delete-trans" data-id="${row.id}">✕</button>
                </td>
             `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.btn-delete-trans').forEach(btn => {
            btn.onclick = () => deleteTransaction(btn.dataset.id);
        });

    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:red">Error al cargar</td></tr>';
    }
}

// --- SAVINGS VIEW ---
async function loadSavingsView() {
    const container = document.getElementById('envelopesGrid');
    const totalEl = document.getElementById('savingsTotal');
    if (!container) return;

    container.innerHTML = '<p style="color:var(--text-muted)">Cargando sobres...</p>';

    try {
        const envelopes = await API.get('savings');
        const total = envelopes.reduce((sum, e) => sum + (e.saldo || 0), 0);
        if (totalEl) totalEl.textContent = formatCurrency(total);

        if (envelopes.length === 0) {
            container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem;">No hay sobres.</p>';
            return;
        }

        container.innerHTML = '';
        envelopes.forEach(env => {
            const card = document.createElement('div');
            card.className = 'envelope-card';
            card.innerHTML = `
                <div class="envelope-header">
                    <span class="envelope-icon">${env.icono || '💰'}</span>
                    <h4 class="envelope-name">${env.nombre}</h4>
                    <button class="btn-delete-envelope" type="button" data-id="${env.id}" title="Eliminar">✕</button>
                </div>
                <p class="envelope-balance">${formatCurrency(env.saldo || 0)}</p>
                <div class="envelope-actions">
                    <button class="btn-env-action deposit" onclick="openFundsModal(${env.id}, '${env.nombre}', 'deposit')">+ Depositar</button>
                    <button class="btn-env-action withdraw" onclick="openFundsModal(${env.id}, '${env.nombre}', 'withdraw')" ${env.saldo <= 0 ? 'disabled' : ''}>- Retirar</button>
                </div>
            `;
            container.appendChild(card);
        });

        container.querySelectorAll('.btn-delete-envelope').forEach(btn => {
            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                deleteEnvelope(btn.dataset.id);
            };
        });

    } catch (err) {
        console.error('Error loading savings:', err);
        container.innerHTML = '<p style="color:red">Error al cargar</p>';
    }
}

// --- CONFIRMATION MODAL HELPER ---
function showConfirm(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const msgEl = document.getElementById('confirmMessage');
    const okBtn = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');

    if (!modal) return;

    titleEl.textContent = title;
    msgEl.textContent = message;

    // Reset handlers
    const newOkBtn = okBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

    newOkBtn.onclick = () => {
        modal.style.display = 'none';
        if (onConfirm) onConfirm();
    };
    newCancelBtn.onclick = () => modal.style.display = 'none';

    modal.style.display = 'block';
}

function deleteEnvelope(id) {
    try {
        await API.delete(`savings/${id}`);
        await loadSavingsView();
        showToast('Sobre eliminado', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
});
}

function deleteTransaction(id) {
    showConfirm('Eliminar Transacción', '¿Deseas eliminar permanentemente esta transacción?', async () => {
        try {
            await API.delete(`transactions/${id}`);
            await loadDashboard();
            await loadTransactionsView();
            showToast('Transacción eliminada', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

// --- ENVELOPE CRUD ---
function openNewEnvelopeModal() {
    const modal = document.getElementById('envelopeModal');
    if (modal) {
        modal.style.display = 'block';
        document.getElementById('envelopeName').value = '';
    }
}

function closeEnvelopeModal() {
    document.getElementById('envelopeModal').style.display = 'none';
}

async function createEnvelope() {
    const nombre = document.getElementById('envelopeName')?.value?.trim();
    if (!nombre) return showToast('Ingresa un nombre', 'warning');

    const btn = document.querySelector('#envelopeModal .btn-primary');
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    try {
        await API.post('savings', { nombre, icono: '💰' });
        closeEnvelopeModal();
        await loadSavingsView();
        showToast('Sobre creado con éxito', 'success');
        showSaveStatus();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Crear Sobre'; }
    }
}

// --- FUNDS MODAL ---
let currentFundEnvelopeId = null;
let currentFundMode = 'deposit';

function openFundsModal(id, nombre, mode) {
    currentFundEnvelopeId = id;
    currentFundMode = mode;
    const modal = document.getElementById('fundsModal');
    if (modal) modal.style.display = 'block';
    document.getElementById('fundsTitle').textContent = mode === 'deposit' ? `Depositar a: ${nombre}` : `Retirar de: ${nombre}`;
    document.getElementById('fundsAmount').value = '';
    setFundMode(mode);
}

function setFundMode(mode) {
    currentFundMode = mode;
    document.getElementById('tabDeposit')?.classList.toggle('active', mode === 'deposit');
    document.getElementById('tabWithdraw')?.classList.toggle('active', mode === 'withdraw');
}

function closeFundsModal() {
    document.getElementById('fundsModal').style.display = 'none';
}

async function processFundUpdate() {
    const monto = parseFloat(document.getElementById('fundsAmount')?.value || 0);
    if (monto <= 0) return showToast('Monto inválido', 'warning');
    try {
        await API.put(`savings/${currentFundEnvelopeId}/${currentFundMode}`, { monto });
        closeFundsModal();
        await loadSavingsView();
        await loadDashboard();
        showToast('Fondos actualizados', 'success');
        showSaveStatus();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- TRANSACTIONS CRUD ---
async function startAddTransaction(type) {
    const modal = document.getElementById('transactionModal');
    if (!modal) return;
    modal.style.display = 'block';
    document.getElementById('modalTitle').textContent = type === 'ingreso' ? 'Nuevo Ingreso' : 'Nuevo Gasto';
    document.getElementById('transType').value = type;
    document.getElementById('transDate').value = new Date().toISOString().split('T')[0];

    try {
        const cats = await API.get('categories');
        const select = document.getElementById('transCategory');
        if (select) {
            select.innerHTML = '';
            cats.filter(c => c.tipo === type).forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.nombre;
                opt.textContent = c.nombre;
                select.appendChild(opt);
            });
        }
    } catch (err) { console.error(err); }
}

async function saveTransaction() {
    const data = {
        fecha: document.getElementById('transDate')?.value,
        tipo: document.getElementById('transType')?.value,
        categoria: document.getElementById('transCategory')?.value,
        monto: parseFloat(document.getElementById('transAmount')?.value || 0),
        descripcion: document.getElementById('transDesc')?.value || ''
    };
    if (!data.monto || !data.fecha) return showToast('Completa fecha y monto', 'warning');

    try {
        await API.post('transactions', data);
        closeModal();
        await loadDashboard();
        await loadTransactionsView();
        showToast('Transacción registrada', 'success');
        showSaveStatus();
    } catch (err) { showToast(err.message, 'error'); }
}

function closeModal() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    document.getElementById('transactionForm')?.reset();
}

// --- HELPERS ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Icon selection based on type
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${message}`;
    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            if (toast.parentNode === container) {
                container.removeChild(toast);
            }
        }, 300);
    }, 4000);
}

function formatCurrency(amount) {
    return '₡ ' + (amount || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showSaveStatus() {
    const el = document.getElementById('saveStatus');
    if (!el) return;
    el.textContent = 'Sincronizado ✅';
    el.style.color = 'var(--income)';
    setTimeout(() => {
        el.textContent = 'Datos en Servidor';
        el.style.color = 'var(--text-muted)';
    }, 2000);
}

function getMonthFilter() {
    const y = currentViewYear;
    const m = String(currentViewMonth + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function updateMonthDisplay() {
    const date = new Date(currentViewYear, currentViewMonth, 1);
    const monthName = date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
    const display = document.getElementById('currentMonthDisplay');
    if (display) display.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);
}

function prevMonth() {
    currentViewMonth--;
    if (currentViewMonth < 0) { currentViewMonth = 11; currentViewYear--; }
    updateMonthDisplay();
    loadDashboard();
}

function nextMonth() {
    currentViewMonth++;
    if (currentViewMonth > 11) { currentViewMonth = 0; currentViewYear++; }
    updateMonthDisplay();
    loadDashboard();
}

function initMobileMenu() {
    const toggle = document.getElementById('mobileMenuToggle');
    const overlay = document.getElementById('sidebarOverlay');
    if (toggle) {
        toggle.onclick = () => {
            document.querySelector('.sidebar').classList.toggle('active');
            toggle.classList.toggle('active');
            overlay?.classList.toggle('active');
        };
    }
}

function initModalHandlers() {
    document.getElementById('openIncomeBtn').onclick = () => startAddTransaction('ingreso');
    document.getElementById('openExpenseBtn').onclick = () => startAddTransaction('gasto');
    document.getElementById('saveTransBtn').onclick = saveTransaction;
    document.getElementById('cancelTransBtn').onclick = closeModal;

    document.querySelectorAll('.modal').forEach(modal => {
        if (modal.id === 'confirmModal') return;
        modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    });
}

// --- CHARTS ---
async function updateCharts() {
    const canvas = document.getElementById('expensesChart');
    if (!canvas) return;
    try {
        const txs = await API.get('transactions');
        const monthFilter = getMonthFilter();
        const expenses = txs.filter(t => t.tipo === 'gasto' && t.fecha && t.fecha.startsWith(monthFilter));
        const catTotals = {};
        expenses.forEach(t => { catTotals[t.categoria] = (catTotals[t.categoria] || 0) + t.monto; });

        const ctx = canvas.getContext('2d');
        if (chart) chart.destroy();

        if (Object.keys(catTotals).length === 0) {
            chart = new Chart(ctx, {
                type: 'doughnut',
                data: { labels: ['Sin gastos'], datasets: [{ data: [1], backgroundColor: ['#374151'] }] },
                options: { responsive: true, maintainAspectRatio: false }
            });
            return;
        }

        chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(catTotals),
                datasets: [{
                    data: Object.values(catTotals),
                    backgroundColor: ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#9ca3af' } } } }
        });
    } catch (err) { console.error(err); }
}
