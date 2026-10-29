// Browse page: search + filters, results come from GET /api/items.
const searchInput = document.getElementById('search');
const categorySelect = document.getElementById('category');
const conditionSelect = document.getElementById('condition');
const typeSelect = document.getElementById('type');
const resultsBox = document.getElementById('results');
const resultCount = document.getElementById('result-count');
let searchTimer = null;
let requestCounter = 0; // ignore out-of-date responses when typing quickly

async function loadItems() {
  const thisRequest = ++requestCounter;
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set('q', searchInput.value.trim());
  if (categorySelect.value) params.set('category', categorySelect.value);
  if (conditionSelect.value) params.set('condition', conditionSelect.value);
  if (typeSelect.value) params.set('type', typeSelect.value);

  resultsBox.innerHTML = '<p class="message">Loading items...</p>';
  try {
    const items = await apiGet('/api/items?' + params.toString());
    if (thisRequest !== requestCounter) return;
    resultCount.textContent = items.length + (items.length === 1 ? ' item found' : ' items found');
    if (!items.length) {
      resultsBox.innerHTML = '<p class="message">No items match your search. Try different words or clear the filters.</p>';
      return;
    }
    resultsBox.innerHTML = items.map(itemCardHtml).join('');
  } catch (error) {
    if (thisRequest !== requestCounter) return;
    resultCount.textContent = '';
    resultsBox.innerHTML = '<p class="message message-error">Could not load items: ' + escapeHtml(error.message) + '</p>';
  }
}

searchInput.addEventListener('input', function () {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadItems, 300); // wait until the user pauses typing
});
[categorySelect, conditionSelect, typeSelect].forEach(function (el) { el.addEventListener('change', loadItems); });
document.getElementById('clear-filters').addEventListener('click', function () {
  searchInput.value = ''; categorySelect.value = ''; conditionSelect.value = ''; typeSelect.value = '';
  loadItems();
});
document.getElementById('filter-form').addEventListener('submit', function (e) { e.preventDefault(); loadItems(); });

(async function () {
  await initPage('browse');
  // Home page category links use ?category=Books etc.
  const preset = getParam('category');
  if (preset) categorySelect.value = preset;
  loadItems();
})();
