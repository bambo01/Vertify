'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { ROLES } from '@/lib/constants';
import { Briefcase } from 'lucide-react';

export function RoleSelector({ selectedRoles, onChange, minRequired = 0 }) {
  const handleToggle = (role) => {
    if (selectedRoles.includes(role)) {
      onChange(selectedRoles.filter((r) => r !== role));
    } else {
      onChange([...selectedRoles, role]);
    }
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Briefcase className="h-5 w-5 text-blue-600" />
          <Label className="text-base font-semibold dark:text-white">
            Select Your Roles {minRequired > 0 && `(Min: ${minRequired})`}
          </Label>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ROLES.map((role) => (
            <div
              key={role}
              className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-gray-50 transition-colors dark:border-gray-600 dark:hover:bg-gray-50/10"
            >
              <Checkbox
                id={`role-${role}`}
                checked={selectedRoles.includes(role)}
                onCheckedChange={() => handleToggle(role)}
              />
              <Label
                htmlFor={`role-${role}`}
                className="flex-1 cursor-pointer text-sm"
              >
                {role}
              </Label>
            </div>
          ))}
        </div>
        {minRequired > 0 && selectedRoles.length < minRequired && (
          <p className="text-sm text-red-600 mt-2">
            Please select at least {minRequired} role{minRequired > 1 ? 's' : ''}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
