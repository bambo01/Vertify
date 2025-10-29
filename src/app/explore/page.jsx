// app/explore/page.jsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { storage } from '@/lib/storage';
import { CATEGORIES } from '@/lib/constants';
import { ClaimCard } from '@/components/claim-card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Filter } from 'lucide-react';

// ✨ Animations (kept for headers/filters/tabs, but NOT for ClaimCard grids)
import FadeInWhenVisible from '@/components/FadeInWhenVisible';
import { StaggerInView, StaggerItem } from '@/components/StaggerInView';

export default function ExplorePage() {
  const [claims, setClaims] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const loadClaims = async () => {
      const allClaims = await storage.getClaims();
      setClaims(allClaims || []);
    };
    loadClaims();
  }, []);

  // 🔒 Exclude archived claims globally from any UI or counts
  const visibleClaims = useMemo(
    () => (Array.isArray(claims) ? claims.filter(c => c?.status !== 'archived') : []),
    [claims]
  );

  const filterClaims = (allowedStatuses) => {
    return visibleClaims
      .filter((claim) => allowedStatuses.includes(claim.status))
      .filter((claim) => selectedCategory === 'all' || claim.category === selectedCategory)
      .filter((claim) =>
        !searchQuery
          ? true
          : claim.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            claim.summary.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  };

  const votingClaims = filterClaims(['voting']);
  const endedClaims = filterClaims(['ended', 'verified', 'flagged', 'resolved']);

  // Counts should also exclude archived claims
  const getCategoryCount = (category) => {
    if (category === 'all') return visibleClaims.length;
    return visibleClaims.filter((claim) => claim.category === category).length;
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

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Header + Search + Filters */}
      <FadeInWhenVisible once={false}>
        <div className="mb-8">
          <FadeInWhenVisible y={10} once={false}>
            <h1 className="text-4xl font-bold mb-4">Explore Claims</h1>
            <p className="text-gray-600 mb-6 dark:text-white">
              Browse community-submitted claims by category and vote with evidence
            </p>
          </FadeInWhenVisible>

          <FadeInWhenVisible y={8} once={false}>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search claims..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 dark:bg-gray-900"
              />
            </div>
          </FadeInWhenVisible>

          <FadeInWhenVisible y={8} once={false}>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Filter className="h-4 w-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-600 dark:text-white">
                  Filter by Category:
                </span>
              </div>

              <StaggerInView once={false} delay={0.05}>
                <div className="flex flex-wrap gap-2">
                  <StaggerItem>
                    <Button
                      variant={selectedCategory === 'all' ? 'exploreAll' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCategory('all')}
                      className="gap-1"
                    >
                      All
                      <Badge variant="secondary" className="ml-1">
                        {getCategoryCount('all')}
                      </Badge>
                    </Button>
                  </StaggerItem>

                  {CATEGORIES.map((category) => (
                    <StaggerItem key={category}>
                      <Button
                        variant={selectedCategory === category ? 'default' : 'explore'}
                        size="sm"
                        onClick={() => setSelectedCategory(category)}
                        className="gap-1"
                      >
                        {category}
                        <Badge variant="secondary" className="ml-1">
                          {getCategoryCount(category)}
                        </Badge>
                      </Button>
                    </StaggerItem>
                  ))}
                </div>
              </StaggerInView>
            </div>
          </FadeInWhenVisible>
        </div>
      </FadeInWhenVisible>

      {/* Tabs */}
      <Tabs defaultValue="voting" className="w-full">
        <FadeInWhenVisible y={8} once={false}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="voting">
              Voting ({votingClaims.length})
            </TabsTrigger>
            <TabsTrigger value="ended">
              Ended ({endedClaims.length})
            </TabsTrigger>
          </TabsList>
        </FadeInWhenVisible>

        {/* Voting tab */}
        <TabsContent value="voting" className="mt-6">
          {votingClaims.length === 0 ? (
            <FadeInWhenVisible once={false}>
              <div className="text-center py-12 text-gray-500">
                {selectedCategory !== 'all'
                  ? `No active voting claims in ${selectedCategory} category`
                  : 'No active voting claims found'}
              </div>
            </FadeInWhenVisible>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {votingClaims.map((claim) => (
                <div key={claim.id}>
                  <ClaimCard claim={claim} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Ended tab */}
        <TabsContent value="ended" className="mt-6">
          {endedClaims.length === 0 ? (
            <FadeInWhenVisible once={false}>
              <div className="text-center py-12 text-gray-500">
                {selectedCategory !== 'all'
                  ? `No ended claims in ${selectedCategory} category`
                  : 'No ended claims found'}
              </div>
            </FadeInWhenVisible>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {endedClaims.map((claim) => (
                <div key={claim.id}>
                  <ClaimCard claim={claim} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
