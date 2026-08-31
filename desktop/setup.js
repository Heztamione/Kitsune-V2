const form = document.getElementById('serverForm');
const input = document.getElementById('serverUrl');
const error = document.getElementById('error');
const button = document.getElementById('connect');

window.kitsuneDesktop.getServer().then(value => { if (value) input.value = value; });
form.addEventListener('submit', async event => {
  event.preventDefault();
  error.textContent = '';
  button.disabled = true;
  button.textContent = 'Checking server…';
  try { await window.kitsuneDesktop.setServer(input.value); }
  catch (reason) {
    error.textContent = reason.message || 'Could not connect to this server.';
    button.disabled = false;
    button.textContent = 'Connect securely';
  }
});
