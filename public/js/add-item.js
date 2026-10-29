// Add / edit item form. If the URL has ?id=5 the form edits that listing (owner only).
const form = document.getElementById('item-form');
const messageBox = document.getElementById('form-message');
const listingType = document.getElementById('listingType');
const priceGroup = document.getElementById('price-group');
const priceInput = document.getElementById('price');
const editId = getParam('id');
let user = null;

// Price is only relevant for "Sell" listings
function updatePriceVisibility() {
  const isSell = listingType.value === 'Sell';
  priceGroup.classList.toggle('hidden', !isSell);
  if (!isSell) priceInput.value = '';
}
listingType.addEventListener('change', updatePriceVisibility);

// Frontend validation (the server validates again, this only gives faster feedback)
function validateForm(values) {
  const errors = [];
  if (values.name.length < 3 || values.name.length > 120) errors.push('Item name must be 3 to 120 characters.');
  if (!values.category) errors.push('Choose a category.');
  if (values.description.length < 10) errors.push('Description must be at least 10 characters.');
  if (!values.condition) errors.push('Choose a condition.');
  if (!values.listingType) errors.push('Choose a listing type.');
  if (values.listingType === 'Sell' && values.price !== '') {
    const price = Number(values.price);
    if (!Number.isFinite(price) || price < 0) errors.push('Price cannot be negative.');
  }
  if (values.imageUrl && !/^https?:\/\/\S+$/i.test(values.imageUrl)) errors.push('Image URL must start with http:// or https://');
  return errors;
}

form.addEventListener('submit', async function (e) {
  e.preventDefault();
  hideMessage(messageBox);
  const values = {
    name: document.getElementById('name').value.trim(),
    category: document.getElementById('category').value,
    description: document.getElementById('description').value.trim(),
    condition: document.getElementById('condition').value,
    listingType: listingType.value,
    price: priceInput.value.trim(),
    imageUrl: document.getElementById('imageUrl').value.trim()
  };
  const errors = validateForm(values);
  if (errors.length) { showMessage(messageBox, 'error', 'Please fix the following:', errors.length > 1 ? errors : null); if (errors.length === 1) showMessage(messageBox, 'error', errors[0]); return; }

  const button = form.querySelector('button[type=submit]');
  button.disabled = true;
  try {
    if (editId) {
      await apiSend('PUT', '/api/items/' + encodeURIComponent(editId), values);
      showToast('Listing updated.', 'success');
      window.location.href = 'item-details.html?id=' + encodeURIComponent(editId);
    } else {
      const result = await apiSend('POST', '/api/items', values);
      window.location.href = 'item-details.html?id=' + result.id;
    }
  } catch (error) {
    showMessage(messageBox, 'error', error.message, error.details);
    button.disabled = false;
  }
});

(async function () {
  user = await initPage('add', { requireLogin: true });
  if (!user) return;
  document.getElementById('owner-name').textContent = user.fullName;

  if (editId) {
    document.getElementById('form-title').textContent = 'Edit your listing';
    form.querySelector('button[type=submit]').textContent = 'Save changes';
    try {
      const item = await apiGet('/api/items/' + encodeURIComponent(editId));
      if (item.owner_id !== user.id) { showMessage(messageBox, 'error', 'You can only edit your own listings.'); form.classList.add('hidden'); return; }
      document.getElementById('name').value = item.name;
      document.getElementById('category').value = item.category;
      document.getElementById('description').value = item.description;
      document.getElementById('condition').value = item.item_condition;
      listingType.value = item.listing_type;
      priceInput.value = item.price === null ? '' : item.price;
      document.getElementById('imageUrl').value = item.image_url || '';
    } catch (error) {
      showMessage(messageBox, 'error', error.message);
      form.classList.add('hidden');
    }
  }
  updatePriceVisibility();
})();
