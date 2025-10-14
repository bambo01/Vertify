'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useRouter } from 'next/navigation';
import { WalletRequired } from '@/components/wallet-connect';
import { BadgeGrid } from '@/components/badge-display';
import { storage } from '@/lib/storage';
import { BADGE_REQUIREMENTS } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClaimCard } from '@/components/claim-card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, FileText, Vote as VoteIcon, Award, Target, Zap } from 'lucide-react';

import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { usePathname } from 'next/navigation';
import { Plus } from 'lucide-react';

export default function DashboardPage() {
  const { address } = useAccount();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [userClaims, setUserClaims] = useState([]);
  const [userVotes, setUserVotes] = useState([]);
  const [isClient, setIsClient] = useState(false);
  const [correctVotes, setCorrectVotes] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [voteClaims, setVoteClaims] = useState({});

   const pathname = usePathname();
  
    const isActive = (path) => pathname === path;

  useEffect(() => {
    setIsClient(true);
    const loadData = async () => {
      if (address) {
        const userProfile = await storage.getUserProfile(address);
        if (!userProfile) {
          router.push('/register');
          return;
        }
        setProfile(userProfile);
        const claims = await storage.getUserClaims(address);
        const votes = await storage.getUserVotes(address);
        setUserClaims(claims);
        setUserVotes(votes);
      }
    };
    loadData();
  }, [address, router]);

  useEffect(() => {
    const calculateCorrect = async () => {
      let count = 0;
      for (const vote of userVotes) {
        const claim = await storage.getClaim(vote.claimId);
        if (!claim || !claim.aiVerdict) continue;
        
        const userVotedTruth = vote.vote === 'truth';
        const aiSaysTruth = claim.aiVerdict.result === 'Truth';
        if (userVotedTruth === aiSaysTruth) count++;
      }
      setCorrectVotes(count);
    };
    calculateCorrect();
  }, [userVotes]);

  useEffect(() => {
    const calculateEarnings = async () => {
      let earnings = 0;
      for (const vote of userVotes) {
        const claim = await storage.getClaim(vote.claimId);
        if (!claim || !claim.aiVerdict) continue;
        
        const userVotedTruth = vote.vote === 'truth';
        const aiSaysTruth = claim.aiVerdict.result === 'Truth';
        const correct = userVotedTruth === aiSaysTruth;
        
        earnings += correct ? vote.stake * 1.8 : 0;
      }
      setTotalEarnings(earnings);
    };
    calculateEarnings();
  }, [userVotes]);

  useEffect(() => {
    const loadVoteClaims = async () => {
      const claims = {};
      for (const vote of userVotes) {
        const claim = await storage.getClaim(vote.claimId);
        if (claim) {
          claims[vote.claimId] = claim;
        }
      }
      setVoteClaims(claims);
    };
    if (userVotes.length > 0) {
      loadVoteClaims();
    }
  }, [userVotes]);

  const accuracy = userVotes.length > 0 ? (correctVotes / userVotes.length) * 100 : 0;

  const getBadgeProgress = (badge) => {
    if (badge.tier === 'Expert') {
      return { nextTier: 'Max Level', progress: 100, requirement: 'You are at the highest tier!' };
    }

    const nextTier = badge.tier === 'Silver' ? 'Gold' : 'Expert';
    const requirements = BADGE_REQUIREMENTS[nextTier];
    
    const scoreProgress = (badge.truthScore / requirements.truthScoreMin) * 100;
    const votesProgress = (badge.totalVotes / requirements.minimumVotes) * 100;
    const progress = Math.min((scoreProgress + votesProgress) / 2, 100);
    
    return {
      nextTier,
      progress,
      requirement: `Need ${requirements.truthScoreMin * 100}% truth score & ${requirements.minimumVotes} votes`,
    };
  };

  if (!isClient) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="text-center">Loading profile...</div>
      </div>
    );
  }

  return (
    <WalletRequired>
      <div className="container mx-auto px-4 py-12">
        <div className='flex justify-between'>
          <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">{profile.displayName}&apos;s Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400">Track your fact-checking performance and earn badges</p>
        </div>
          <Link href="/submit">
              <Button
                className="gap-2 bg-[#44ADFF]"
              >
                <Plus className="h-4 w-4" />
                Submit Claim
              </Button>
            </Link>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Target className="h-8 w-8 text-purple-600" />
                <span className="text-3xl font-bold dark:text-white">{(profile.overallTruthScore * 100).toFixed(0)}%</span>
              </div>
              <p className="text-gray-600 dark:text-gray-400">Truth Score</p>
              <Progress value={profile.overallTruthScore * 100} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <VoteIcon className="h-8 w-8 text-green-600" />
                <span className="text-3xl font-bold dark:text-white">{userVotes.length}</span>
              </div>
              <p className="text-gray-600 dark:text-gray-400">Total Votes</p>
              <p className="text-sm text-green-600 mt-1">{correctVotes} correct</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <Award className="h-8 w-8 text-yellow-600" />
                <span className="text-3xl font-bold dark:text-white">{accuracy.toFixed(0)}%</span>
              </div>
              <p className="text-gray-600 dark:text-gray-400">Vote Accuracy</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="h-8 w-8 text-blue-600" />
                <span className="text-3xl font-bold dark:text-white">{totalEarnings.toFixed(3)}</span>
              </div>
              <p className="text-gray-600 dark:text-gray-400">ETH Earned</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 dark:text-white">
              <Zap className="h-6 w-6 text-yellow-500" />
              Your Category Badges
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profile.badges.length === 0 ? (
              <p className="text-gray-500 dark:text-white">No badges yet. Vote on claims to start earning!</p>
            ) : (
              <div className="space-y-6">
                {profile.badges.map((badge) => {
                  const badgeProgress = getBadgeProgress(badge);
                  return (
                    <div key={badge.category} className="p-4 bg-gray-50 rounded-lg dark:bg-[#252526]">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Badge className={
                            badge.tier === 'Expert'
                              ? 'bg-purple-100 text-purple-800'
                              : badge.tier === 'Gold'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }>
                            {badge.category} {badge.tier}
                          </Badge>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {badge.totalVotes} votes • {badge.correctVotes} correct
                          </span>
                        </div>
                        <Badge 
                          variant="outline">
                          {(badge.truthScore * 100).toFixed(0)}% score
                        </Badge>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600 dark:text-white">Progress to {badgeProgress.nextTier}</span>
                          <span className="font-medium dark:text-white">{badgeProgress.progress.toFixed(0)}%</span>
                        </div>
                        <Progress value={badgeProgress.progress} />
                        <p className="text-xs text-gray-500 dark:text-gray-400">{badgeProgress.requirement}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Tabs defaultValue="claims" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="claims">
              <FileText className="h-4 w-4 mr-2" />
              My Claims ({userClaims.length})
            </TabsTrigger>
            <TabsTrigger value="votes">
              <VoteIcon className="h-4 w-4 mr-2" />
              My Votes ({userVotes.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="claims" className="mt-6">
            {userClaims.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-gray-500">
                  You haven&apos;t submitted any claims yet
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userClaims.map((claim) => (
                  <ClaimCard key={claim.id} claim={claim} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="votes" className="mt-6">
            {userVotes.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-center text-gray-500">
                  You haven&apos;t voted on any claims yet
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {userVotes.map((vote) => {
                  const claim = voteClaims[vote.claimId];
                  if (!claim) return null;

                  let isCorrect = null;
                  if (claim.aiVerdict) {
                    const userVotedTruth = vote.vote === 'truth';
                    const aiSaysTruth = claim.aiVerdict.result === 'Truth';
                    isCorrect = userVotedTruth === aiSaysTruth;
                  }

                  return (
                    <Card key={vote.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge>{claim.category}</Badge>
                              <Badge variant="outline" className="text-xs">
                                {vote.badgeTier}
                              </Badge>
                            </div>
                            <CardTitle className="text-lg">{claim.title}</CardTitle>
                          </div>
                          <div className="flex gap-2">
                            <Badge
                              className={
                                vote.vote === 'truth'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-red-100 text-red-800'
                              }
                            >
                              {vote.vote === 'truth' ? 'Truth' : 'Fake'}
                            </Badge>
                            {isCorrect !== null && (
                              <Badge
                                variant={isCorrect ? 'default' : 'secondary'}
                                className={
                                  isCorrect
                                    ? 'bg-green-600'
                                    : 'bg-gray-500'
                                }
                              >
                                {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex justify-between text-sm text-gray-600 mb-2">
                          <span>Stake: {vote.stake.toFixed(3)} ETH</span>
                          <span>{new Date(vote.timestamp).toLocaleDateString()}</span>
                        </div>
                        {vote.evidence.length > 0 && (
                          <div className="text-xs text-gray-500">
                            {vote.evidence.length} evidence sources provided
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </WalletRequired>
  );
}
