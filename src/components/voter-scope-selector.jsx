"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  ROLES,
  COUNTRIES,
  getProvincesForCountry,
  getCitiesForProvince,
} from "@/lib/constants";
import { Users, Shield, Briefcase, MapPin, AlertCircle } from "lucide-react";
import { storage } from "@/lib/storage";

/** Small helper so we never crash on odd shapes */
function normalizeUsers(u) {
  if (!u) return [];
  if (typeof u === "string") {
    try {
      u = JSON.parse(u);
    } catch {
      return [];
    }
  }
  if (Array.isArray(u)) return u;
  if (Array.isArray(u?.users)) return u.users; // { users: [...] }
  if (u && typeof u === "object") return Object.values(u); // {id1:{}, id2:{}}
  return [];
}

export function VoterScopeSelector({ claimCategory, voterScope, onChange }) {
  const [estimatedVoters, setEstimatedVoters] = useState(null);

  // Ensure defaults so .length checks are safe
  const scope = {
    everyone: false,
    requireCategory: false,
    allowedRoles: [],
    allowedGeo: { cities: [], provinces: [], countries: [] },
    ...(voterScope || {}),
    allowedGeo: {
      cities: [],
      provinces: [],
      countries: [],
      ...(voterScope?.allowedGeo || {}),
    },
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await storage.getUsers(); // ✅ await the async function
      const allUsers = normalizeUsers(raw);

      if (cancelled) return;

      if (scope.everyone) {
        setEstimatedVoters(allUsers.length || 0);
        return;
      }

      const eligible = allUsers.filter((user) => {
        // Category badge gate
        if (scope.requireCategory) {
          const hasCategoryBadge =
            Array.isArray(user?.badges) &&
            user.badges.some((b) => b?.category === claimCategory);
          if (!hasCategoryBadge) return false;
        }

        // Roles gate
        if ((scope.allowedRoles?.length || 0) > 0) {
          const hasAllowedRole = scope.allowedRoles.some((role) =>
            Array.isArray(user?.roles) ? user.roles.includes(role) : false
          );
          if (!hasAllowedRole) return false;
        }

        // Geo gate
        const g = scope.allowedGeo;
        if ((g.cities?.length || 0) > 0 && !g.cities.includes(user?.city))
          return false;
        if (
          (g.provinces?.length || 0) > 0 &&
          !g.provinces.includes(user?.province)
        )
          return false;
        if (
          (g.countries?.length || 0) > 0 &&
          !g.countries.includes(user?.country)
        )
          return false;

        return true;
      });

      if (!cancelled) setEstimatedVoters(eligible.length);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope.everyone, scope.requireCategory, scope.allowedRoles, scope.allowedGeo, claimCategory]);

  const handleScopeChange = (value) => {
    onChange({
      ...scope,
      everyone: value === "everyone",
    });
  };

  const handleRoleToggle = (role) => {
    const current = scope.allowedRoles || [];
    const newRoles = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    onChange({
      ...scope,
      allowedRoles: newRoles,
    });
  };

  const handleCategoryRequirementChange = (checked) => {
    onChange({
      ...scope,
      requireCategory: !!checked,
    });
  };

  const handleGeoChange = (type, value) => {
    onChange({
      ...scope,
      allowedGeo: {
        ...scope.allowedGeo,
        [type]: value,
      },
    });
  };

  return (
    <Card className="border-2 border-blue-200 ">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 dark:text-white">
          <Users className="h-5 w-5 text-blue-600" />
          Voter Scope & Eligibility
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label className="text-base font-semibold">Who can vote?</Label>
          <RadioGroup
            value={scope.everyone ? "everyone" : "custom"}
            onValueChange={handleScopeChange}
          >
            <div className="flex items-center space-x-2 p-3 rounded-lg border">
              <RadioGroupItem value="everyone" id="everyone" />
              <Label htmlFor="everyone" className="flex-1 cursor-pointer">
                <div className="font-medium">Everyone</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Any verified user can vote (no restrictions)
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-2 p-3 rounded-lg border">
              <RadioGroupItem value="custom" id="custom" />
              <Label htmlFor="custom" className="flex-1 cursor-pointer">
                <div className="font-medium">Custom (Intersection Logic)</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Voters must satisfy ALL selected filters below
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {!scope.everyone && (
          <div className="space-y-4 pl-4 border-l-2 border-blue-200">
            {/* Category Requirement */}
            <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg dark:bg-[#252526]">
              <Checkbox
                id="requireCategory"
                checked={!!scope.requireCategory}
                onCheckedChange={handleCategoryRequirementChange}
              />
              <div className="flex-1 ">
                <Label
                  htmlFor="requireCategory"
                  className="cursor-pointer font-medium flex items-center gap-2"
                >
                  <Shield className="h-4 w-4 text-blue-600" />
                  Require {claimCategory} Category Badge
                </Label>
                <p className="text-xs text-gray-600 mt-1 dark:text-gray-400">
                  Only users with a {claimCategory} badge can vote
                </p>
              </div>
            </div>

            {/* Role Gating */}
            <div className="space-y-2">
              <Label className="font-medium flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-blue-600" />
                Allowed Roles (Optional)
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ROLES.map((role) => (
                  <div
                    key={role}
                    className="flex items-center space-x-2 p-2 rounded border hover:bg-gray-50 dark:hover:bg-gray-50/10"
                  >
                    <Checkbox
                      id={`role-filter-${role}`}
                      checked={(scope.allowedRoles || []).includes(role)}
                      onCheckedChange={() => handleRoleToggle(role)}
                    />
                    <Label
                      htmlFor={`role-filter-${role}`}
                      className="flex-1 cursor-pointer text-sm"
                    >
                      {role}
                    </Label>
                  </div>
                ))}
              </div>
              {(scope.allowedRoles || []).length > 0 && (
                <p className="text-xs text-gray-600">
                  Voters must have at least one of the selected roles
                </p>
              )}
            </div>

            {/* Geo Gating */}
            <div className="space-y-3">
              <Label className="font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-600" />
                Geographic Restrictions (Optional)
              </Label>

              <div className="space-y-2">
                <Label htmlFor="geoCountries" className="text-sm">
                  Countries
                </Label>
                <Select
                  value={scope.allowedGeo.countries[0] || "_any"}
                  onValueChange={(value) =>
                    handleGeoChange("countries", value === "_any" ? [] : [value])
                  }
                >
                  <SelectTrigger id="geoCountries">
                    <SelectValue placeholder="Any country (no restriction)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_any">Any country</SelectItem>
                    {COUNTRIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {scope.allowedGeo.countries.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="geoProvinces" className="text-sm">
                    Province/State
                  </Label>
                  <Select
                    value={scope.allowedGeo.provinces[0] || "_any"}
                    onValueChange={(value) =>
                      handleGeoChange("provinces", value === "_any" ? [] : [value])
                    }
                  >
                    <SelectTrigger id="geoProvinces">
                      <SelectValue placeholder="Any province/state (no restriction)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_any">Any province/state</SelectItem>
                      {getProvincesForCountry(
                        scope.allowedGeo.countries[0]
                      ).map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {scope.allowedGeo.provinces.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="geoCities" className="text-sm">
                    City
                  </Label>
                  <Select
                    value={scope.allowedGeo.cities[0] || "_any"}
                    onValueChange={(value) =>
                      handleGeoChange("cities", value === "_any" ? [] : [value])
                    }
                  >
                    <SelectTrigger id="geoCities">
                      <SelectValue placeholder="Any city (no restriction)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_any">Any city</SelectItem>
                      {getCitiesForProvince(
                        scope.allowedGeo.countries[0],
                        scope.allowedGeo.provinces[0]
                      ).map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(scope.allowedGeo.cities.length > 0 ||
                scope.allowedGeo.provinces.length > 0 ||
                scope.allowedGeo.countries.length > 0) && (
                <p className="text-xs text-gray-600">
                  Voters must be from the selected geographic area
                </p>
              )}
            </div>

            {/* Examples */}
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm space-y-2">
                    <p className="font-semibold dark:text-white">Examples:</p>
                    <ul className="space-y-1 text-gray-700 dark:text-gray-400">
                      <li>
                        • <strong>Politics—Cebu gov't:</strong> Geo=Cebu City
                        (required). A user in Pampanga is ineligible.
                      </li>
                      <li>
                        • <strong>Medical issue:</strong> Role=Nurse/Physician +
                        Category=Health. Non-medical users filtered out.
                      </li>
                      <li>
                        • <strong>Tech launch (open):</strong> Everyone → no
                        filters.
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Estimated Voters */}
        {estimatedVoters !== null && (
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-semibold text-green-900">
                  Estimated Eligible Voters: {estimatedVoters}
                </p>
                <p className="text-sm text-green-700">
                  Based on current registered users
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
