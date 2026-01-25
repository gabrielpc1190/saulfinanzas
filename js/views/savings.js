import { API } from '../core/api.js';
import { showToast, showSaveStatus } from '../utils/ui.js';
import { formatCurrency } from '../utils/formatters.js';
import { showConfirm } from '../components/modal.js';

export async function loadSavingsView() {
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
                    <button class="btn-delete-envelope" type="button" title="Eliminar">✕</button>
                </div>
                <p class="envelope-balance">${formatCurrency(env.saldo || 0)}</p>
                <div class="envelope-actions">
                    <button class="btn-env-action deposit">+ Depositar</button>
                    <button class="btn-env-action withdraw" ${env.saldo <= 0 ? 'disabled' : ''}>- Retirar</button>
                </div>
            `;

            // Listeners
            card.querySelector('.btn-delete-envelope').onclick = (e) => {
                e.stopPropagation();
                deleteEnvelope(env.id);
            };
            card.querySelector('.deposit').onclick = () => openFundsModal(env.id, env.nombre, 'deposit');
            card.querySelector('.withdraw').onclick = () => openFundsModal(env.id, env.nombre, 'withdraw');

            container.appendChild(card);
        });

    } catch (err) {
        console.error('Error loading savings:', err);
        container.innerHTML = '<p style="color:red">Error al cargar</p>';
    }
}

async function deleteEnvelope(id) {
    showConfirm('Eliminar Sobre', '¿Deseas eliminar este sobre?', async () => {
        try {
            await API.delete(`savings/${id}`);
            await loadSavingsView();
            showToast('Sobre eliminado', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}

// --- CRUD & Funds ---
export function openNewEnvelopeModal() {
    const modal = document.getElementById('envelopeModal');
    if (modal) {
        modal.style.display = 'block';
        document.getElementById('envelopeName').value = '';
    }
}

export function closeEnvelopeModal() {
    document.getElementById('envelopeModal').style.display = 'none';
}

export async function createEnvelope() {
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

let currentFundEnvelopeId = null;
let currentFundMode = 'deposit';

export function openFundsModal(id, nombre, mode) {
    currentFundEnvelopeId = id;
    currentFundMode = mode;
    const modal = document.getElementById('fundsModal');
    if (modal) modal.style.display = 'block';
    document.getElementById('fundsTitle').textContent = mode === 'deposit' ? `Depositar a: ${nombre}` : `Retirar de: ${nombre}`;
    document.getElementById('fundsAmount').value = '';
    setFundMode(mode);
}

export function setFundMode(mode) {
    currentFundMode = mode;
    document.getElementById('tabDeposit')?.classList.toggle('active', mode === 'deposit');
    document.getElementById('tabWithdraw')?.classList.toggle('active', mode === 'withdraw');
}

export function closeFundsModal() {
    document.getElementById('fundsModal').style.display = 'none';
}

export async function processFundUpdate(refreshDashboardCallback) {
    const monto = parseFloat(document.getElementById('fundsAmount')?.value || 0);
    if (monto <= 0) return showToast('Monto inválido', 'warning');
    try {
        await API.put(`savings/${currentFundEnvelopeId}/${currentFundMode}`, { monto });
        closeFundsModal();
        await loadSavingsView();
        if (refreshDashboardCallback) await refreshDashboardCallback();
        showToast('Fondos actualizados', 'success');
        showSaveStatus();
    } catch (err) {
        showToast(err.message, 'error');
    }
}
