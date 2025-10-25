"use client";

import { useState, useEffect, useMemo } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { WalletRequired } from "@/components/wallet-connect";
import { CategorySelector } from "@/components/category-selector";
import { RoleSelector } from "@/components/role-selector";
import { GeoSelector } from "@/components/geo-selector";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { storage } from "@/lib/storage";
import {
  CheckCircle,
  User,
  Shield,
  Briefcase,
  MapPin,
  ExternalLink,
  IdCard,
} from "lucide-react";
import { toast } from "sonner";

const STUDENT_ROLE = "Student";
const PRC_OR_LINKEDIN_ROLES = [
  "Educator",
  "Legal Professional",
  "Nurse/Physician",
  "Finance Professional",
];

export default function RegisterPage() {
  const { address } = useAccount();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [geo, setGeo] = useState({ country: "", province: "", city: "" });
  const [step, setStep] = useState(1);
  const [isClient, setIsClient] = useState(false);

  // Step 3 – dynamic verification states
  // Student block
  const [studentLast4, setStudentLast4] = useState("");
  const [studentImageFile, setStudentImageFile] = useState(null);
  const [studentImagePreview, setStudentImagePreview] = useState("");
  const [studentImageError, setStudentImageError] = useState("");

  // Main/Other block (for roles that are not Student)
  const [methodMain, setMethodMain] = useState("linkedin"); // 'linkedin' | 'prc'
  const [linkedinUrlMain, setLinkedinUrlMain] = useState("");
  const [prcLast4Main, setPrcLast4Main] = useState("");
  const [prcImageFileMain, setPrcImageFileMain] = useState(null);
  const [prcImagePreviewMain, setPrcImagePreviewMain] = useState("");
  const [prcImageErrorMain, setPrcImageErrorMain] = useState("");

  useEffect(() => {
    setIsClient(true);
    const checkProfile = async () => {
      if (address) {
        const profile = await storage.getUserProfile(address);
        if (profile) router.push("/dashboard");
      }
    };
    checkProfile();
  }, [address, router]);

  // Helpers
  const isValidLinkedIn = (url) =>
    /^https?:\/\/(www\.)?linkedin\.com\/(in|company)\/[A-Za-z0-9\-_%]+\/?$/i.test(
      url.trim()
    );

  const onPickImage = (e, setFile, setPreview, setError) => {
    const file = e.target.files?.[0] || null;
    if (!file) {
      setFile(null);
      setPreview("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file (PNG/JPG).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Max file size is 5MB.");
      return;
    }
    setError("");
    setFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const readAsDataURL = (file) =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });

  // Determine verification mode from roles
  const { hasStudent, hasPRCOrLinkedIn, hasOther, mode, otherBlockMode } =
    useMemo(() => {
      const hasStudent = selectedRoles.includes(STUDENT_ROLE);
      const hasPRCOrLinkedIn = selectedRoles.some((r) =>
        PRC_OR_LINKEDIN_ROLES.includes(r)
      );
      const hasOther = selectedRoles.some(
        (r) => r !== STUDENT_ROLE && !PRC_OR_LINKEDIN_ROLES.includes(r)
      );

      // Mode guide:
      // - 'student_only'             : only Student selected → Student ID required
      // - 'student_plus'             : Student plus other roles
      //   - otherBlockMode:
      //       - 'linkedin_only'      : if any "other" roles present
      //       - 'prc_or_linkedin'    : if only PRC-or-LI roles present (no "other")
      // - 'prc_or_linkedin'          : PRC-or-LI roles only (no Student, no "other")
      // - 'linkedin_only'            : only "other" roles OR mix of PRC-or-LI + other (no Student)
      let mode = "linkedin_only";
      let otherBlockMode = null;

      if (hasStudent) {
        if (!hasPRCOrLinkedIn && !hasOther) {
          mode = "student_only";
        } else {
          mode = "student_plus";
          otherBlockMode = hasOther ? "linkedin_only" : "prc_or_linkedin";
        }
      } else {
        if (hasPRCOrLinkedIn && !hasOther) mode = "prc_or_linkedin";
        else mode = "linkedin_only";
      }

      return { hasStudent, hasPRCOrLinkedIn, hasOther, mode, otherBlockMode };
    }, [selectedRoles]);

  const handleNext = () => {
    if (step === 1) {
      if (!displayName.trim())
        return toast.error("Please enter a display name");
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!geo.country || !geo.province || !geo.city) {
        return toast.error(
          "Please select your location (country, province, and city)"
        );
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      if (selectedRoles.length === 0)
        return toast.error("Please select at least one role");

      // Validate by mode
      if (mode === "student_only") {
        if (studentLast4.replace(/\D/g, "").length < 4) {
          return toast.error("Enter the last 4 digits of your Student ID");
        }
        if (!studentImageFile) {
          return toast.error("Please upload a clear image of your Student ID");
        }
      }

      if (mode === "student_plus") {
        // Student part required
        if (studentLast4.replace(/\D/g, "").length < 4) {
          return toast.error("Enter the last 4 digits of your Student ID");
        }
        if (!studentImageFile) {
          return toast.error("Please upload a clear image of your Student ID");
        }
        // Other block required
        if (otherBlockMode === "linkedin_only") {
          if (!isValidLinkedIn(linkedinUrlMain)) {
            return toast.error("Enter a valid LinkedIn profile URL");
          }
        } else if (otherBlockMode === "prc_or_linkedin") {
          if (methodMain === "linkedin") {
            if (!isValidLinkedIn(linkedinUrlMain)) {
              return toast.error("Enter a valid LinkedIn profile URL");
            }
          } else {
            if (prcLast4Main.replace(/\D/g, "").length < 4) {
              return toast.error("Enter the last 4 digits of your PRC ID");
            }
            if (!prcImageFileMain) {
              return toast.error("Please upload a clear image of your PRC ID");
            }
          }
        }
      }

      if (mode === "prc_or_linkedin") {
        if (methodMain === "linkedin") {
          if (!isValidLinkedIn(linkedinUrlMain)) {
            return toast.error("Enter a valid LinkedIn profile URL");
          }
        } else {
          if (prcLast4Main.replace(/\D/g, "").length < 4) {
            return toast.error("Enter the last 4 digits of your PRC ID");
          }
          if (!prcImageFileMain) {
            return toast.error("Please upload a clear image of your PRC ID");
          }
        }
      }

      if (mode === "linkedin_only") {
        if (!isValidLinkedIn(linkedinUrlMain)) {
          return toast.error("Enter a valid LinkedIn profile URL");
        }
      }

      setStep(4);
      return;
    }

    if (step === 4) handleRegister();
  };

  const handleRegister = async () => {
    if (!address) return;
    if (selectedCategories.length === 0)
      return toast.error("Please select at least one category");

    // No category badges at signup; created after admin approval + user claim
    const initialBadges = [];

    // Prepare images as data URLs (local/offline)
    let studentImageDataUrl = null;
    let prcImageDataUrl = null;

    try {
      if (studentImageFile)
        studentImageDataUrl = await readAsDataURL(studentImageFile);
      if (prcImageFileMain)
        prcImageDataUrl = await readAsDataURL(prcImageFileMain);
    } catch {
      return toast.error("Failed to read image(s). Please try again.");
    }

    // Build roleBadges with per-role verification + issuance state
    const roleBadges = selectedRoles.map((role) => {
      const badgeState = { status: "not_eligible" };

      if (role === STUDENT_ROLE) {
        return {
          role,
          tier: "silver",
          verified: false,
          issuerRef: "self-attested",
          createdAt: Date.now(),
          badge: badgeState,
          verification: {
            method: "student_id",
            idType: "Student ID",
            idLast4: studentLast4.replace(/\D/g, "").slice(-4),
            submittedAt: Date.now(),
            status: "pending",
            idImage: studentImageDataUrl
              ? {
                  name: studentImageFile?.name,
                  type: studentImageFile?.type,
                  size: studentImageFile?.size,
                  dataUrl: studentImageDataUrl,
                }
              : undefined,
          },
        };
      }

      // Non-student roles:
      if (mode === "student_plus") {
        if (otherBlockMode === "linkedin_only") {
          return {
            role,
            tier: "silver",
            verified: false,
            issuerRef: "self-attested",
            createdAt: Date.now(),
            badge: badgeState,
            verification: {
              method: "linkedin",
              submittedAt: Date.now(),
              status: "pending",
              linkedinUrl: linkedinUrlMain.trim(),
            },
          };
        } else {
          if (methodMain === "linkedin") {
            return {
              role,
              tier: "silver",
              verified: false,
              issuerRef: "self-attested",
              createdAt: Date.now(),
              badge: badgeState,
              verification: {
                method: "linkedin",
                submittedAt: Date.now(),
                status: "pending",
                linkedinUrl: linkedinUrlMain.trim(),
              },
            };
          }
          // methodMain === 'prc'
          return {
            role,
            tier: "silver",
            verified: false,
            issuerRef: "self-attested",
            createdAt: Date.now(),
            badge: badgeState,
            verification: {
              method: "prc_id",
              idType: "PRC ID",
              idLast4: prcLast4Main.replace(/\D/g, "").slice(-4),
              submittedAt: Date.now(),
              status: "pending",
              idImage: prcImageDataUrl
                ? {
                    name: prcImageFileMain?.name,
                    type: prcImageFileMain?.type,
                    size: prcImageFileMain?.size,
                    dataUrl: prcImageDataUrl,
                  }
                : undefined,
            },
          };
        }
      }

      if (mode === "prc_or_linkedin") {
        if (methodMain === "linkedin") {
          return {
            role,
            tier: "silver",
            verified: false,
            issuerRef: "self-attested",
            createdAt: Date.now(),
            badge: badgeState,
            verification: {
              method: "linkedin",
              submittedAt: Date.now(),
              status: "pending",
              linkedinUrl: linkedinUrlMain.trim(),
            },
          };
        }
        return {
          role,
          tier: "silver",
          verified: false,
          issuerRef: "self-attested",
          createdAt: Date.now(),
          badge: badgeState,
          verification: {
            method: "prc_id",
            idType: "PRC ID",
            idLast4: prcLast4Main.replace(/\D/g, "").slice(-4),
            submittedAt: Date.now(),
            status: "pending",
            idImage: prcImageDataUrl
              ? {
                  name: prcImageFileMain?.name,
                  type: prcImageFileMain?.type,
                  size: prcImageFileMain?.size,
                  dataUrl: prcImageDataUrl,
                }
              : undefined,
          },
        };
      }

      // linkedin_only
      return {
        role,
        tier: "silver",
        verified: false,
        issuerRef: "self-attested",
        createdAt: Date.now(),
        badge: badgeState,
        verification: {
          method: "linkedin",
          submittedAt: Date.now(),
          status: "pending",
          linkedinUrl: linkedinUrlMain.trim(),
        },
      };
    });

    // Summary for admin UI
    const roleVerificationSummary = (() => {
      const studentIdImage =
        studentImageDataUrl && studentImageFile
          ? {
              name: studentImageFile.name,
              type: studentImageFile.type,
              size: studentImageFile.size,
              dataUrl: studentImageDataUrl,
            }
          : undefined;

      const prcIdImage =
        prcImageDataUrl && prcImageFileMain
          ? {
              name: prcImageFileMain.name,
              type: prcImageFileMain.type,
              size: prcImageFileMain.size,
              dataUrl: prcImageDataUrl,
            }
          : undefined;

      if (mode === "student_only") {
        return {
          student: {
            method: "student_id",
            idLast4: studentLast4.replace(/\D/g, "").slice(-4),
            idImage: studentIdImage,
          },
        };
      }

      if (mode === "student_plus") {
        return {
          student: {
            method: "student_id",
            idLast4: studentLast4.replace(/\D/g, "").slice(-4),
            idImage: studentIdImage,
          },
          others:
            otherBlockMode === "linkedin_only"
              ? { method: "linkedin", linkedinUrl: linkedinUrlMain.trim() }
              : methodMain === "linkedin"
              ? { method: "linkedin", linkedinUrl: linkedinUrlMain.trim() }
              : {
                  method: "prc_id",
                  idLast4: prcLast4Main.replace(/\D/g, "").slice(-4),
                  idImage: prcIdImage,
                },
        };
      }

      if (mode === "prc_or_linkedin") {
        return methodMain === "linkedin"
          ? { method: "linkedin", linkedinUrl: linkedinUrlMain.trim() }
          : {
              method: "prc_id",
              idLast4: prcLast4Main.replace(/\D/g, "").slice(-4),
              idImage: prcIdImage,
            };
      }

      // linkedin_only
      return { method: "linkedin", linkedinUrl: linkedinUrlMain.trim() };
    })();

    const profile = {
      address,
      displayName: displayName.trim(),
      registeredAt: Date.now(),

      status: "pending", // global profile state

      // Location
      city: geo.city,
      province: geo.province,
      country: geo.country,

      // Roles + role-level verifications
      roles: selectedRoles,
      roleBadges,

      // Summary (for admin view)
      roleVerificationSummary,

      // Misc
      residencyAttestationRef: `mock-attestation-${Date.now()}`,

      // Categories only; badges are empty until approval+claim
      categories: selectedCategories,
      badges: initialBadges,

      // Stats (initial)
      overallTruthScore: 0,
      totalStaked: 0,
      totalEarned: 0,
    };

    try {
      await storage.saveUserProfile(profile);
      toast.success("Registration submitted. Your account is pending review.");
      router.push("/dashboard");
    } catch (error) {
      console.error("Registration error:", error);
      toast.error("Failed to register. Please try again.");
    }
  };

  if (!isClient) {
    return (
      <div className="container mx-auto px-4 py-8 sm:py-12 ">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  // Compute Step 3 disabled state
  const step3Disabled = (() => {
    if (selectedRoles.length === 0) return true;

    if (mode === "student_only") {
      return (
        studentLast4.replace(/\D/g, "").length < 4 ||
        !studentImageFile ||
        !!studentImageError
      );
    }

    if (mode === "student_plus") {
      const studentInvalid =
        studentLast4.replace(/\D/g, "").length < 4 ||
        !studentImageFile ||
        !!studentImageError;

      if (otherBlockMode === "linkedin_only") {
        const otherInvalid = !isValidLinkedIn(linkedinUrlMain);
        return studentInvalid || otherInvalid;
      }
      const otherInvalid =
        (methodMain === "linkedin" && !isValidLinkedIn(linkedinUrlMain)) ||
        (methodMain === "prc" &&
          (prcLast4Main.replace(/\D/g, "").length < 4 ||
            !prcImageFileMain ||
            !!prcImageErrorMain));
      return studentInvalid || otherInvalid;
    }

    if (mode === "prc_or_linkedin") {
      if (methodMain === "linkedin") return !isValidLinkedIn(linkedinUrlMain);
      return (
        prcLast4Main.replace(/\D/g, "").length < 4 ||
        !prcImageFileMain ||
        !!prcImageErrorMain
      );
    }

    // linkedin_only
    return !isValidLinkedIn(linkedinUrlMain);
  })();

  return (
    <WalletRequired>
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-4xl ">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Join Vertify</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-200">
            Become a fact-checker and earn rewards for accuracy
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-6 sm:mb-8 overflow-x-auto pb-2">
          <div className="flex justify-center items-center gap-2 sm:gap-4 min-w-max">
            <div
              className={`flex items-center gap-2 ${step >= 1 ? "text-[#44ADFF]" : "text-gray-400"}`}
            >
              <div
                className={`rounded-full p-1.5 sm:p-2 ${step >= 1 ? "bg-[#44ADFF] text-white" : "dark:bg-gray-800 border border-gray-400"}`}
              >
                {step > 1 ? (
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <User className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </div>
              <span className="font-medium text-sm sm:text-base whitespace-nowrap">
                Profile
              </span>
            </div>
            <div className="h-px w-8 sm:w-16 bg-gray-300" />
            <div
              className={`flex items-center gap-2 ${step >= 2 ? "text-[#44ADFF]" : "text-gray-400"}`}
            >
              <div
                className={`rounded-full p-1.5 sm:p-2 ${step >= 2 ? "bg-[#44ADFF] text-white" : "dark:bg-gray-800 border border-gray-400"}`}
              >
                {step > 2 ? (
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </div>
              <span className="font-medium text-sm sm:text-base whitespace-nowrap">
                Location
              </span>
            </div>
            <div className="h-px w-8 sm:w-16 bg-gray-300" />
            <div
              className={`flex items-center gap-2 ${step >= 3 ? "text-[#44ADFF]" : "text-gray-400"}`}
            >
              <div
                className={`rounded-full p-1.5 sm:p-2 ${step >= 3 ? "bg-[#44ADFF] text-white" : "dark:bg-gray-800 border border-gray-400"}`}
              >
                {step > 3 ? (
                  <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <Briefcase className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </div>
              <span className="font-medium text-sm sm:text-base whitespace-nowrap">
                Roles
              </span>
            </div>
            <div className="h-px w-8 sm:w-16 bg-gray-300" />
            <div
              className={`flex items-center gap-2 ${step >= 4 ? "text-[#44ADFF]" : "text-gray-400"}`}
            >
              <div
                className={`rounded-full p-1.5 sm:p-2 ${step >= 4 ? "bg-[#44ADFF] text-white" : "dark:bg-gray-800 border border-gray-400"}`}
              >
                <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="font-medium text-sm sm:text-base whitespace-nowrap">
                Categories
              </span>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl dark:text-white ">
              {step === 1 && "Create Your Profile"}
              {step === 2 && "Your Location"}
              {step === 3 && "Your Professional Roles"}
              {step === 4 && "Select Your Expertise"}
            </CardTitle>
            <CardDescription className="text-sm dark:text-gray-400">
              {step === 1 &&
                "Choose a display name for your fact-checker identity"}
              {step === 2 &&
                "Privacy: Only city-level location is stored for geo-gated claims"}
              {step === 3 &&
                (mode === "student_only"
                  ? "Student role selected — Student ID verification is required"
                  : mode === "student_plus"
                  ? otherBlockMode === "linkedin_only"
                    ? "Student ID required, plus LinkedIn for other roles"
                    : "Student ID required, plus PRC or LinkedIn for other roles"
                  : mode === "prc_or_linkedin"
                  ? "Choose PRC or LinkedIn for your selected roles"
                  : "LinkedIn verification is required for your selected roles")}
              {step === 4 &&
                "Pick categories where you can provide valuable insights"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 dark:text-white">
            {/* Step 1 */}
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    type="text"
                    placeholder="Your Name or Username"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={50}
                  />
                  <p className="text-xs text-gray-500 dark:text-white/80">
                    This name will be visible to others when you vote and submit
                    claims
                  </p>
                </div>
                <Card className="bg-blue-50 border-blue-200 dark:border-gray-600">
                  <CardContent className="pt-4">
                    <h3 className="font-semibold mb-2 text-sm sm:text-base dark:text-white">
                      How TruthChain Works:
                    </h3>
                    <ul className="text-xs sm:text-sm text-gray-700 space-y-1 dark:text-gray-400">
                      <li>• Vote on claims with small stakes</li>
                      <li>• Earn badges in categories you know well</li>
                      <li>• Build your Truth Score by being accurate</li>
                      <li>• Earn rewards from incorrect voters</li>
                      <li>• Upgrade from Silver → Gold → Expert</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <GeoSelector
                country={geo.country}
                province={geo.province}
                city={geo.city}
                onChange={setGeo}
              />
            )}

            {/* Step 3: Roles + Dynamic Verification */}
            {step === 3 && (
              <div className="space-y-4">
                <RoleSelector
                  selectedRoles={selectedRoles}
                  onChange={setSelectedRoles}
                  minRequired={1}
                />

                {/* Student block */}
                {hasStudent && (
                  <Card className="bg-purple-50 border-purple-200">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <IdCard className="h-5 w-5 text-purple-600" />
                        <h3 className="font-semibold text-sm sm:text-base dark:text-white">
                          Student ID Verification (Required)
                        </h3>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label htmlFor="studentLast4">
                            Student ID (Last 4 Digits)
                          </Label>
                          <Input
                            id="studentLast4"
                            type="text"
                            inputMode="numeric"
                            placeholder="1234"
                            maxLength={4}
                            value={studentLast4}
                            onChange={(e) =>
                              setStudentLast4(
                                e.target.value.replace(/\D/g, "").slice(0, 4)
                              )
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="studentImage">
                            Upload Student ID Image
                          </Label>
                          <Input
                            id="studentImage"
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              onPickImage(
                                e,
                                setStudentImageFile,
                                setStudentImagePreview,
                                setStudentImageError
                              )
                            }
                          />
                          {studentImageError && (
                            <p className="text-xs text-red-600">
                              {studentImageError}
                            </p>
                          )}
                        </div>
                      </div>
                      {studentImagePreview && (
                        <div className="mt-1">
                          <Label className="text-xs text-gray-600">
                            Preview
                          </Label>
                          <div className="mt-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={studentImagePreview}
                              alt="Student ID Preview"
                              className="rounded-md border w-full max-w-sm"
                            />
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-gray-600">
                        We only store the last 4 digits and the ID image for
                        verification. Reviewers may perform additional checks.
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* student_plus → LinkedIn only for other roles */}
                {mode === "student_plus" &&
                  otherBlockMode === "linkedin_only" && (
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <ExternalLink className="h-5 w-5 text-blue-600" />
                          <h3 className="font-semibold text-sm sm:text-base">
                            LinkedIn Verification (Required for other roles)
                          </h3>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="linkedinMain">
                            LinkedIn Profile URL
                          </Label>
                          <Input
                            id="linkedinMain"
                            type="url"
                            placeholder="https://www.linkedin.com/in/your-handle"
                            value={linkedinUrlMain}
                            onChange={(e) => setLinkedinUrlMain(e.target.value)}
                          />
                          <p className="text-xs text-gray-600">
                            Only the URL is stored.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                {/* student_plus → PRC or LinkedIn for other roles */}
                {mode === "student_plus" &&
                  otherBlockMode === "prc_or_linkedin" && (
                    <Card className="bg-amber-50 border-amber-200">
                      <CardContent className="pt-4 space-y-4">
                        <h3 className="font-semibold text-sm sm:text-base dark:text-white">
                          Verification for Other Roles
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant={
                              methodMain === "linkedin" ? "default" : "outline"
                            }
                            onClick={() => setMethodMain("linkedin")}
                            className="gap-2"
                          >
                            <ExternalLink className="h-4 w-4" />
                            LinkedIn
                          </Button>
                          <Button
                            type="button"
                            variant={
                              methodMain === "prc" ? "default" : "outline"
                            }
                            onClick={() => setMethodMain("prc")}
                            className="gap-2"
                          >
                            <IdCard className="h-4 w-4" />
                            PRC ID
                          </Button>
                        </div>

                        {methodMain === "linkedin" ? (
                          <div className="space-y-2">
                            <Label htmlFor="linkedinMain2">
                              LinkedIn Profile URL
                            </Label>
                            <Input
                              id="linkedinMain2"
                              type="url"
                              placeholder="https://www.linkedin.com/in/your-handle"
                              value={linkedinUrlMain}
                              onChange={(e) =>
                                setLinkedinUrlMain(e.target.value)
                              }
                            />
                            <p className="text-xs text-gray-600">
                              Only the URL is stored.
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="grid sm:grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label htmlFor="prcLast4Main">
                                  PRC ID (Last 4 Digits)
                                </Label>
                                <Input
                                  id="prcLast4Main"
                                  type="text"
                                  inputMode="numeric"
                                  placeholder="1234"
                                  maxLength={4}
                                  value={prcLast4Main}
                                  onChange={(e) =>
                                    setPrcLast4Main(
                                      e.target.value
                                        .replace(/\D/g, "")
                                        .slice(0, 4)
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="prcImageMain">
                                  Upload PRC ID Image
                                </Label>
                                <Input
                                  id="prcImageMain"
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) =>
                                    onPickImage(
                                      e,
                                      setPrcImageFileMain,
                                      setPrcImagePreviewMain,
                                      setPrcImageErrorMain
                                    )
                                  }
                                />
                                {prcImageErrorMain && (
                                  <p className="text-xs text-red-600">
                                    {prcImageErrorMain}
                                  </p>
                                )}
                              </div>
                            </div>

                            {prcImagePreviewMain && (
                              <div className="mt-1">
                                <Label className="text-xs text-gray-600">
                                  Preview
                                </Label>
                                <div className="mt-2">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={prcImagePreviewMain}
                                    alt="PRC ID Preview"
                                    className="rounded-md border w-full max-w-sm"
                                  />
                                </div>
                              </div>
                            )}
                            <p className="text-xs text-gray-600">
                              We store the last 4 digits and the ID image for
                              verification.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                {/* Only PRC-or-LinkedIn roles (no Student, no "other") */}
                {mode === "prc_or_linkedin" && (
                  <Card className="bg-amber-50 border-amber-200 dark:border-amber-200/10">
                    <CardContent className="pt-4 space-y-4">
                      <h3 className="font-semibold text-sm sm:text-base dark:text-white">
                        Choose Verification Method
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant={
                            methodMain === "linkedin" ? "default" : "outline"
                          }
                          onClick={() => setMethodMain("linkedin")}
                          className="gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          LinkedIn
                        </Button>
                        <Button
                          type="button"
                          variant={methodMain === "prc" ? "default" : "outline"}
                          onClick={() => setMethodMain("prc")}
                          className="gap-2"
                        >
                          <IdCard className="h-4 w-4" />
                          PRC ID
                        </Button>
                      </div>

                      {methodMain === "linkedin" ? (
                        <div className="space-y-2">
                          <Label htmlFor="linkedinMain3">
                            LinkedIn Profile URL
                          </Label>
                          <Input
                            id="linkedinMain3"
                            type="url"
                            placeholder="https://www.linkedin.com/in/your-handle"
                            value={linkedinUrlMain}
                            onChange={(e) => setLinkedinUrlMain(e.target.value)}
                          />
                          <p className="text-xs text-gray-600">
                            Only the URL is stored.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="grid sm:grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="prcLast4Main2">
                                PRC ID (Last 4 Digits)
                              </Label>
                              <Input
                                id="prcLast4Main2"
                                type="text"
                                inputMode="numeric"
                                placeholder="1234"
                                maxLength={4}
                                value={prcLast4Main}
                                onChange={(e) =>
                                  setPrcLast4Main(
                                    e.target.value
                                      .replace(/\D/g, "")
                                      .slice(0, 4)
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="prcImageMain2">
                                Upload PRC ID Image
                              </Label>
                              <Input
                                id="prcImageMain2"
                                type="file"
                                accept="image/*"
                                onChange={(e) =>
                                  onPickImage(
                                    e,
                                    setPrcImageFileMain,
                                    setPrcImagePreviewMain,
                                    setPrcImageErrorMain
                                  )
                                }
                              />
                              {prcImageErrorMain && (
                                <p className="text-xs text-red-600">
                                  {prcImageErrorMain}
                                </p>
                              )}
                            </div>
                          </div>

                          {prcImagePreviewMain && (
                            <div className="mt-1">
                              <Label className="text-xs text-gray-600">
                                Preview
                              </Label>
                              <div className="mt-2">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={prcImagePreviewMain}
                                  alt="PRC ID Preview"
                                  className="rounded-md border w-full max-w-sm"
                                />
                              </div>
                            </div>
                          )}
                          <p className="text-xs text-gray-600">
                            We store the last 4 digits and the ID image for
                            verification.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Only "other" roles → LinkedIn only */}
                {mode === "linkedin_only" && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center gap-2">
                        <ExternalLink className="h-5 w-5 text-blue-600" />
                        <h3 className="font-semibold text-sm sm:text-base dark:text-white">
                          LinkedIn Verification (Required)
                        </h3>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="linkedinMainOnly">
                          LinkedIn Profile URL
                        </Label>
                        <Input
                          id="linkedinMainOnly"
                          type="url"
                          placeholder="https://www.linkedin.com/in/your-handle"
                          value={linkedinUrlMain}
                          onChange={(e) => setLinkedinUrlMain(e.target.value)}
                        />
                        <p className="text-xs text-gray-600">
                          Only the URL is stored.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Step 4 */}
            {step === 4 && (
              <div className="space-y-4">
                <CategorySelector
                  selectedCategories={selectedCategories}
                  onChange={setSelectedCategories}
                  minRequired={1}
                />
                <Card className="bg-amber-50 border-amber-200 dark:border-amber-200/10">
                  <CardContent className="pt-4">
                    <h3 className="font-semibold mb-2 text-sm sm:text-base dark:text-white">
                      Badge System:
                    </h3>
                    <div className="text-xs sm:text-sm text-gray-700 space-y-2 dark:text-gray-400">
                      <p>
                        <strong>Silver Badge (Starting):</strong> unlocked after
                        admin approval 
                      </p>
                      <p>
                        <strong>Gold Badge:</strong> 75% accuracy + 20 votes.
                       
                      </p>
                      <p>
                        <strong>Expert Badge:</strong> 85% accuracy + 100 votes.
                       
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Nav buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
              {step > 1 && (
                <Button
                  onClick={() => setStep(step - 1)}
                  className="w-full sm:flex-1 order-2 sm:order-1 bg-[#3e3e42]"
                >
                  Back
                </Button>
              )}
              <Button
                onClick={handleNext}
                className="w-full sm:flex-1 bg-[#227DC3] hover:bg-blue-700 order-1 sm:order-2"
                disabled={
                  (step === 1 && !displayName.trim()) ||
                  (step === 2 &&
                    (!geo.country || !geo.province || !geo.city)) ||
                  (step === 3 && step3Disabled) ||
                    (step === 4 && selectedCategories.length === 0)
                }
              >
                {step === 4 ? "Complete Registration" : "Continue"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </WalletRequired>
  );
}
