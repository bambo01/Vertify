'use client';

import { useEffect, useState } from 'react';
import { storage } from '@/lib/storage';
import { CATEGORIES } from '@/lib/constants';
import { ClaimCard } from '@/components/claim-card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Filter } from 'lucide-react';

export default function ExplorePage() {
  const [claims, setClaims] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const loadClaims = async () => {
      const allClaims = await storage.getClaims();
      setClaims(allClaims);
    };
    loadClaims();
  }, []);

  const filterClaims = (status) => {
    return claims
      .filter((claim) => status.includes(claim.status))
      .filter((claim) => selectedCategory === 'all' || claim.category === selectedCategory)
      .filter((claim) =>
        searchQuery === '' ||
        claim.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        claim.summary.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => b.createdAt - a.createdAt);
  };

  const votingClaims = filterClaims(['voting']);
  const endedClaims = filterClaims(['ended', 'verified', 'flagged']);

  const getCategoryCount = (category) => {
    if (category === 'all') return claims.length;
    return claims.filter((claim) => claim.category === category).length;
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
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4">Explore Claims</h1>
        <p className="text-gray-600 mb-6 dark:text-white">
          Browse community-submitted claims by category and vote with evidence
        </p>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input
            placeholder="Search claims..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-600 dark:text-white">Filter by Category:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={selectedCategory === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory('all')}
              className="gap-1"
            >
              All
              <Badge variant="secondary" className="ml-1">
                {getCategoryCount('all')}
              </Badge>
            </Button>
            {CATEGORIES.map((category) => (
              <Button
                key={category}
                variant={selectedCategory === category ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(category)}
                className="gap-1"
              >
                {category}
                <Badge variant="secondary" className="ml-1">
                  {getCategoryCount(category)}
                </Badge>
              </Button>
            ))}
          </div>
        </div>
      </div>

      <Tabs defaultValue="voting" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="voting">
            Voting ({votingClaims.length})
          </TabsTrigger>
          <TabsTrigger value="ended">
            Ended ({endedClaims.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="voting" className="mt-6">
          {votingClaims.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {selectedCategory !== 'all' 
                ? `No active voting claims in ${selectedCategory} category`
                : 'No active voting claims found'}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {votingClaims.map((claim) => (
                <ClaimCard key={claim.id} claim={claim} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ended" className="mt-6">
          {endedClaims.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {selectedCategory !== 'all' 
                ? `No ended claims in ${selectedCategory} category`
                : 'No ended claims found'}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {endedClaims.map((claim) => (
                <ClaimCard key={claim.id} claim={claim} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
