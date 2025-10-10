'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { WalletRequired } from '@/components/wallet-connect';
import { CategorySelector } from '@/components/category-selector';
import { RoleSelector } from '@/components/role-selector';
import { GeoSelector } from '@/components/geo-selector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { storage } from '@/lib/storage';
import { CheckCircle, User, Shield, Briefcase, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export default function RegisterPage() {
  const { address } = useAccount();
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [geo, setGeo] = useState({ country: '', province: '', city: '' });
  const [step, setStep] = useState(1);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const checkProfile = async () => {
      if (address) {
        const profile = await storage.getUserProfile(address);
        if (profile) {
          router.push('/dashboard');
        }
      }
    };
    checkProfile();
  }, [address, router]);

  const handleNext = () => {
    if (step === 1) {
      if (!displayName.trim()) {
        toast.error('Please enter a display name');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!geo.country || !geo.province || !geo.city) {
        toast.error('Please select your location (country, province, and city)');
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      if (selectedRoles.length === 0) {
        toast.error('Please select at least one role');
        return;
      }
      setStep(4);
      return;
    }

    if (step === 4) {
      handleRegister();
    }
  };

  const handleRegister = async () => {
    if (!address) return;

    if (selectedCategories.length === 0) {
      toast.error('Please select at least one category');
      return;
    }

    const badges = selectedCategories.map((category) => ({
      category,
      tier: 'Silver',
      truthScore: 0.50,
      totalVotes: 0,
      correctVotes: 0,
      createdAt: Date.now(),
      lastUpgradeAt: Date.now(),
    }));

    // v2.1: Create role badges
    const roleBadges = selectedRoles.map((role) => ({
      role,
      tier: 'Silver',
      verified: true,
      issuerRef: 'self-attested',
      createdAt: Date.now(),
    }));

    const profile = {
      address,
      displayName: displayName.trim(),
      registeredAt: Date.now(),
      
      // v2.1: New fields
      city: geo.city,
      province: geo.province,
      country: geo.country,
      roles: selectedRoles,
      roleBadges,
      residencyAttestationRef: `mock-attestation-${Date.now()}`,
      
      // Original fields
      categories: selectedCategories,
      badges,
      overallTruthScore: 0.50,
      totalStaked: 0,
      totalEarned: 0,
    };

    try {
      await storage.saveUserProfile(profile);
      toast.success('Registration complete! Welcome to TruthChain 🎉');
      router.push('/dashboard');
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('Failed to register. Please try again.');
    }
  };

  if (!isClient) {
    return (
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <WalletRequired>
      <div className="container mx-auto px-4 py-8 sm:py-12 max-w-4xl">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">Join TruthChain</h1>
          <p className="text-sm sm:text-base text-gray-600">
            Become a fact-checker and earn rewards for accuracy
          </p>
        </div>

        {/* Progress Steps - Horizontal scroll on mobile */}
        <div className="mb-6 sm:mb-8 overflow-x-auto pb-2">
          <div className="flex justify-center items-center gap-2 sm:gap-4 min-w-max">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`rounded-full p-1.5 sm:p-2 ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                {step > 1 ? <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" /> : <User className="h-4 w-4 sm:h-5 sm:w-5" />}
              </div>
              <span className="font-medium text-sm sm:text-base whitespace-nowrap">Profile</span>
            </div>
            <div className="h-px w-8 sm:w-16 bg-gray-300" />
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`rounded-full p-1.5 sm:p-2 ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                {step > 2 ? <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" /> : <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />}
              </div>
              <span className="font-medium text-sm sm:text-base whitespace-nowrap">Location</span>
            </div>
            <div className="h-px w-8 sm:w-16 bg-gray-300" />
            <div className={`flex items-center gap-2 ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`rounded-full p-1.5 sm:p-2 ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                {step > 3 ? <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5" /> : <Briefcase className="h-4 w-4 sm:h-5 sm:w-5" />}
              </div>
              <span className="font-medium text-sm sm:text-base whitespace-nowrap">Roles</span>
            </div>
            <div className="h-px w-8 sm:w-16 bg-gray-300" />
            <div className={`flex items-center gap-2 ${step >= 4 ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`rounded-full p-1.5 sm:p-2 ${step >= 4 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
              <span className="font-medium text-sm sm:text-base whitespace-nowrap">Categories</span>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">
              {step === 1 && 'Create Your Profile'}
              {step === 2 && 'Your Location'}
              {step === 3 && 'Your Professional Roles'}
              {step === 4 && 'Select Your Expertise'}
            </CardTitle>
            <CardDescription className="text-sm">
              {step === 1 && 'Choose a display name for your fact-checker identity'}
              {step === 2 && 'Privacy: Only city-level location is stored for geo-gated claims'}
              {step === 3 && 'Select your professional roles to participate in role-gated claims'}
              {step === 4 && 'Pick categories where you can provide valuable insights'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Profile */}
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
                  <p className="text-xs text-gray-500">
                    This name will be visible to others when you vote and submit claims
                  </p>
                </div>

                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-4">
                    <h3 className="font-semibold mb-2 text-sm sm:text-base">How TruthChain Works:</h3>
                    <ul className="text-xs sm:text-sm text-gray-700 space-y-1">
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

            {/* Step 2: Location */}
            {step === 2 && (
              <GeoSelector
                country={geo.country}
                province={geo.province}
                city={geo.city}
                onChange={setGeo}
              />
            )}

            {/* Step 3: Roles */}
            {step === 3 && (
              <div className="space-y-4">
                <RoleSelector
                  selectedRoles={selectedRoles}
                  onChange={setSelectedRoles}
                  minRequired={1}
                />

                <Card className="bg-purple-50 border-purple-200">
                  <CardContent className="pt-4">
                    <h3 className="font-semibold mb-2 text-sm sm:text-base">Why Roles Matter:</h3>
                    <div className="text-xs sm:text-sm text-gray-700 space-y-2">
                      <p>
                        Role badges allow you to vote on specialized claims that require
                        professional expertise (e.g., medical claims require healthcare professionals).
                      </p>
                      <p className="font-medium">
                        Your roles are self-attested initially. Verification coming soon!
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Step 4: Categories */}
            {step === 4 && (
              <div className="space-y-4">
                <CategorySelector
                  selectedCategories={selectedCategories}
                  onChange={setSelectedCategories}
                  minRequired={1}
                />

                <Card className="bg-amber-50 border-amber-200">
                  <CardContent className="pt-4">
                    <h3 className="font-semibold mb-2 text-sm sm:text-base">Badge System:</h3>
                    <div className="text-xs sm:text-sm text-gray-700 space-y-2">
                      <p>
                        <strong>Silver Badge (Starting):</strong> Max 0.002 ETH per vote, 1.0x weight
                      </p>
                      <p>
                        <strong>Gold Badge:</strong> Requires 75% accuracy + 20 votes. Max 0.005 ETH, 1.3x weight
                      </p>
                      <p>
                        <strong>Expert Badge:</strong> Requires 85% accuracy + 100 votes. Max 0.01 ETH, 1.6x weight
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
              {step > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                  className="w-full sm:flex-1 order-2 sm:order-1"
                >
                  Back
                </Button>
              )}
              <Button
                onClick={handleNext}
                className="w-full sm:flex-1 bg-blue-600 hover:bg-blue-700 order-1 sm:order-2"
                disabled={
                  (step === 1 && !displayName.trim()) ||
                  (step === 2 && (!geo.country || !geo.province || !geo.city)) ||
                  (step === 3 && selectedRoles.length === 0) ||
                  (step === 4 && selectedCategories.length === 0)
                }
              >
                {step === 4 ? 'Complete Registration' : 'Continue'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </WalletRequired>
  );
}
