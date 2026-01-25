import { API } from '../core/api.js';
import { showToast, showSaveStatus } from '../utils/ui.js';
import { formatCurrency } from '../utils/formatters.js';
import { showConfirm, closeModal } from '../components/modal.js';

export async function loadTransactionsView(getMonthFilter) {
    await renderTable('incomeTable', 'ingreso', getMonthFilter);
    await renderTable('expenseTable', 'gasto', getMonthFilter);
}

async function renderTable(tableId, type, getMonthFilter) {
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
            tr.querySelector('.btn-delete-trans').onclick = () => deleteTransaction(row.id, getMonthFilter);
            tbody.appendChild(tr);
        });

    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:red">Error al cargar</td></tr>';
    }
}

async function deleteTransaction(id, getMonthFilter) {
    showConfirm('Eliminar Transacción', '¿Deseas eliminar permanentemente esta transacción?', async () => {
        try {
            await API.delete(`transactions/${id}`);
            // Recargar vistas, idealmente pasadas como callback, pero aqui asumimos recarga parcial
            await loadTransactionsView(getMonthFilter);
            showToast('Transacción eliminada', 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    });
}
// Exportamos para uso externo si fuera necesario, pero principalmente interno
export { deleteTransaction };

// --- CRUD ---
export async function startAddTransaction(type) {
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

export async function saveTransaction(refreshCallbacks) {
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
        if (refreshCallbacks) {
            await Promise.all(refreshCallbacks.map(cb => cb()));
        }
        showToast('Transacción registrada', 'success');
        showSaveStatus();
    } catch (err) { showToast(err.message, 'error'); }
}
