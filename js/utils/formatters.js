export function formatCurrency(amount) {
    return '₡ ' + (amount || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
