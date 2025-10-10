'use client';

import { Badge } from './ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Award, Star, Crown } from 'lucide-react';

export function BadgeDisplay({ badge, showDetails = false }) {
  const getBadgeColor = (tier) => {
    switch (tier) {
      case 'Silver':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'Gold':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'Expert':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getBadgeIcon = (tier) => {
    switch (tier) {
      case 'Silver':
        return <Award className="h-3 w-3" />;
      case 'Gold':
        return <Star className="h-3 w-3" />;
      case 'Expert':
        return <Crown className="h-3 w-3" />;
      default:
        return <Award className="h-3 w-3" />;
    }
  };

  const badgeContent = (
    <Badge className={`${getBadgeColor(badge.tier)} flex items-center gap-1`}>
      {getBadgeIcon(badge.tier)}
      <span>{badge.category} {badge.tier}</span>
    </Badge>
  );

  if (!showDetails) {
    return badgeContent;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badgeContent}
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 text-xs">
            <p className="font-semibold">{badge.category} {badge.tier}</p>
            <p>Truth Score: {(badge.truthScore * 100).toFixed(1)}%</p>
            <p>Votes: {badge.totalVotes} ({badge.correctVotes} correct)</p>
            <p>Accuracy: {badge.totalVotes > 0 ? ((badge.correctVotes / badge.totalVotes) * 100).toFixed(1) : 0}%</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function BadgeGrid({ badges }) {
  if (badges.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No badges yet. Register for categories to start earning badges!
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <BadgeDisplay key={badge.category} badge={badge} showDetails />
      ))}
    </div>
  );
}
