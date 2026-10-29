// Admin dashboard. All data comes from /api/admin/* which the server restricts to admins.
const panel = document.getElementById('admin-panel');
const tabs = document.querySelectorAll('.tab');

function table(headers, rows) {
  if (!rows.length) return '<p class="message">Nothing to show yet.</p>';
  return '<div class="table-wrap"><table><thead><tr>' + headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') +
    '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>';
}
function td(value) { return '<td>' + escapeHtml(value) + '</td>'; }
function statusBadge(text, cls) { return '<span class="badge ' + cls + '">' + escapeHtml(text) + '</span>'; }

const views = {
  async overview() {
    const s = await apiGet('/api/admin/stats');
    const cards = [
      ['Students', s.students], ['Deactivated students', s.deactivatedStudents], ['Active listings', s.activeListings],
      ['Sample listings', s.sampleListings], ['Removed listings', s.removedListings], ['Total requests', s.totalRequests],
      ['Pending requests', s.pendingRequests], ['Completed exchanges', s.completedExchanges], ['Open reports', s.openReports]
    ];
    return '<div class="grid stats-grid">' + cards.map(function (c) {
      return '<div class="card counter"><div class="number">' + Number(c[1]) + '</div><div class="label">' + c[0] + '</div></div>';
    }).join('') + '</div>' +
    '<h2 class="section-title">Active listings by category</h2>' +
    table(['Category', 'Listings'], s.byCategory.map(function (c) { return '<tr>' + td(c.category) + td(c.total) + '</tr>'; })) +
    '<p class="note">"Completed exchanges" counts requests marked Completed by item owners. Sample listings are demo data.</p>';
  },
  async users() {
    const users = await apiGet('/api/admin/users');
    return table(['Name', 'Email', 'Department', 'Role', 'Listings', 'Joined', 'Status', ''], users.map(function (u) {
      const action = u.role === 'student'
        ? '<button type="button" class="btn btn-small ' + (u.is_active ? 'btn-danger' : 'btn-light') + '" data-user="' + u.id + '" data-active="' + (u.is_active ? 'false' : 'true') + '">' + (u.is_active ? 'Deactivate' : 'Reactivate') + '</button>'
        : '';
      return '<tr>' + td(u.full_name) + td(u.email) + td(u.department) + td(u.role) + td(u.listings) + td(formatDate(u.created_at)) +
        '<td>' + statusBadge(u.is_active ? 'Active' : 'Deactivated', u.is_active ? 'badge-ok' : 'badge-bad') + '</td><td>' + action + '</td></tr>';
    }));
  },
  async items() {
    const items = await apiGet('/api/admin/items');
    return table(['Item', 'Category', 'Type', 'Owner', 'Listed', 'Status', ''], items.map(function (i) {
      const action = i.status === 'active'
        ? '<button type="button" class="btn btn-small btn-danger" data-remove-item="' + i.id + '">Remove</button>' : '';
      return '<tr><td><a href="item-details.html?id=' + i.id + '">' + escapeHtml(i.name) + '</a>' + (i.is_sample ? ' ' + statusBadge('Sample', 'badge-sample') : '') + '</td>' +
        td(i.category) + td(i.listing_type) + td(i.owner_name) + td(formatDate(i.created_at)) +
        '<td>' + statusBadge(i.status === 'removed' ? 'Removed' : (i.is_available ? 'Available' : 'Unavailable'), i.status === 'removed' ? 'badge-bad' : (i.is_available ? 'badge-ok' : 'badge-grey')) + '</td><td>' + action + '</td></tr>';
    }));
  },
  async reports() {
    const reports = await apiGet('/api/admin/reports');
    return table(['Item', 'Reason', 'Reported by', 'Date', 'Status', 'Actions'], reports.map(function (r) {
      const actions = r.status === 'Open'
        ? (r.item_status === 'active' ? '<button type="button" class="btn btn-small btn-danger" data-report="' + r.id + '" data-action="remove_item">Remove item</button> ' : '') +
          '<button type="button" class="btn btn-small btn-light" data-report="' + r.id + '" data-action="dismiss">Dismiss</button> ' +
          '<button type="button" class="btn btn-small btn-light" data-report="' + r.id + '" data-action="resolve">Mark resolved</button>'
        : '';
      return '<tr>' + td(r.item_name + (r.item_status === 'removed' ? ' (removed)' : '')) + td(r.reason) + td(r.reporter_name) + td(formatDate(r.created_at)) +
        '<td>' + statusBadge(r.status, r.status === 'Open' ? 'badge-warn' : 'badge-grey') + '</td><td>' + actions + '</td></tr>';
    }));
  },
  async requests() {
    const requests = await apiGet('/api/admin/requests');
    return table(['Item', 'Requested by', 'Owner', 'Date', 'Status'], requests.map(function (r) {
      return '<tr>' + td(r.item_name) + td(r.requester_name) + td(r.owner_name) + td(formatDate(r.created_at)) + td(r.status) + '</tr>';
    }));
  }
};

let currentView = 'overview';
async function showView(name) {
  currentView = name;
  tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t.dataset.view === name)); });
  panel.innerHTML = '<p class="message">Loading...</p>';
  try {
    panel.innerHTML = await views[name]();
  } catch (error) {
    panel.innerHTML = '<p class="message message-error">' + escapeHtml(error.message) + '</p>';
  }
}

tabs.forEach(function (tab) { tab.addEventListener('click', function () { showView(tab.dataset.view); }); });

// One click handler for all admin action buttons
panel.addEventListener('click', async function (e) {
  const button = e.target.closest('button');
  if (!button) return;
  try {
    if (button.dataset.user) {
      const activate = button.dataset.active === 'true';
      if (!window.confirm(activate ? 'Reactivate this account?' : 'Deactivate this account? The student will not be able to log in.')) return;
      await apiSend('PATCH', '/api/admin/users/' + button.dataset.user + '/active', { isActive: activate });
    } else if (button.dataset.removeItem) {
      if (!window.confirm('Remove this listing? Its open requests will be cancelled.')) return;
      await apiSend('DELETE', '/api/admin/items/' + button.dataset.removeItem);
    } else if (button.dataset.report) {
      if (button.dataset.action === 'remove_item' && !window.confirm('Remove the reported listing?')) return;
      await apiSend('PATCH', '/api/admin/reports/' + button.dataset.report, { action: button.dataset.action });
    } else {
      return;
    }
    showToast('Done.', 'success');
    showView(currentView);
  } catch (error) {
    showToast(error.message, 'error');
  }
});

(async function () {
  const user = await initPage('admin', { requireAdmin: true });
  if (user) showView('overview');
})();
