// routes/auth.js
const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { verifyWalletSignature } = require("../utils/auth");

// ---------- POST /api/auth/login ----------
router.post("/login", async (req, res) => {
  try {
    const { walletAddress, signature, message } = req.body || {};
    if (!walletAddress || !signature || !message) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const isValid = verifyWalletSignature(walletAddress, message, signature);
    if (!isValid) return res.status(401).json({ error: "Invalid signature" });

    const wa = String(walletAddress).toLowerCase().trim();

    let user = await User.findOneAndUpdate(
      { walletAddress: wa },
      { $set: { lastActive: new Date() } },
      { new: true }
    );

    if (!user) {
      user = await User.create({
        walletAddress: wa,
        roles: ["General Public"],
        badges: [],
        roleBadges: [],
        categories: [],
        overallTruthScore: 0,
        totalStaked: 0,
        totalEarned: 0,
        registeredAt: new Date(),
      });
    }

    return res.json(user);
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      error: error?.message || "Server error during authentication",
      details: error?.errors,
    });
  }
});

// ---------- POST /api/auth/register ----------
// ---------- POST /api/auth/register ----------
router.post("/register", async (req, res) => {
  try {
    const {
      address,
      walletAddress,
      displayName,
      roles,
      city,
      province,
      country,
      categories,
      badges,
      roleBadges,
      roleVerificationSummary,
      residencyAttestationRef,
      overallTruthScore,
      totalStaked,
      totalEarned,
      status,
      registeredAt,
    } = req.body || {};

const wa = String(walletAddress || address || "").toLowerCase().trim();
    if (!wa) {
      return res.status(400).json({ error: "Wallet address is required" });
    }

// Normalize roles
    const normalizedRoles =
      typeof roles === "string"
        ? [roles]
        : Array.isArray(roles) && roles.length > 0
        ? roles
        : ["General Public"];

// ✅ Properly handle roleVerificationSummary with nested idImage
    let safeRoleVerificationSummary = {};
    if (roleVerificationSummary && typeof roleVerificationSummary === "object") {
      safeRoleVerificationSummary = {
        method: roleVerificationSummary.method,
        idLast4: roleVerificationSummary.idLast4,
        linkedinUrl: roleVerificationSummary.linkedinUrl,
      };
      
// Handle idImage if present
      if (roleVerificationSummary.idImage && typeof roleVerificationSummary.idImage === "object") {
        safeRoleVerificationSummary.idImage = {
          name: roleVerificationSummary.idImage.name,
          type: roleVerificationSummary.idImage.type,
          size: roleVerificationSummary.idImage.size,
          base64: roleVerificationSummary.idImage.base64,  // ✅ Now matches your frontend payload
        };
      }
    }

// ✅ Categories normalization
    const sanitizedCategories = Array.isArray(categories)
      ? categories.map((c) =>
          typeof c === "string"
            ? { category: c, tier: "silver", status: "pending" }
            : {
                category: c.category,
                tier: c.tier || "silver",
                status: c.status || "pending",
              }
        )
      : [];

const userData = {
      walletAddress: wa,
      displayName: displayName?. trim(),
      city,
      province,
      country,
      roles: normalizedRoles,
      categories: sanitizedCategories,
      badges: Array.isArray(badges) ? badges : [],
      roleBadges: Array.isArray(roleBadges) ? roleBadges : [],
      roleVerificationSummary: safeRoleVerificationSummary,
      residencyAttestationRef: residencyAttestationRef || "",
      overallTruthScore: overallTruthScore ?? 0,
      totalStaked: totalStaked ?? 0,
      totalEarned: totalEarned ?? 0,
      status: status || "pending",
      registeredAt: registeredAt ? new Date(registeredAt) : new Date(),
      lastActive: new Date(),
    };

const user = await User.findOneAndUpdate(
      { walletAddress: wa },
      { $set: userData },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
        context: "query",
      }
    );

return res.status(201).json(user);
  } catch (error) {
    console.error("Registration error:", error);
    if (error?. code === 11000) {
      const existingUser = await User.findOne({
        walletAddress: String(req.body.walletAddress || req.body.address).toLowerCase(),
      });
      return res.status(200).json(existingUser);
    }

return res.status(500).json({
      error: error?. message || "Server error during registration",
      details: error?. errors,
    });
  }
});

module.exports = router;
