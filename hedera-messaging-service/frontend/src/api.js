const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';


export async function getInfo() {
    const r = await fetch(`${BASE}/api/info`);
    return r.json();
}


export async function sendMessage(message, encrypt = true) {
    const r = await fetch(`${BASE}/api/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, encrypt })
    });
    return r.json();
}