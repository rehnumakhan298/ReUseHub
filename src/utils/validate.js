// Small input-validation helpers shared by all routes.

const CATEGORIES = ['Books', 'Stationery', 'Lab Essentials', 'Other'];
const CONDITIONS = ['New', 'Like New', 'Good', 'Fair'];
const LISTING_TYPES = ['Give Away', 'Exchange', 'Sell'];

// Trim and collapse a value to a string ('' if missing)
function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 150;
}

// Password policy: at least 8 characters, with a letter and a number (max 72 for bcrypt).
function passwordProblem(password) {
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 72) return 'Password must be at most 72 characters.';
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) return 'Password must contain at least one letter and one number.';
  return null;
}

// Validates an item form body. Returns { errors: [...], values: {...} }.
function validateItem(body) {
  const errors = [];
  const values = {
    name: cleanText(body.name),
    category: cleanText(body.category),
    description: cleanText(body.description),
    item_condition: cleanText(body.condition),
    listing_type: cleanText(body.listingType),
    price: null,
    image_url: cleanText(body.imageUrl) || null
  };

  if (values.name.length < 3 || values.name.length > 120) errors.push('Item name must be 3 to 120 characters.');
  if (!CATEGORIES.includes(values.category)) errors.push('Choose a valid category.');
  if (values.description.length < 10 || values.description.length > 1000) errors.push('Description must be 10 to 1000 characters.');
  if (!CONDITIONS.includes(values.item_condition)) errors.push('Choose a valid condition.');
  if (!LISTING_TYPES.includes(values.listing_type)) errors.push('Choose a valid listing type.');

  // Price only applies to "Sell" listings and is optional (empty = ask the owner).
  const rawPrice = body.price === undefined || body.price === null ? '' : String(body.price).trim();
  if (values.listing_type === 'Sell' && rawPrice !== '') {
    const price = Number(rawPrice);
    if (!Number.isFinite(price) || price < 0 || price > 100000) {
      errors.push('Price must be a number between 0 and 100000.');
    } else {
      values.price = Math.round(price * 100) / 100;
    }
  }

  if (values.image_url) {
    if (values.image_url.length > 500 || !/^https?:\/\/\S+$/i.test(values.image_url)) {
      errors.push('Image URL must start with http:// or https://.');
    }
  }
  return { errors, values };
}

module.exports = { CATEGORIES, CONDITIONS, LISTING_TYPES, cleanText, isValidEmail, passwordProblem, validateItem };
