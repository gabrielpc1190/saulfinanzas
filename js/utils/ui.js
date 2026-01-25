/**
 * Muestra una notificación tipo Toast (burbuja flotante).
 * @param {string} message - Texto a mostrar
 * @param {'success'|'error'|'warning'|'info'} type - Tipo de alerta
 */
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span> ${message}`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => {
            if (toast.parentNode === container) {
                container.removeChild(toast);
            }
        }, 300);
    }, 4000);
}

export function showSaveStatus() {
    const el = document.getElementById('saveStatus');
    if (!el) return;
    el.textContent = 'Sincronizado ✅';
    el.style.color = 'var(--income)';
    setTimeout(() => {
        el.textContent = 'Datos en Servidor';
        el.style.color = 'var(--text-muted)';
    }, 2000);
}
