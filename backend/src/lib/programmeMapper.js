/**
 * Programme Name Normalization and Mapping
 * 
 * This module handles the normalization of programme names from various sources
 * (bulk uploads, manual entry, etc.) to ensure consistency in the database.
 */

// Official programme names (the canonical versions)
const OFFICIAL_PROGRAMMES = {
  BIT: 'Bachelor of Information Technology (BIT)',
  BNSA: 'BSc Networking and Systems Administration (BNSA)',
  DIT: 'Diploma in Information Technology (DIT)'
};

// Mapping of variations to official names
const PROGRAMME_VARIATIONS = {
  // BIT variations
  'bit': 'BIT',
  'bachelor of information technology': 'BIT',
  'bsc information technology': 'BIT',
  'bsc. information technology': 'BIT',
  'bsc.information technology': 'BIT',
  'b.i.t': 'BIT',
  'b.i.t.': 'BIT',
  
  // BNSA variations
  'bnsa': 'BNSA',
  'bsc networking and systems administration': 'BNSA',
  'bsc. networking and systems administration': 'BNSA',
  'bsc.networking and systems administration': 'BNSA',
  'bsc network & system admin': 'BNSA',
  'bsc.network &system admin': 'BNSA',
  'networking and systems administration': 'BNSA',
  'network and system admin': 'BNSA',
  
  // DIT variations
  'dit': 'DIT',
  'diploma in information technology': 'DIT',
  'diploma information technology': 'DIT',
  'd.i.t': 'DIT',
  'd.i.t.': 'DIT'
};

/**
 * Normalize a programme name to its official version
 * @param {string} programmeName - The programme name to normalize
 * @returns {string|null} - The official programme name or null if not found
 */
function normalizeProgrammeName(programmeName) {
  if (!programmeName) return null;
  
  // Clean the input: lowercase, remove extra spaces, remove special chars
  const cleaned = programmeName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')  // Replace multiple spaces with single space
    .replace(/[.,]/g, ''); // Remove periods and commas
  
  // Check if it's already an official name
  const officialKey = Object.keys(OFFICIAL_PROGRAMMES).find(
    key => OFFICIAL_PROGRAMMES[key].toLowerCase() === cleaned
  );
  if (officialKey) {
    return OFFICIAL_PROGRAMMES[officialKey];
  }
  
  // Look up in variations map
  const mappedKey = PROGRAMME_VARIATIONS[cleaned];
  if (mappedKey) {
    return OFFICIAL_PROGRAMMES[mappedKey];
  }
  
  // Not found
  return null;
}

/**
 * Get the short code for a programme (BIT, BNSA, DIT)
 * @param {string} programmeName - The programme name
 * @returns {string|null} - The short code or null
 */
function getProgrammeCode(programmeName) {
  const normalized = normalizeProgrammeName(programmeName);
  if (!normalized) return null;
  
  // Extract code from official name (text in parentheses)
  const match = normalized.match(/\(([^)]+)\)/);
  return match ? match[1] : null;
}

/**
 * Check if a programme name is valid (can be normalized)
 * @param {string} programmeName - The programme name to check
 * @returns {boolean} - True if valid, false otherwise
 */
function isValidProgramme(programmeName) {
  return normalizeProgrammeName(programmeName) !== null;
}

/**
 * Get all official programme names
 * @returns {Array<string>} - Array of official programme names
 */
function getOfficialProgrammes() {
  return Object.values(OFFICIAL_PROGRAMMES);
}

/**
 * Get suggestions for a programme name (fuzzy matching)
 * @param {string} programmeName - The programme name to match
 * @returns {Array<string>} - Array of suggested official names
 */
function getSuggestions(programmeName) {
  if (!programmeName) return [];
  
  const cleaned = programmeName.toLowerCase().trim();
  const suggestions = [];
  
  // Check for partial matches
  Object.entries(OFFICIAL_PROGRAMMES).forEach(([key, officialName]) => {
    if (cleaned.includes(key.toLowerCase()) || 
        officialName.toLowerCase().includes(cleaned)) {
      suggestions.push(officialName);
    }
  });
  
  return suggestions;
}

module.exports = {
  normalizeProgrammeName,
  getProgrammeCode,
  isValidProgramme,
  getOfficialProgrammes,
  getSuggestions,
  OFFICIAL_PROGRAMMES
};
