// Builds the shared navbar and footer on every page, and handles login-required pages.
// Usage in a page script:  const user = await initPage('browse', { requireLogin: true });

// If any picture fails to load, swap in the local placeholder (no broken images)
document.addEventListener('error', function (event) {
  const el = event.target;
  if (el && el.tagName === 'IMG' && !el.dataset.fallbackUsed) {
    el.dataset.fallbackUsed = '1';
    el.src = 'assets/placeholder.svg';
  }
}, true);

function navLink(href, label, key, active) {
  return '<li><a href="' + href + '"' + (key === active ? ' class="active" aria-current="page"' : '') + '>' + label + '</a></li>';
}

function renderNavbar(active, user) {
  let links = navLink('index.html', 'Home', 'home', active) + navLink('browse.html', 'Browse', 'browse', active);
  if (user && user.role === 'student') {
    links += navLink('add-item.html', 'List an Item', 'add', active) +
             navLink('requests.html', 'Requests', 'requests', active) +
             navLink('profile.html', 'My Profile', 'profile', active);
  }
  if (user && user.role === 'admin') links += navLink('admin.html', 'Admin Dashboard', 'admin', active);
  links += navLink('about.html', 'About', 'about', active);
  if (user) {
    links += '<li class="nav-user">' + escapeHtml(user.fullName) + '</li>' +
             '<li><button type="button" class="link-button" id="logout-button">Log out</button></li>';
  } else {
    links += navLink('login.html', 'Log in', 'login', active) + navLink('register.html', 'Register', 'register', active);
  }
  return '<div class="container"><a href="index.html" class="logo">Re<span>Use</span>Hub</a>' +
         '<nav aria-label="Main navigation"><ul class="nav-links">' + links + '</ul></nav></div>';
}

function renderFooter() {
  return '<div class="container">' +
    '<p><strong>ReUseHub</strong> - Exchange More, Waste Less. A DevFusion inter-college hackathon project.</p>' +
    '<p>This is a student prototype for learning and demonstration, not a production marketplace. Meet in public campus areas and use your own judgement when exchanging items.</p>' +
    '</div>';
}

async function initPage(active, options) {
  options = options || {};
  let user = null;
  try {
    user = await loadSession();
  } catch (error) {
    user = null; // server unreachable: the page will show its own error
  }

  const header = document.getElementById('site-header');
  const footer = document.getElementById('site-footer');
  header.className = 'navbar';
  header.innerHTML = renderNavbar(active, user);
  footer.className = 'footer';
  footer.innerHTML = renderFooter();

  const logoutButton = document.getElementById('logout-button');
  if (logoutButton) {
    logoutButton.addEventListener('click', async function () {
      try { await apiSend('POST', '/api/auth/logout'); } catch (e) { /* ignore */ }
      window.location.href = 'index.html';
    });
  }

  // Frontend redirects are only for convenience; the server enforces the real rules.
  if (options.requireLogin && (!user || user.role !== 'student')) {
    window.location.href = user ? 'admin.html' : 'login.html?next=' + encodeURIComponent(window.location.pathname.split('/').pop() + window.location.search);
    return null;
  }
  if (options.requireAdmin && (!user || user.role !== 'admin')) {
    window.location.href = 'admin-login.html';
    return null;
  }
  return user;
}
