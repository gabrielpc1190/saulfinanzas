/**
 * Muestra el modal de confirmación personalizado.
 * @param {string} title - Título del modal
 * @param {string} message - Mensaje descriptivo
 * @param {Function} onConfirm - Callback a ejecutar si se confirma
 */
export function showConfirm(title, message, onConfirm) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const msgEl = document.getElementById('confirmMessage');
    const okBtn = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');

    if (!modal) return;

    titleEl.textContent = title;
    msgEl.textContent = message;

    // Reset handlers clonando botones
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

export function closeModal() {
    document.querySelectorAll('.modal').forEach(m => m.style.display = 'none');
    document.getElementById('transactionForm')?.reset();
}

export function initModalHandlers(handlers = {}) {
    const { onAddIncome, onAddExpense, onSave, onClose } = handlers;

    if (document.getElementById('addIncomeBtn')) document.getElementById('addIncomeBtn').onclick = onAddIncome;
    if (document.getElementById('addExpenseBtn')) document.getElementById('addExpenseBtn').onclick = onAddExpense;
    if (document.getElementById('btnSave')) document.getElementById('btnSave').onclick = onSave;
    if (document.getElementById('closeModal')) document.getElementById('closeModal').onclick = onClose || closeModal;

    document.querySelectorAll('.modal').forEach(modal => {
        if (modal.id === 'confirmModal') return;
        modal.onclick = (e) => { if (e.target === modal) (onClose || closeModal)(); };
    });
}
