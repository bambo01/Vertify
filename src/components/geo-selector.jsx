'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { COUNTRIES, getProvincesForCountry, getCitiesForProvince } from '@/lib/constants';
import { MapPin } from 'lucide-react';

export function GeoSelector({ country, province, city, onChange }) {
  const [provinces, setProvinces] = useState([]);
  const [cities, setCities] = useState([]);

  useEffect(() => {
    if (country) {
      const countryObj = COUNTRIES.find((c) => c.code === country);
      if (countryObj) {
        const provList = getProvincesForCountry(country);
        setProvinces(provList);
        setCities([]);
      }
    } else {
      setProvinces([]);
      setCities([]);
    }
  }, [country]);

  useEffect(() => {
    if (country && province) {
      const cityList = getCitiesForProvince(country, province);
      setCities(cityList);
    } else {
      setCities([]);
    }
  }, [country, province]);

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-blue-600" />
          <Label className="text-base font-semibold dark:text-white">Location (City-level only)</Label>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label 
            htmlFor="country"
            className='dark:text-gray-400'>Country *</Label>
            <Select
              value={country}
              onValueChange={(value) => {
                onChange({ country: value, province: '', city: '' });
              }}
            >
              <SelectTrigger id="country">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {provinces.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="province"
               className='dark:text-gray-400'>Province/State *</Label>
              <Select
                value={province}
                onValueChange={(value) => {
                  onChange({ country, province: value, city: '' });
                }}
              >
                <SelectTrigger id="province">
                  <SelectValue placeholder="Select province/state" />
                </SelectTrigger>
                <SelectContent>
                  {provinces.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {cities.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="city"
               className='dark:text-gray-400'>City *</Label>
              <Select
                value={city}
                onValueChange={(value) => {
                  onChange({ country, province, city: value });
                }}
              >
                <SelectTrigger id="city">
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-3">
          Privacy: Only city-level location is stored. Exact addresses are never saved.
        </p>
      </CardContent>
    </Card>
  );
}
