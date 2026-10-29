// Profile page: view/edit own profile and manage own listings.
const profileMessage = document.getElementById('profile-message');
const listingsBox = document.getElementById('my-listings');

async function loadProfile() {
  const data = await apiGet('/api/profile');
  document.getElementById('profile-email').textContent = data.profile.email;
  document.getElementById('profile-since').textContent = formatDate(data.profile.memberSince);
  document.getElementById('fullName').value = data.profile.fullName;
  document.getElementById('department').value = data.profile.department;
  document.getElementById('stat-listings').textContent = data.counts.listings;
  document.getElementById('stat-sent').textContent = data.counts.requestsSent;
  document.getElementById('stat-received').textContent = data.counts.requestsReceived;
}

async function loadListings() {
  try {
    const items = await apiGet('/api/items/mine');
    if (!items.length) {
      listingsBox.innerHTML = '<p class="message">You have no active listings. <a href="add-item.html">List your first item</a>.</p>';
      return;
    }
    listingsBox.innerHTML = items.map(function (item) {
      return '<article class="card"><div class="card-image">' + itemImageHtml(item) + '</div><div class="card-body">' +
        '<h3>' + escapeHtml(item.name) + '</h3>' +
        '<div><span class="badge">' + escapeHtml(item.category) + '</span><span class="badge badge-navy">' + escapeHtml(item.listing_type) + '</span>' +
        '<span class="badge ' + (item.is_available ? 'badge-ok' : 'badge-grey') + '">' + (item.is_available ? 'Available' : 'Unavailable') + '</span></div>' +
        '<p class="note">' + Number(item.pending_requests) + ' pending request(s)</p>' +
        '<div class="card-actions"><a class="btn btn-light btn-small" href="add-item.html?id=' + item.id + '">Edit</a>' +
        '<button type="button" class="btn btn-danger btn-small" data-remove="' + item.id + '">Remove</button></div></div></article>';
    }).join('');
  } catch (error) {
    listingsBox.innerHTML = '<p class="message message-error">' + escapeHtml(error.message) + '</p>';
  }
}

listingsBox.addEventListener('click', async function (e) {
  const button = e.target.closest('button[data-remove]');
  if (!button) return;
  if (!window.confirm('Remove this listing? Open requests for it will be cancelled.')) return;
  try {
    await apiSend('DELETE', '/api/items/' + button.dataset.remove);
    showToast('Listing removed.', 'success');
    loadListings();
    loadProfile();
  } catch (error) {
    showToast(error.message, 'error');
  }
});

document.getElementById('profile-form').addEventListener('submit', async function (e) {
  e.preventDefault();
  hideMessage(profileMessage);
  const body = {
    fullName: document.getElementById('fullName').value,
    department: document.getElementById('department').value,
    currentPassword: document.getElementById('currentPassword').value,
    newPassword: document.getElementById('newPassword').value
  };
  try {
    await apiSend('PUT', '/api/profile', body);
    showMessage(profileMessage, 'success', 'Profile updated.');
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    // reload so the navbar shows the new name
    setTimeout(function () { window.location.reload(); }, 800);
  } catch (error) {
    showMessage(profileMessage, 'error', error.message, error.details);
  }
});

(async function () {
  const user = await initPage('profile', { requireLogin: true });
  if (!user) return;
  try { await loadProfile(); } catch (error) { showMessage(profileMessage, 'error', error.message); }
  loadListings();
})();
