'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { WalletRequired } from '@/components/wallet-connect';
import { VoterScopeSelector } from '@/components/voter-scope-selector';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { storage } from '@/lib/storage';
import { generateEligibilitySnapshotHash } from '@/lib/eligibility';
import { CATEGORIES } from '@/lib/constants';
import { toast } from 'sonner';
import { FileText, Loader2 } from 'lucide-react';

export default function SubmitPage() {
  const { address } = useAccount();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState('');
  const [voterScope, setVoterScope] = useState({
    everyone: true,
    requireCategory: false,
    allowedRoles: [],
    allowedGeo: {
      cities: [],
      provinces: [],
      countries: [],
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profile, setProfile] = useState(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const loadProfile = async () => {
      if (address) {
        const userProfile = await storage.getUserProfile(address);
        if (!userProfile) {
          toast.error('Please complete registration first');
          router.push('/register');
        } else {
          setProfile(userProfile);
        }
      }
    };
    loadProfile();
  }, [address, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!address || !profile) return;

    if (!title.trim() || !url.trim() || !summary.trim() || !category) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      new URL(url);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    if (!profile.categories.includes(category)) {
      toast.error(`You need a badge in ${category} to submit claims in this category`);
      return;
    }

    setIsSubmitting(true);

    try {
      const mockTxHash = `0x${Math.random().toString(16).substring(2)}${Date.now().toString(16)}`;
      const mockCid = `Qm${Math.random().toString(36).substring(2, 15)}`;
      const mockDataHash = `0x${Math.random().toString(16).substring(2)}${Date.now().toString(16)}`;

      const claim = {
        id: `claim-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        title: title.trim(),
        url: url.trim(),
        summary: summary.trim(),
        category: category,
        author: profile.displayName,
        authorAddress: address,
        createdAt: Date.now(),
        votingEndsAt: Date.now() + (45 * 1000),
        status: 'voting',
        truthVotes: 0,
        fakeVotes: 0,
        truthStake: 0,
        fakeStake: 0,
        truthWeight: 0,
        fakeWeight: 0,
        evidence: [],
        txHash: mockTxHash,
        ipfsCid: mockCid,
        dataHash: mockDataHash,
        
        // v2.1: Voter scope
        voterScope: voterScope,
        eligibilitySnapshotHash: generateEligibilitySnapshotHash({ voterScope }),
      };

      await storage.saveClaim(claim);

      toast.success('Claim submitted successfully! 🎉');
      router.push(`/claim/${claim.id}`);
    } catch (error) {
      toast.error('Failed to submit claim');
      console.error(error);
    } finally {
      setIsSubmitting(false);
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
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-6 sm:mb-8">
            <FileText className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 text-blue-600" />
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Submit a Claim</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
              Post a news article or claim for community fact-checking
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl sm:text-2xl dark:text-white">Claim Details</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={category}
                    onValueChange={(value) => setCategory(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {profile?.categories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    You can only submit claims in categories where you have badges
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Claim Title *</Label>
                  <Input
                    id="title"
                    type="text"
                    placeholder="Brief, descriptive title of the claim"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={200}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="url">Source URL *</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example.com/article"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    Link to the article or source making the claim
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="summary">Summary *</Label>
                  <Textarea
                    id="summary"
                    placeholder="Provide a brief summary of the claim and why it needs fact-checking"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    rows={4}
                    maxLength={500}
                  />
                  <p className="text-xs text-gray-500">
                    {summary.length}/500 characters
                  </p>
                </div>

                {/* v2.1: Voter Scope Selector */}
                {category && (
                  <VoterScopeSelector
                    claimCategory={category}
                    voterScope={voterScope}
                    onChange={setVoterScope}
                  />
                )}

                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2 dark:text-white">
                      What happens next:
                    </p>
                    <ul className="text-xs sm:text-sm text-gray-700 space-y-1 dark:text-gray-400">
                      <li>• Your claim will be anchored on Base blockchain</li>
                      <li>• Eligible voters have 45 seconds to fact-check with evidence</li>
                      <li>• AI will analyze the claim after voting ends</li>
                      <li>• Resolution is weighted by badges, stakes, and evidence</li>
                      <li>• Only voters meeting your scope criteria can participate</li>
                    </ul>
                  </CardContent>
                </Card>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={isSubmitting || !title || !url || !summary || !category}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    'Submit Claim'
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </WalletRequired>
  );
}
