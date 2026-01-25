/**
 * Cliente HTTP centralizado para interactuar con el backend.
 * Maneja headers, serialización JSON y normalización de errores.
 */
export const API = {
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
