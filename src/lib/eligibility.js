// v2.2: Voter eligibility checks (badge + geo only; roles are IGNORED)

// Per-user check
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

  // Category badge requirement (the only non-geo gate)
  if (scope.requireCategory) {
    const hasCategory =
      Array.isArray(userProfile?.badges) &&
      userProfile.badges.some((b) => b?.category === claim?.category);
    if (!hasCategory) failed.push(`Missing ${claim?.category} category badge`);
  }

  // ⛔ Roles are intentionally IGNORED for eligibility
  // If the UI supplies allowedRoles, they'll be treated as informational only.

  // Geo (intersection)
  const { cities = [], provinces = [], countries = [] } = scope.allowedGeo ?? {};
  if (countries.length > 0 && !countries.includes(userProfile?.country)) {
    failed.push(`Must be from ${countries.join(" or ")}`);
  }
  if (provinces.length > 0 && !provinces.includes(userProfile?.province)) {
    failed.push(
      `Must be from ${provinces.join(" or ")} province (you are from ${userProfile?.province ?? "N/A"})`
    );
  }
  if (cities.length > 0 && !cities.includes(userProfile?.city)) {
    failed.push(
      `Must be from ${cities.join(" or ")} (you are from ${userProfile?.city ?? "N/A"})`
    );
  }

  return { eligible: failed.length === 0, reasons: failed };
}

// Async – must be awaited by callers
export async function getEligibleVotersCount(claim) {
  if (typeof window === "undefined") return 0;

  // Late import to avoid SSR issues
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

export function generateEligibilitySnapshotHash(claim) {
  const data = JSON.stringify(claim?.voterScope ?? {});
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) - hash + data.charCodeAt(i);
    hash |= 0;
  }
  return `0x${Math.abs(hash).toString(16).padStart(64, "0")}`;
}
