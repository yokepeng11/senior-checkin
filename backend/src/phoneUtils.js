/**
 * Normalise a phone number to a canonical local form for consistent comparison.
 *
 * Rules:
 *  - Strip all non-digit characters
 *  - Remove the Singapore +65 country-code prefix ONLY when it produces an
 *    8-digit local number (e.g. "+6591234567" → "91234567")
 *  - Everything else (test numbers, landlines, short codes) kept as-is
 *
 * This means "82687111", "+6582687111", and "+65 8268 7111" all normalise to
 * "82687111" and will match each other.
 */
function normalisePhone(raw) {
  if (!raw) return '';
  const d = raw.replace(/\D/g, '');
  return (d.startsWith('65') && d.length === 10) ? d.slice(2) : d;
}

module.exports = { normalisePhone };
