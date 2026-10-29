// Requests page: incoming/outgoing requests, status buttons and a simple chat per request.
// Status rules are enforced by the server; the buttons shown here just match those rules.
const listBox = document.getElementById('request-list');
const tabButtons = document.querySelectorAll('.tab');
let currentBox = 'incoming';
let me = null;
let openChatId = null;
let chatTimer = null;

const STATUS_BADGE = { Pending: 'badge-warn', Accepted: 'badge-ok', Completed: 'badge-navy', Rejected: 'badge-bad', Cancelled: 'badge-grey' };

// Which actions this user may take on a request (mirrors the server's transition table)
function actionsFor(request) {
  const isOwner = request.your_role === 'owner';
  const actions = [];
  if (request.status === 'Pending') {
    if (isOwner) { actions.push(['Accepted', 'Accept', 'btn-primary']); actions.push(['Rejected', 'Reject', 'btn-danger']); }
    else actions.push(['Cancelled', 'Cancel request', 'btn-danger']);
  }
  if (request.status === 'Accepted') {
    if (isOwner) actions.push(['Completed', 'Mark as completed', 'btn-primary']);
    actions.push(['Cancelled', 'Cancel', 'btn-danger']);
  }
  return actions;
}

function requestHtml(r) {
  const other = r.your_role === 'owner' ? 'Requested by ' + r.requester_name : 'Owner: ' + r.owner_name;
  const buttons = actionsFor(r).map(function (a) {
    return '<button type="button" class="btn btn-small ' + a[2] + '" data-action="status" data-id="' + r.id + '" data-status="' + a[0] + '">' + a[1] + '</button>';
  }).join('');
  return '<article class="request-card" id="request-' + r.id + '">' +
    '<div class="request-head"><h3><a href="item-details.html?id=' + r.item_id + '">' + escapeHtml(r.item_name) + '</a></h3>' +
    '<span class="badge ' + (STATUS_BADGE[r.status] || 'badge-grey') + '">' + escapeHtml(r.status) + '</span></div>' +
    '<p class="request-meta">' + escapeHtml(other) + ' - ' + escapeHtml(r.listing_type) + ' - ' + escapeHtml(formatDate(r.created_at)) + '</p>' +
    '<p>' + escapeHtml(r.message) + '</p>' +
    (r.offered_item ? '<p><strong>Offered in exchange:</strong> ' + escapeHtml(r.offered_item) + '</p>' : '') +
    '<div class="card-actions">' + buttons +
    '<button type="button" class="btn btn-light btn-small" data-action="chat" data-id="' + r.id + '">Chat</button></div>' +
    '<div class="chat-box hidden" id="chat-' + r.id + '"></div>' +
    '</article>';
}

async function loadRequests() {
  closeChat();
  listBox.innerHTML = '<p class="message">Loading requests...</p>';
  try {
    const requests = await apiGet('/api/requests?box=' + currentBox);
    if (!requests.length) {
      listBox.innerHTML = '<p class="message">' + (currentBox === 'incoming'
        ? 'No one has requested your items yet.'
        : 'You have not requested any items yet. <a href="browse.html">Browse items</a>.') + '</p>';
      return;
    }
    listBox.innerHTML = requests.map(requestHtml).join('');
  } catch (error) {
    listBox.innerHTML = '<p class="message message-error">' + escapeHtml(error.message) + '</p>';
  }
}

// ---- chat (simple polling every 5 seconds while a chat panel is open) ----
function closeChat() {
  clearInterval(chatTimer);
  chatTimer = null;
  openChatId = null;
}

async function refreshChat(id) {
  const box = document.getElementById('chat-' + id);
  if (!box) return;
  try {
    const data = await apiGet('/api/requests/' + id + '/messages');
    const log = box.querySelector('.chat-log');
    const atBottom = !log || log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    const html = data.messages.length
      ? data.messages.map(function (m) {
          return '<div class="chat-msg' + (m.mine ? ' mine' : '') + '"><small>' + escapeHtml(m.mine ? 'You' : m.sender_name) + ' - ' + escapeHtml(formatDateTime(m.created_at)) + '</small>' + escapeHtml(m.body) + '</div>';
        }).join('')
      : '<p class="note">No messages yet. Say hello and agree on a meeting place on campus.</p>';
    if (!log) {
      box.innerHTML = '<div class="chat-log" id="chat-log-' + id + '">' + html + '</div>' +
        (data.canSend
          ? '<form class="chat-form" data-id="' + id + '"><label class="hidden" for="chat-input-' + id + '">Message</label>' +
            '<input type="text" id="chat-input-' + id + '" maxlength="500" placeholder="Type a message" autocomplete="off">' +
            '<button type="submit" class="btn btn-dark btn-small">Send</button></form>'
          : '<p class="note">Chat is closed because this request is ' + escapeHtml(data.status.toLowerCase()) + '.</p>');
    } else {
      log.innerHTML = html;
      if (atBottom) log.scrollTop = log.scrollHeight;
    }
    const newLog = box.querySelector('.chat-log');
    if (newLog && !log) newLog.scrollTop = newLog.scrollHeight;
  } catch (error) {
    box.innerHTML = '<p class="message message-error">' + escapeHtml(error.message) + '</p>';
  }
}

function toggleChat(id) {
  const wasOpen = openChatId === id;
  document.querySelectorAll('.chat-box').forEach(function (b) { b.classList.add('hidden'); b.innerHTML = ''; });
  closeChat();
  if (wasOpen) return;
  openChatId = id;
  document.getElementById('chat-' + id).classList.remove('hidden');
  refreshChat(id);
  chatTimer = setInterval(function () { refreshChat(id); }, 5000);
}

// ---- click handling (event delegation keeps the code short) ----
listBox.addEventListener('click', async function (e) {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const id = button.dataset.id;
  if (button.dataset.action === 'chat') { toggleChat(id); return; }
  if (button.dataset.action === 'status') {
    const status = button.dataset.status;
    const confirmText = status === 'Completed'
      ? 'Mark this exchange as completed? The item will become unavailable and other open requests will be rejected.'
      : 'Change this request to "' + status + '"?';
    if (!window.confirm(confirmText)) return;
    button.disabled = true;
    try {
      const result = await apiSend('PATCH', '/api/requests/' + id + '/status', { status: status });
      showToast(result.message, 'success');
      loadRequests();
    } catch (error) {
      showToast(error.message, 'error');
      button.disabled = false;
    }
  }
});

listBox.addEventListener('submit', async function (e) {
  const chatForm = e.target.closest('.chat-form');
  if (!chatForm) return;
  e.preventDefault();
  const input = chatForm.querySelector('input');
  const body = input.value.trim();
  if (!body) return;
  try {
    await apiSend('POST', '/api/requests/' + chatForm.dataset.id + '/messages', { body: body });
    input.value = '';
    refreshChat(chatForm.dataset.id);
  } catch (error) {
    showToast(error.message, 'error');
  }
});

tabButtons.forEach(function (tab) {
  tab.addEventListener('click', function () {
    currentBox = tab.dataset.box;
    tabButtons.forEach(function (t) { t.setAttribute('aria-selected', String(t === tab)); });
    loadRequests();
  });
});

(async function () {
  me = await initPage('requests', { requireLogin: true });
  if (me) loadRequests();
})();
