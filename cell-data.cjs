'use strict';

// === CARRIER + MCC/FLAG DATA FOR CELL PROXY ===
//
// Paste your existing objects from cell-proxy.cjs into the spots below:
//
//   1. const US_CARRIERS = { ... };
//   2. const INTL_CARRIERS = { ... };
//   3. const MCC_COUNTRIES = { ... };
//   4. const COUNTRY_FLAGS = { ... };
//
// Then remove them from cell-proxy.cjs (the next step overwrites that file).

// 1) US carriers
const US_CARRIERS = {
  // TODO: paste your existing US_CARRIERS object here
};

// 2) International carriers
const INTL_CARRIERS = {
  // TODO: paste your existing INTL_CARRIERS object here
};

// 3) MCC → country code (e.g. "310": "US")
const MCC_COUNTRIES = {
  // TODO: paste your existing MCC_COUNTRIES object here
};

// 4) Country code → flag emoji (e.g. "US": "🇺🇸")
const COUNTRY_FLAGS = {
  // TODO: paste your existing COUNTRY_FLAGS object here
};

// Derived mapping
const ALL_CARRIERS = { 
  ...US_CARRIERS, 
  ...INTL_CARRIERS 
};

module.exports = {
  US_CARRIERS,
  INTL_CARRIERS,
  MCC_COUNTRIES,
  COUNTRY_FLAGS,
  ALL_CARRIERS
};
