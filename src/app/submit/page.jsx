'use client';

import { useState, useEffect, useMemo } from 'react';
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
    allowedGeo: { cities: [], provinces: [], countries: [] },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profile, setProfile] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const [pinResult, setPinResult] = useState(null);

  // Voting schedule state
  const [votingMode, setVotingMode] = useState('preset'); // 'preset' | 'custom' | 'endtime'
  const [presetDuration, setPresetDuration] = useState('86400'); // default 24h in seconds
  const [customNumber, setCustomNumber] = useState('24');        // e.g., "24"
  const [customUnit, setCustomUnit] = useState('hours');         // 'minutes' | 'hours' | 'days'
  const [endTimeLocal, setEndTimeLocal] = useState('');          // yyyy-MM-ddTHH:mm (local)

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

  // Normalize categories to strings and only allow minted ones
  const userCategories = useMemo(() => {
    const arr = profile?.categories || [];
    const onlyMinted = arr
      .filter((c) => (typeof c === 'object' ? c.status === 'minted' : true))
      .map((c) => (typeof c === 'string' ? c : c.category))
      .map((s) => s?.trim())
      .filter(Boolean);
    const seen = new Set();
    return onlyMinted.filter((c) => (seen.has(c.toLowerCase()) ? false : (seen.add(c.toLowerCase()), true)));
  }, [profile]);

  // Auto-select first category
  useEffect(() => {
    if (!category && userCategories.length) setCategory(userCategories[0]);
  }, [userCategories, category]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!address || !profile) return;

    // Basic validation
    if (!title.trim() || !url.trim() || !summary.trim() || !category) {
      toast.error('Please fill in all fields');
      return;
    }
    try {
      // eslint-disable-next-line no-new
      new URL(url);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }
    const canSubmit = userCategories.some((c) => c.toLowerCase() === String(category).toLowerCase());
    if (!canSubmit) {
      toast.error(`You need a badge in ${category} to submit claims in this category`);
      return;
    }

    // Derive final votingDurationSec from schedule controls
    let finalDurationSec = 0;
    if (votingMode === 'preset') {
      finalDurationSec = parseInt(presetDuration, 10);
    } else if (votingMode === 'custom') {
      const n = parseInt(customNumber, 10);
      if (!Number.isFinite(n) || n <= 0) {
        toast.error('Custom duration must be a positive number');
        return;
      }
      const unitMult = customUnit === 'minutes' ? 60 : customUnit === 'hours' ? 3600 : 86400;
      finalDurationSec = n * unitMult;
    } else if (votingMode === 'endtime') {
      if (!endTimeLocal) {
        toast.error('Please select an end date & time');
        return;
      }
      const endMs = new Date(endTimeLocal).getTime();
      const diffSec = Math.floor((endMs - Date.now()) / 1000);
      finalDurationSec = diffSec;
    }
    const MIN = 60; // 1 minute
    const MAX = 60 * 60 * 24 * 30; // 30 days
    if (!Number.isFinite(finalDurationSec) || finalDurationSec < MIN || finalDurationSec > MAX) {
      toast.error('Voting duration must be between 1 minute and 30 days');
      return;
    }

    setIsSubmitting(true);
    try {
      // Canonical metadata (server will pin to Pinata)
      const claimMeta = {
        title: title.trim(),
        url: url.trim(),
        summary: summary.trim(),
        category,
        poster: String(address).toLowerCase(),
        createdAt: new Date().toISOString(),
        voterScope,
        eligibilityHash: generateEligibilitySnapshotHash({ voterScope }), // server may override
        votingDurationSec: finalDurationSec,
      };
      console.log('my Meta: ', claimMeta);

      // Ask Railway backend to pin + allocate IDs
      const resp = await fetch(`${process.env.NEXT_PUBLIC_API_BASE}/claims/init`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: claimMeta.title,
          url: claimMeta.url,
          summary: claimMeta.summary,
          category: claimMeta.category,
          voterScope: claimMeta.voterScope,
          poster: claimMeta.poster,
          eligibilityHash: claimMeta.eligibilityHash, // optional
          votingDurationSec: finalDurationSec,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error || 'Pin/init failed');
      }

      const json = await resp.json();
      const cid = json.cid || json.IpfsHash;
      const claimId = json.claimId;
      const eligibilityHash = json.eligibilityHash || claimMeta.eligibilityHash;
      const votingDurationSec = json.votingDurationSec || finalDurationSec;

      setPinResult({ cid, claimId, eligibilityHash, votingDurationSec });
      const shortCid = cid && cid.length > 12 ? `${cid.slice(0, 8)}…${cid.slice(-6)}` : cid;
      toast.success(`Pinned to IPFS ✅ CID: ${shortCid}`);

      // Step 2 (next): call the contract with { claimId, cid, votingDurationSec, eligibilityHash }
      // Step 3: call /claims/finalize with { claimId, txHash, ... } to persist DB

    } catch (error) {
      console.error(error);
      toast.error(error?.message || 'Failed to pin claim');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isClient) {
    return (
      <div className="container mx-auto px-4 py-8 sm:py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded w-1/3" />
          <div className="h-64 bg-gray-200 rounded" />
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
                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {userCategories.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500">
                    You can only submit claims in categories where you have minted badges
                  </p>
                </div>

                {/* Title */}
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

                {/* URL */}
                <div className="space-y-2">
                  <Label htmlFor="url">Source URL *</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example.com/article"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">Link to the article or source making the claim</p>
                </div>

                {/* Summary */}
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
                  <p className="text-xs text-gray-500">{summary.length}/500 characters</p>
                </div>

                {/* Voter Scope & Voting Schedule */}
                {category && (
                  <>
                    <VoterScopeSelector
                      claimCategory={category}
                      voterScope={voterScope}
                      onChange={setVoterScope}
                    />

                    {/* Voting Schedule */}
                    <div className="space-y-3 mt-6">
                      <Label>Voting Schedule</Label>

                      {/* Mode selector */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <Button
                          type="button"
                          variant={votingMode === 'preset' ? 'default' : 'outline'}
                          onClick={() => setVotingMode('preset')}
                        >
                          Presets
                        </Button>
                        <Button
                          type="button"
                          variant={votingMode === 'custom' ? 'default' : 'outline'}
                          onClick={() => setVotingMode('custom')}
                        >
                          Custom duration
                        </Button>
                        <Button
                          type="button"
                          variant={votingMode === 'endtime' ? 'default' : 'outline'}
                          onClick={() => setVotingMode('endtime')}
                        >
                          End date & time
                        </Button>
                      </div>

                      {/* Presets */}
                      {votingMode === 'preset' && (
                        <div className="space-y-2">
                          <Label htmlFor="presetDuration">Choose a preset</Label>
                          <Select value={presetDuration} onValueChange={setPresetDuration}>
                            <SelectTrigger id="presetDuration">
                              <SelectValue placeholder="Select duration" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="900">15 minutes</SelectItem>
                              <SelectItem value="1800">30 minutes</SelectItem>
                              <SelectItem value="3600">1 hour</SelectItem>
                              <SelectItem value="21600">6 hours</SelectItem>
                              <SelectItem value="43200">12 hours</SelectItem>
                              <SelectItem value="86400">24 hours</SelectItem>
                              <SelectItem value="172800">48 hours</SelectItem>
                              <SelectItem value="259200">72 hours</SelectItem>
                              <SelectItem value="604800">7 days</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-gray-500">Common windows like 24h or 48h.</p>
                        </div>
                      )}

                      {/* Custom duration */}
                      {votingMode === 'custom' && (
                        <div className="grid grid-cols-3 gap-2 items-end">
                          <div className="col-span-2 space-y-2">
                            <Label htmlFor="customNumber">Amount</Label>
                            <Input
                              id="customNumber"
                              type="number"
                              min={1}
                              value={customNumber}
                              onChange={(e) => setCustomNumber(e.target.value)}
                              placeholder="e.g., 36"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="customUnit">Unit</Label>
                            <Select value={customUnit} onValueChange={setCustomUnit}>
                              <SelectTrigger id="customUnit">
                                <SelectValue placeholder="Unit" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="minutes">Minutes</SelectItem>
                                <SelectItem value="hours">Hours</SelectItem>
                                <SelectItem value="days">Days</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-3">
                            <p className="text-xs text-gray-500">
                              Enter any duration (e.g., 36 hours). Min 1 minute; Max 30 days.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* End date & time */}
                      {votingMode === 'endtime' && (
                        <div className="space-y-2">
                          <Label htmlFor="endTimeLocal">Ends at</Label>
                          <Input
                            id="endTimeLocal"
                            type="datetime-local"
                            value={endTimeLocal}
                            onChange={(e) => setEndTimeLocal(e.target.value)}
                          />
                          <p className="text-xs text-gray-500">
                            Pick an exact local end time (e.g., tomorrow 6:00 PM). Max 30 days from now.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="pt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2 dark:text-white">What happens next:</p>
                    <ul className="text-xs sm:text-sm text-gray-700 space-y-1 dark:text-gray-400">
                      <li>• Your claim metadata will be pinned to IPFS</li>
                      <li>• Then it will be anchored on the Base blockchain</li>
                      <li>• Eligible voters have a limited window to fact-check with evidence</li>
                      <li>• AI will analyze the claim after voting ends</li>
                      <li>• Resolution is weighted by badges, stakes, and evidence</li>
                    </ul>
                    {pinResult?.cid && (
                      <p className="text-xs mt-2">
                        Latest CID: <span className="font-mono">{pinResult.cid}</span>
                      </p>
                    )}
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
