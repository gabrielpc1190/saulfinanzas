import { API } from '../core/api.js';
import { formatCurrency } from '../utils/formatters.js';

let chart;

export async function loadDashboard(getMonthFilter) {
    try {
        await Promise.all([
            updateStats(getMonthFilter),
            updateCharts(getMonthFilter),
            updateBudgetDisplay(getMonthFilter)
        ]);
    } catch (err) {
        console.error('Error loading dashboard:', err);
    }
}

async function updateStats(getMonthFilter) {
    console.log('[DEBUG] updateStats triggered');
    const [globalStats, txs] = await Promise.all([
        API.get('stats'),
        API.get('transactions')
    ]);
    console.log('[DEBUG] API Data:', { globalStats, txsSize: txs.length });

    const monthFilter = getMonthFilter();
    const filtered = txs.filter(t => t.fecha && t.fecha.startsWith(monthFilter));

    let monthlyIncome = 0, monthlyExpense = 0;
    filtered.forEach(t => {
        if (t.tipo === 'ingreso') monthlyIncome += t.monto;
        if (t.tipo === 'gasto') monthlyExpense += t.monto;
    });

    const totalIncome = document.getElementById('totalIncome');
    const totalExpenses = document.getElementById('totalExpenses');
    const totalBalance = document.getElementById('totalBalance');

    console.log('[DEBUG] Rendering:', { monthlyIncome, monthlyExpense, globalBalance: globalStats.balance });

    // Mensuales
    if (totalIncome) totalIncome.textContent = formatCurrency(monthlyIncome);
    if (totalExpenses) totalExpenses.textContent = formatCurrency(monthlyExpense);

    // Global (Arrastre histórico)
    if (totalBalance) {
        totalBalance.textContent = formatCurrency(globalStats.balance);
    }
}

async function updateCharts(getMonthFilter) {
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

async function updateBudgetDisplay(getMonthFilter) {
    try {
        const [budgets, txs] = await Promise.all([
            API.get('category-budgets'),
            API.get('transactions')
        ]);

        const monthFilter = getMonthFilter();
        const currentMonthExpenses = txs.filter(t =>
            t.tipo === 'gasto' &&
            t.fecha &&
            t.fecha.startsWith(monthFilter) &&
            t.categoria !== 'Ahorro'
        );

        const expenseMap = {};
        let totalExpense = 0;
        currentMonthExpenses.forEach(t => {
            expenseMap[t.categoria] = (expenseMap[t.categoria] || 0) + t.monto;
            totalExpense += t.monto;
        });

        let totalBudget = 0;
        budgets.forEach(b => totalBudget += b.limite);

        const budgetProgress = document.getElementById('budgetProgress');
        const budgetText = document.getElementById('budgetText');

        if (budgetProgress && budgetText) {
            let percent = 0;
            if (totalBudget > 0) percent = (totalExpense / totalBudget) * 100;
            else if (totalExpense > 0) percent = 100;

            let color;
            if (totalBudget === 0 && totalExpense > 0) color = 'var(--danger)';
            else if (percent > 100) color = 'var(--danger)';
            else if (percent >= 100) color = 'var(--warning)';
            else color = '#22c55e';

            budgetProgress.style.width = `${Math.min(percent, 100)}%`;
            budgetProgress.style.background = color;

            budgetText.innerHTML = `
                <span>${percent.toFixed(0)}% usado</span>
                <span style="float:right">${formatCurrency(totalExpense)} / ${formatCurrency(totalBudget)}</span>
            `;
        }

        // Category breakdown
        const container = document.getElementById('categoryBudgetsContainer');
        if (container) {
            container.innerHTML = '';
            const allCategories = new Set([...budgets.map(b => b.categoria), ...Object.keys(expenseMap)]);

            allCategories.forEach(cat => {
                const b = budgets.find(b => b.categoria === cat) || { limite: 0 };
                const spent = expenseMap[cat] || 0;

                if (b.limite > 0 || spent > 0) {
                    let pct = 0;
                    if (b.limite > 0) pct = (spent / b.limite) * 100;
                    else if (spent > 0) pct = 100;

                    let color;
                    if (b.limite === 0 && spent > 0) color = 'var(--danger)';
                    else if (pct > 100) color = 'var(--danger)';
                    else if (pct >= 100) color = 'var(--warning)';
                    else color = '#22c55e';

                    const item = document.createElement('div');
                    item.className = 'category-budget-item';
                    item.innerHTML = `
                        <div class="cat-budget-info">
                            <span>${cat}</span>
                            <span>${formatCurrency(spent)} / ${formatCurrency(b.limite)}</span>
                        </div>
                        <div class="cat-budget-bar">
                            <div class="progress" style="width: ${Math.min(pct, 100)}%; background: ${color}"></div>
                        </div>
                    `;
                    container.appendChild(item);
                }
            });

            if (budgets.length === 0) {
                container.innerHTML = '<p class="text-muted text-center" style="font-size:0.9rem;">No tienes presupuestos configurados.</p>';
            }
        }

    } catch (err) {
        console.error('Error updating budget display:', err);
    }
}
