// Handles the register, login and admin-login forms (the page's <form> has data-mode).
const authForm = document.getElementById('auth-form');
const authMessage = document.getElementById('auth-message');
const mode = authForm.dataset.mode; // "register" | "login" | "admin"

// Only allow redirecting to a page on this site (prevents open-redirect tricks)
function safeNextPage() {
  const next = getParam('next');
  return next && /^[a-z0-9-]+\.html(\?[A-Za-z0-9=&_.%-]*)?$/i.test(next) ? next : 'index.html';
}

// Show / hide password buttons
document.querySelectorAll('[data-toggle-password]').forEach(function (button) {
  button.addEventListener('click', function () {
    const input = document.getElementById(button.dataset.togglePassword);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.textContent = show ? 'Hide' : 'Show';
    button.setAttribute('aria-pressed', String(show));
  });
});

authForm.addEventListener('submit', async function (e) {
  e.preventDefault();
  hideMessage(authMessage);
  const button = authForm.querySelector('button[type=submit]');

  try {
    if (mode === 'register') {
      const body = {
        fullName: document.getElementById('fullName').value,
        email: document.getElementById('email').value,
        department: document.getElementById('department').value,
        password: document.getElementById('password').value,
        confirmPassword: document.getElementById('confirmPassword').value,
        agreeRules: document.getElementById('agreeRules').checked
      };
      if (body.password !== body.confirmPassword) { showMessage(authMessage, 'error', 'Passwords do not match.'); return; }
      button.disabled = true;
      await apiSend('POST', '/api/auth/register', body);
      showMessage(authMessage, 'success', 'Account created! Redirecting to login...');
      setTimeout(function () { window.location.href = 'login.html'; }, 1200);
    } else {
      button.disabled = true;
      const endpoint = mode === 'admin' ? '/api/auth/admin-login' : '/api/auth/login';
      const result = await apiSend('POST', endpoint, {
        email: document.getElementById('email').value,
        password: document.getElementById('password').value
      });
      setCsrfToken(result.csrfToken); // the session id changed on login, so the token did too
      window.location.href = mode === 'admin' ? 'admin.html' : safeNextPage();
    }
  } catch (error) {
    showMessage(authMessage, 'error', error.message, error.details);
    button.disabled = false;
  }
});

(async function () {
  const user = await initPage(mode === 'register' ? 'register' : 'login');
  if (user) window.location.href = user.role === 'admin' ? 'admin.html' : 'index.html'; // already logged in
})();
