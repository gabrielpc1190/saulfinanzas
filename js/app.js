/**
 * Saul-Finanzas Client (Modular Version)
 */
import { API } from './core/api.js?v=12.0';
import { initModalHandlers } from './components/modal.js?v=12.0';
import { loadDashboard } from './views/dashboard.js?v=12.0';
import { loadTransactionsView, startAddTransaction, saveTransaction } from './views/transactions.js?v=12.0';
import { loadSavingsView, createEnvelope, openNewEnvelopeModal, closeEnvelopeModal, processFundUpdate, closeFundsModal, setFundMode } from './views/savings.js?v=12.0';
import { loadCategoriesSettings, addCategory } from './views/settings.js?v=12.0';

// --- STATE ---
let currentViewYear = new Date().getFullYear();
let currentViewMonth = new Date().getMonth();

// --- HELPERS (Month State) ---
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
    loadDashboard(getMonthFilter);
}

function nextMonth() {
    currentViewMonth++;
    if (currentViewMonth > 11) { currentViewMonth = 0; currentViewYear++; }
    updateMonthDisplay();
    loadDashboard(getMonthFilter);
}

// --- INIT ---
document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
    try {
        const user = await API.get('me');
        const greeting = document.getElementById('userGreeting');
        if (greeting) greeting.textContent = `Hola, ${user.username} 👋`;

        updateMonthDisplay();

        // Expose global functions needed for HTML inline onclick attributes (Legacy support / Quick fix)
        // Ideally we should remove all inline onclicks, but for now we bridge them.
        window.startAddTransaction = startAddTransaction;
        window.deleteCategory = (id) => console.warn('Use view specific handler'); // Handled inside settings.js
        window.openNewEnvelopeModal = openNewEnvelopeModal;
        window.closeEnvelopeModal = closeEnvelopeModal;
        window.createEnvelope = createEnvelope;
        // window.openFundsModal is handled inside savings.js rendering but declared globally in old app.
        // In savings.js we attach listeners dynamically, so we might not need global here if we rendered correctly.
        // BUT savings.js renders HTML strings with onclick="openFundsModal..." so we DO need it global.
        // Wait, in my savings.js I attached listeners: card.querySelector('.deposit').onclick...
        // So I REMOVED the inline onclick from the template string in my savings.js?
        // Let's check savings.js content...
        // Yes, in savings.js I wrote:
        // button class="btn-env-action deposit" ... (no onclick in string)
        // card.querySelector('.deposit').onclick = ...
        // So NO need to expose openFundsModal globally! Excellent.

        // However, some static buttons in index.html might still use inline onclicks?
        // Let's check index.html later. For now, expose what's needed.

        // Funds modal static buttons (Guardar/Cancelar) need handlers
        window.processFundUpdate = () => processFundUpdate(() => loadDashboard(getMonthFilter));
        window.closeFundsModal = closeFundsModal;
        window.setFundMode = setFundMode;

        // Settings buttons
        window.addCategory = addCategory;

        // Navigation Month
        window.prevMonth = prevMonth;
        window.nextMonth = nextMonth;

        // Mobile Menu
        initMobileMenu();

        // Modals
        initModalHandlers({
            onAddIncome: () => startAddTransaction('ingreso'),
            onAddExpense: () => startAddTransaction('gasto'),
            onSave: () => saveTransaction([
                () => loadDashboard(getMonthFilter),
                () => loadTransactionsView(getMonthFilter)
            ])
        });

        initNavigation();

        // Initial Load
        await loadDashboard(getMonthFilter);

    } catch (err) {
        console.error('Auth failed:', err);
        window.location.href = '/login.html';
    }
}

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

    document.querySelector('.sidebar')?.classList.remove('active');
    document.getElementById('sidebarOverlay')?.classList.remove('active');

    if (viewName === 'dashboard') loadDashboard(getMonthFilter);
    if (viewName === 'transacciones') loadTransactionsView(getMonthFilter);
    if (viewName === 'ahorros') loadSavingsView();
    if (viewName === 'ajustes') loadCategoriesSettings();
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
