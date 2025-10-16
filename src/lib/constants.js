// Badge tiers and categories
export const BADGE_TIERS = {
  Silver: {
    tier: 'Silver',
    truthScoreMin: 0,
    minimumVotes: 0,
    maxStakePerVote: 0.002,
    dailyStakeCap: 0.010,
    weightMultiplier: 1.0,
  },
  Gold: {
    tier: 'Gold',
    truthScoreMin: 0.75,
    minimumVotes: 20,
    maxStakePerVote: 0.005,
    dailyStakeCap: 0.025,
    weightMultiplier: 1.3,
  },
  Expert: {
    tier: 'Expert',
    truthScoreMin: 0.85,
    minimumVotes: 100,
    maxStakePerVote: 0.010,
    dailyStakeCap: 0.050,
    weightMultiplier: 1.6,
  },
};

export const CATEGORIES = ['Tech', 'Health', 'Politics', 'Finance', 'Science'];

// Alias for backward compatibility
export const BADGE_REQUIREMENTS = BADGE_TIERS;

// v2.1: Roles for role-gated voting
export const ROLES = [
  'Tech Professional',
  'Nurse/Physician',
  'Journalist',
  'Researcher',
  'Educator',
  'Student',
  'Legal Professional',
  'Finance Professional',
];

// v2.1: Countries (sample list - can be expanded)
export const COUNTRIES = [
  { code: 'PH', name: 'Philippines' },
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'IN', name: 'India' },
  { code: 'SG', name: 'Singapore' },
  { code: 'JP', name: 'Japan' },
];

// v2.1: Philippines provinces/states
export const PHILIPPINES_PROVINCES = [
  'Metro Manila',
  'Cebu',
  'Davao',
  'Pampanga',
  'Rizal',
  'Cavite',
  'Bulacan',
  'Laguna',
  'Batangas',
  'Iloilo',
  'Negros Occidental',
  'Negros Oriental',
  'Leyte',
  'Samar',
  'Pangasinan',
];

// v2.1: US states
export const US_STATES = [
  'California',
  'Texas',
  'Florida',
  'New York',
  'Pennsylvania',
  'Illinois',
  'Ohio',
  'Georgia',
  'North Carolina',
  'Michigan',
];

// v2.1: Sample cities by country/province
export const CITIES = {
  'PH-Metro Manila': ['Manila', 'Quezon City', 'Makati', 'Pasig', 'Taguig'],
  'PH-Cebu': ['Cebu City', 'Mandaue', 'Lapu-Lapu', 'Toledo'],
  'PH-Davao': ['Davao City', 'Tagum', 'Panabo', 'Digos'],
  'PH-Pampanga': ['San Fernando', 'Angeles City', 'Mabalacat'],
  'US-California': ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose'],
  'US-Texas': ['Houston', 'Dallas', 'Austin', 'San Antonio'],
  'US-New York': ['New York City', 'Buffalo', 'Rochester', 'Albany'],
};

// Helper to get provinces/states for a country
export function getProvincesForCountry(countryCode) {
  if (countryCode === 'PH') return PHILIPPINES_PROVINCES;
  if (countryCode === 'US') return US_STATES;
  return [];
}

// Helper to get cities for a province/state
export function getCitiesForProvince(countryCode, province) {
  const key = `${countryCode}-${province}`;
  return CITIES[key] || [];
}
