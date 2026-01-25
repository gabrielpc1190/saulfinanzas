import { API } from '../core/api.js';
import { showToast } from '../utils/ui.js';

export async function loadCategoriesSettings() {
    try {
        const cats = await API.get('categories');
        const listGasto = document.getElementById('list-cat-gastos');
        const listIngreso = document.getElementById('list-cat-ingresos');

        if (listGasto) listGasto.innerHTML = '';
        if (listIngreso) listIngreso.innerHTML = '';

        cats.forEach(c => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span>${c.nombre}</span>
                <button class="btn-delete-cat" data-id="${c.id}">✕</button>
            `;
            // Necesitamos añadir el listener aquí porque onclick="deleteCategory" ya no es global
            li.querySelector('.btn-delete-cat').onclick = () => deleteCategory(c.id);

            if (c.tipo === 'gasto' && listGasto) listGasto.appendChild(li);
            if (c.tipo === 'ingreso' && listIngreso) listIngreso.appendChild(li);
        });

        // Init tabs logic
        document.querySelectorAll('.settings-card .tab-btn').forEach(btn => {
            btn.onclick = () => {
                document.querySelectorAll('.settings-card .tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.settings-card .tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(btn.dataset.tab).classList.add('active');
            };
        });

        await loadCategoryBudgets();

    } catch (err) { console.error(err); }
}

export async function addCategory(type) {
    const inputId = type === 'gasto' ? 'new-cat-gasto' : 'new-cat-ingreso';
    const input = document.getElementById(inputId);
    const nombre = input?.value?.trim();

    if (!nombre) return showToast('Escribe un nombre', 'warning');

    try {
        await API.post('categories', { nombre, tipo: type });
        input.value = '';
        await loadCategoriesSettings();
        showToast('Categoría agregada', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteCategory(id) {
    if (!confirm('¿Borrar esta categoría?')) return;
    try {
        await API.delete(`categories/${id}`);
        await loadCategoriesSettings();
        showToast('Categoría eliminada', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// --- PRESUPUESTOS ---
async function loadCategoryBudgets() {
    try {
        const cats = await API.get('categories');
        const budgets = await API.get('category-budgets');
        const container = document.getElementById('categoryBudgetFields');

        if (!container) return;
        container.innerHTML = '';

        const gastoCats = cats.filter(c => c.tipo === 'gasto');
        const budgetMap = {};
        budgets.forEach(b => { budgetMap[b.categoria] = b.limite; });

        gastoCats.forEach(cat => {
            const row = document.createElement('div');
            row.className = 'cat-budget-row';
            row.innerHTML = `
                <span>${cat.nombre}</span>
                <input type="number" 
                       data-categoria="${cat.nombre}" 
                       value="${budgetMap[cat.nombre] || 0}" 
                       min="0" 
                       placeholder="0">
            `;
            container.appendChild(row);
        });

        const saveBtn = document.getElementById('saveCatBudgetsBtn');
        if (saveBtn) {
            saveBtn.onclick = saveCategoryBudgets;
        }
    } catch (err) {
        console.error('Error loading category budgets:', err);
    }
}

async function saveCategoryBudgets() {
    try {
        const container = document.getElementById('categoryBudgetFields');
        if (!container) return;

        const inputs = container.querySelectorAll('input[data-categoria]');
        const budgets = [];

        inputs.forEach(input => {
            budgets.push({
                categoria: input.dataset.categoria,
                limite: parseFloat(input.value) || 0
            });
        });

        await API.post('category-budgets', budgets);
        showToast('Presupuestos guardados', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}
