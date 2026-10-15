document.getElementById('setupForm').addEventListener('submit', async event => {
    event.preventDefault();
    const button = event.target.querySelector('button');
    button.disabled = true;
    const message = document.getElementById('setupMessage');
    try {
        const res = await fetch('/api/setup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ setupToken: document.getElementById('setupKey').value, name: document.getElementById('setupName').value.trim(), username: document.getElementById('setupUsername').value.trim(), password: document.getElementById('setupPassword').value }) });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error);
        event.target.reset();
        event.target.hidden = true;
        message.textContent = 'Administrator created. Return to sign in with your new credentials.';
    } catch (error) { message.textContent = error.message; button.disabled = false; }
});
