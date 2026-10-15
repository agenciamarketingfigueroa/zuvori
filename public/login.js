const form = document.querySelector('#login-form');
const password = document.querySelector('#password');
const toggle = document.querySelector('#toggle-password');
const status = document.querySelector('#login-status');
const submit = form.querySelector('[type=submit]');

toggle.addEventListener('click', () => {
  const visible = password.type === 'password';
  password.type = visible ? 'text' : 'password';
  toggle.setAttribute('aria-label', visible ? 'Ocultar senha' : 'Mostrar senha');
  toggle.setAttribute('aria-pressed', String(visible));
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  status.textContent = '';
  submit.disabled = true;
  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username: form.elements.username.value, password: password.value })
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'Não foi possível entrar.');
    location.assign(result.redirect);
  } catch (error) {
    status.textContent = error.message;
  } finally {
    password.value = '';
    password.type = 'password';
    toggle.setAttribute('aria-label', 'Mostrar senha');
    toggle.setAttribute('aria-pressed', 'false');
    submit.disabled = false;
  }
});
