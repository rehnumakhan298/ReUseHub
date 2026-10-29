// Home page: featured items and real impact counters from the database.
async function loadFeaturedItems() {
  const container = document.getElementById('featured-items');
  try {
    const items = await apiGet('/api/items?limit=3');
    if (!items.length) {
      container.innerHTML = '<p class="message">No items listed yet. Be the first to list one!</p>';
      return;
    }
    container.innerHTML = items.map(itemCardHtml).join('');
  } catch (error) {
    container.innerHTML = '<p class="message message-error">Could not load items right now. Check that the server and database are running.</p>';
  }
}

async function loadImpact() {
  try {
    const impact = await apiGet('/api/impact');
    document.getElementById('count-completed').textContent = impact.completedExchanges;
    document.getElementById('count-student').textContent = impact.studentListings;
    document.getElementById('count-sample').textContent = impact.sampleListings;
    document.getElementById('count-available').textContent = impact.availableItems;
    document.getElementById('count-students').textContent = impact.students;
  } catch (error) {
    // counters keep their default "-" value if the API is unavailable
  }
}

(async function () {
  await initPage('home');
  loadFeaturedItems();
  loadImpact();
})();
