// Shared helpers used by every page. Page scripts never call fetch() directly.

let csrfToken = '';
let currentUser = null;

// Core request function: sends JSON, attaches the CSRF token on changes, throws readable errors.
async function request(method, url, body) {
  const options = { method: method, headers: {}, credentials: 'same-origin' };
  if (method !== 'GET') {
    options.headers['Content-Type'] = 'application/json';
    options.headers['X-CSRF-Token'] = csrfToken;
    options.body = JSON.stringify(body || {});
  }
  const response = await fetch(url, options);
  const data = await response.json().catch(function () { return {}; });
  if (!response.ok) {
    const error = new Error(data.error || 'Request failed (status ' + response.status + ')');
    error.status = response.status;
    error.details = data.details || [];
    throw error;
  }
  return data;
}

function apiGet(url) { return request('GET', url); }
function apiSend(method, url, body) { return request(method, url, body); }

// Asks the server who is logged in, and gets the CSRF token. Called once per page by initPage().
async function loadSession() {
  const data = await apiGet('/api/auth/me');
  csrfToken = data.csrfToken;
  currentUser = data.user;
  return currentUser;
}

function setCsrfToken(token) { csrfToken = token; }

// Prevents user-entered text from being interpreted as HTML (XSS protection)
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

function formatDate(value) {
  const date = new Date(value);
  return isNaN(date) ? '' : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(value) {
  const date = new Date(value);
  return isNaN(date) ? '' : date.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// Shows a message box (type: error | success | info) inside a container element.
// "details" can be an array of extra lines (e.g. several validation errors).
function showMessage(element, type, text, details) {
  let html = escapeHtml(text);
  if (details && details.length > 1) {
    html += '<ul>' + details.map(function (d) { return '<li>' + escapeHtml(d) + '</li>'; }).join('') + '</ul>';
  }
  element.className = 'message message-' + type;
  element.innerHTML = html;
  element.classList.remove('hidden');
}

function hideMessage(element) {
  element.classList.add('hidden');
  element.innerHTML = '';
}

// Small pop-up notification in the bottom-right corner
function showToast(text, type) {
  let area = document.getElementById('toast-area');
  if (!area) {
    area = document.createElement('div');
    area.id = 'toast-area';
    area.className = 'toast-area';
    area.setAttribute('role', 'status');
    document.body.appendChild(area);
  }
  const toast = document.createElement('div');
  toast.className = 'toast' + (type ? ' toast-' + type : '');
  toast.textContent = text;
  area.appendChild(toast);
  setTimeout(function () { toast.remove(); }, 4000);
}

// Builds the HTML for an item picture. Broken images fall back to the placeholder (see layout.js).
function itemImageHtml(item) {
  const src = item.image_url ? escapeHtml(item.image_url) : 'assets/placeholder.svg';
  return '<img src="' + src + '" alt="' + escapeHtml(item.name) + '" loading="lazy">';
}

function formatPrice(item) {
  if (item.listing_type !== 'Sell') return '';
  return item.price === null || item.price === undefined ? 'Price: ask owner' : 'Rs. ' + Number(item.price).toFixed(2);
}

// One item card, reused on the home page and browse page
function itemCardHtml(item) {
  const price = formatPrice(item);
  return '<article class="card">' +
    '<div class="card-image">' + itemImageHtml(item) + '</div>' +
    '<div class="card-body">' +
      '<h3>' + escapeHtml(item.name) + '</h3>' +
      '<div><span class="badge">' + escapeHtml(item.category) + '</span>' +
      '<span class="badge badge-navy">' + escapeHtml(item.item_condition) + '</span>' +
      '<span class="badge badge-navy">' + escapeHtml(item.listing_type) + '</span>' +
      (item.is_sample ? '<span class="badge badge-sample">Sample</span>' : '') + '</div>' +
      (price ? '<p class="price">' + escapeHtml(price) + '</p>' : '') +
      '<p><span class="badge ' + (item.is_available ? 'badge-ok' : 'badge-grey') + '">' + (item.is_available ? 'Available' : 'Unavailable') + '</span></p>' +
      '<div class="card-actions"><a class="btn btn-dark btn-small" href="item-details.html?id=' + encodeURIComponent(item.id) + '">View Details</a></div>' +
    '</div></article>';
}
