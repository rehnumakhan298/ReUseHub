// Item details page: shows one item and lets an eligible student send a request or report it.
const detailBox = document.getElementById('item-detail');
const itemId = getParam('id');

function detailHtml(item) {
  const price = formatPrice(item);
  return '<div class="detail-layout">' +
    '<div class="detail-image">' + itemImageHtml(item) + '</div>' +
    '<div>' +
      '<h1 class="page-title">' + escapeHtml(item.name) + '</h1>' +
      '<div><span class="badge">' + escapeHtml(item.category) + '</span>' +
      '<span class="badge badge-navy">' + escapeHtml(item.listing_type) + '</span>' +
      (item.is_sample ? '<span class="badge badge-sample">Sample listing</span>' : '') +
      '<span class="badge ' + (item.is_available ? 'badge-ok' : 'badge-grey') + '">' + (item.is_available ? 'Available' : 'No longer available') + '</span></div>' +
      '<p>' + escapeHtml(item.description) + '</p>' +
      '<ul class="detail-list">' +
        '<li><span>Condition</span><span>' + escapeHtml(item.item_condition) + '</span></li>' +
        '<li><span>Listing type</span><span>' + escapeHtml(item.listing_type) + '</span></li>' +
        (price ? '<li><span>Price</span><span class="price">' + escapeHtml(price) + '</span></li>' : '') +
        '<li><span>Listed by</span><span>' + escapeHtml(item.owner_name) + '</span></li>' +
        '<li><span>Listed on</span><span>' + escapeHtml(formatDate(item.created_at)) + '</span></li>' +
      '</ul>' +
      '<div id="action-area"></div>' +
    '</div></div>';
}

function renderActions(item, user) {
  const area = document.getElementById('action-area');
  if (!user) {
    area.innerHTML = '<p class="message message-info">Log in as a student to request this item. ' +
      '<a href="login.html?next=' + encodeURIComponent('item-details.html?id=' + item.id) + '">Log in</a> or <a href="register.html">create an account</a>.</p>';
    return;
  }
  if (user.role !== 'student') {
    area.innerHTML = '<p class="message">Administrator accounts cannot request items.</p>';
    return;
  }
  if (user.id === item.owner_id) {
    area.innerHTML = '<p class="message message-info">This is your listing.</p>' +
      '<p><a class="btn btn-light" href="add-item.html?id=' + item.id + '">Edit listing</a></p>';
    return;
  }
  if (!item.is_available) {
    area.innerHTML = '<p class="message">This item is no longer available.</p>';
    return;
  }

  const offerField = item.listing_type === 'Exchange'
    ? '<div class="form-group"><label for="offered">What can you offer in exchange? (optional)</label>' +
      '<input type="text" id="offered" maxlength="150" placeholder="e.g. my Physics notes"></div>'
    : '';
  const verb = item.listing_type === 'Sell' ? 'Send enquiry' : 'Send request';
  area.innerHTML =
    '<form id="request-form" class="form-card" novalidate>' +
      '<h2>' + (item.listing_type === 'Sell' ? 'Ask about this item' : 'Request this item') + '</h2>' +
      '<div id="request-message" class="hidden" role="alert"></div>' +
      '<div class="form-group"><label for="request-text">Message to the owner</label>' +
      '<textarea id="request-text" maxlength="500" placeholder="Say when and why you need it."></textarea>' +
      '<div class="hint">5 to 500 characters.</div></div>' + offerField +
      '<button type="submit" class="btn btn-primary">' + verb + '</button>' +
    '</form>' +
    '<p><button type="button" id="report-toggle" class="btn btn-light btn-small">Report this listing</button></p>' +
    '<form id="report-form" class="form-card hidden" novalidate>' +
      '<div id="report-message" class="hidden" role="alert"></div>' +
      '<div class="form-group"><label for="report-reason">Why are you reporting this listing?</label>' +
      '<textarea id="report-reason" maxlength="500"></textarea></div>' +
      '<button type="submit" class="btn btn-danger btn-small">Submit report</button></form>';

  document.getElementById('request-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const box = document.getElementById('request-message');
    const message = document.getElementById('request-text').value.trim();
    if (message.length < 5) { showMessage(box, 'error', 'Write a short message (at least 5 characters).'); return; }
    const offered = document.getElementById('offered');
    try {
      await apiSend('POST', '/api/requests', { itemId: item.id, message: message, offeredItem: offered ? offered.value : '' });
      showMessage(box, 'success', 'Request sent! Track it on the Requests page.');
      e.target.querySelector('button[type=submit]').disabled = true;
    } catch (error) {
      showMessage(box, 'error', error.message, error.details);
    }
  });

  document.getElementById('report-toggle').addEventListener('click', function () {
    document.getElementById('report-form').classList.toggle('hidden');
  });
  document.getElementById('report-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const box = document.getElementById('report-message');
    const reason = document.getElementById('report-reason').value.trim();
    if (reason.length < 5) { showMessage(box, 'error', 'Please describe the problem (at least 5 characters).'); return; }
    try {
      await apiSend('POST', '/api/reports', { itemId: item.id, reason: reason });
      showMessage(box, 'success', 'Report submitted. An administrator will review it.');
      e.target.querySelector('button[type=submit]').disabled = true;
    } catch (error) {
      showMessage(box, 'error', error.message);
    }
  });
}

(async function () {
  const user = await initPage('browse');
  if (!itemId) { detailBox.innerHTML = '<p class="message message-error">No item selected. <a href="browse.html">Browse items</a>.</p>'; return; }
  try {
    const item = await apiGet('/api/items/' + encodeURIComponent(itemId));
    document.title = item.name + ' - ReUseHub';
    detailBox.innerHTML = detailHtml(item);
    renderActions(item, user);
  } catch (error) {
    detailBox.innerHTML = '<p class="message message-error">' + escapeHtml(error.message) + ' <a href="browse.html">Back to browse</a></p>';
  }
})();
