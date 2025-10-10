'use client';

import { Card, CardContent } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { CATEGORIES } from '@/lib/constants';
import { Cpu, Heart, Scale, DollarSign, Beaker } from 'lucide-react';

export function CategorySelector({ selectedCategories, onChange, minRequired = 1 }) {
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'Tech':
        return <Cpu className="h-5 w-5" />;
      case 'Health':
        return <Heart className="h-5 w-5" />;
      case 'Politics':
        return <Scale className="h-5 w-5" />;
      case 'Finance':
        return <DollarSign className="h-5 w-5" />;
      case 'Science':
        return <Beaker className="h-5 w-5" />;
      default:
        return <Cpu className="h-5 w-5" />;
    }
  };

  const getCategoryDescription = (category) => {
    switch (category) {
      case 'Tech':
        return 'Technology, AI, software, hardware, cybersecurity';
      case 'Health':
        return 'Medicine, public health, nutrition, wellness';
      case 'Politics':
        return 'Government, policy, elections, international relations';
      case 'Finance':
        return 'Markets, economics, cryptocurrency, business';
      case 'Science':
        return 'Research, climate, space, physics, biology';
      default:
        return '';
    }
  };

  const toggleCategory = (category) => {
    if (selectedCategories.includes(category)) {
      onChange(selectedCategories.filter((c) => c !== category));
    } else {
      onChange([...selectedCategories, category]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Select at least {minRequired} {minRequired === 1 ? 'category' : 'categories'} you want to fact-check
        </p>
        {selectedCategories.length > 0 && (
          <Badge variant="outline">
            {selectedCategories.length} selected
          </Badge>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {CATEGORIES.map((category) => {
          const isSelected = selectedCategories.includes(category);
          return (
            <Card
              key={category}
              className={`cursor-pointer transition-all ${
                isSelected ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
              }`}
              onClick={() => toggleCategory(category)}
            >
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={category}
                    checked={isSelected}
                    onCheckedChange={() => toggleCategory(category)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor={category}
                      className="flex items-center gap-2 cursor-pointer font-semibold mb-1"
                    >
                      {getCategoryIcon(category)}
                      {category}
                    </Label>
                    <p className="text-xs text-gray-600">
                      {getCategoryDescription(category)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedCategories.length < minRequired && (
        <p className="text-sm text-amber-600">
          Please select at least {minRequired} {minRequired === 1 ? 'category' : 'categories'}
        </p>
      )}
    </div>
  );
}
