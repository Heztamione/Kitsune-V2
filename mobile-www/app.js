const form = document.getElementById('serverForm');
const input = document.getElementById('serverUrl');
const error = document.getElementById('error');

input.value = localStorage.getItem('kitsuneServerUrl') || '';
form.addEventListener('submit', event => {
  event.preventDefault();
  error.textContent = '';
  try {
    const value = input.value.trim();
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') throw new Error('Kitsune Android requires an HTTPS server.');
    if (parsed.username || parsed.password) throw new Error('URLs containing credentials are not allowed.');
    const origin = parsed.origin;
    localStorage.setItem('kitsuneServerUrl', origin);
    // Navigate to the server's web app. The WebView will show any load failure.
    location.assign(`${origin}/app/`);
  } catch (reason) { error.textContent = reason.message || 'Enter a valid Kitsune URL.'; }
});
