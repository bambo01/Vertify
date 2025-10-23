// /lib/eligibility.js (frontend, ESM)
// Uses viem so we don't depend on ethers in the FE

import { encodeAbiParameters, keccak256 } from "viem";

// ——— helpers ———
function uniqSort(arr) {
  return Array.from(new Set(arr)).sort();
}
function normList(xs) {
  return uniqSort((xs ?? [])
    .map((s) => (s ?? "").trim().toLowerCase())
    .filter(Boolean));
}

// ————————————————————————————————————————————————
// Cryptographic, versioned commitment to voterScope
// (roles ignored by policy, hashed as empty array)
// ————————————————————————————————————————————————
export function generateEligibilitySnapshotHash(input = {}) {
  const raw = input?.voterScope ?? {};
  const scope = {
    everyone: !!raw.everyone,
    requireCategory: !!raw.requireCategory,
    // roles intentionally ignored; keep empty to avoid drift
    allowedRoles: [],
    allowedGeo: {
      cities:    normList(raw.allowedGeo?.cities),
      provinces: normList(raw.allowedGeo?.provinces),
      countries: normList(raw.allowedGeo?.countries),
    },
  };

  // viem ABI encode then keccak256
  const encoded = encodeAbiParameters(
    [
      { type: "string" },   // version tag
      { type: "bool"   },
      { type: "bool"   },
      { type: "string[]" }, // roles (empty)
      { type: "string[]" }, // cities
      { type: "string[]" }, // provinces
      { type: "string[]" }, // countries
    ],
    [
      "eligibility:v1",
      scope.everyone,
      scope.requireCategory,
      scope.allowedRoles,
      scope.allowedGeo.cities,
      scope.allowedGeo.provinces,
      scope.allowedGeo.countries,
    ]
  );

  return keccak256(encoded); // 0x + 64 hex
}

// ————————————————————————————————————————————————
// v2.3 — Badge + Geo only (roles ignored), normalized checks
// ————————————————————————————————————————————————
export function checkVoterEligibility(userProfile = {}, claim = {}) {
  const scope = claim?.voterScope;

  // Old claims: only category badge required
  if (!scope) {
    const ok =
      Array.isArray(userProfile?.badges) &&
      userProfile.badges.some((b) => b?.category === claim?.category);
    return { eligible: !!ok, reasons: [] };
  }

  // Everyone can vote
  if (scope.everyone) return { eligible: true, reasons: [] };

  const failed = [];

  // Category badge gate
  if (scope.requireCategory) {
    const hasCategory =
      Array.isArray(userProfile?.badges) &&
      userProfile.badges.some((b) => b?.category === claim?.category);
    if (!hasCategory) failed.push(`Requires ${claim?.category} badge`);
  }

  // Normalize user geo
  const uCity    = (userProfile?.city ?? "").trim().toLowerCase();
  const uProv    = (userProfile?.province ?? "").trim().toLowerCase();
  const uCountry = (userProfile?.country ?? "").trim().toLowerCase();

  const cities    = normList(scope.allowedGeo?.cities);
  const provinces = normList(scope.allowedGeo?.provinces);
  const countries = normList(scope.allowedGeo?.countries);

  // Apply each non-empty list as a gate (intersection)
  if (countries.length && !countries.includes(uCountry)) {
    failed.push(`Country must be one of: ${countries.join(", ")}`);
  }
  if (provinces.length && !provinces.includes(uProv)) {
    failed.push(`Province must be one of: ${provinces.join(", ")}`);
  }
  if (cities.length && !cities.includes(uCity)) {
    failed.push(`City must be one of: ${cities.join(", ")}`);
  }

  return { eligible: failed.length === 0, reasons: failed };
}

// ————————————————————————————————————————————————
// Counts eligible users (client-only; avoids SSR)
// ————————————————————————————————————————————————
export async function getEligibleVotersCount(claim) {
  if (typeof window === "undefined") return 0;

  // Late import to avoid SSR issues; adjust path if needed
  const { storage } = await import("./storage");
  const raw = await storage.getUsers();

  // Normalize to array
  const allUsers = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.users)
    ? raw.users
    : raw && typeof raw === "object"
    ? Object.values(raw)
    : [];

  const scope = claim?.voterScope;
  if (!scope || scope.everyone) return allUsers.length;

  return allUsers.filter((u) => checkVoterEligibility(u, claim).eligible).length;
}
