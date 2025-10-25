'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Plus, X, ExternalLink, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

export function EvidenceInput({ evidence, onChange, minRequired = 1 }) {
  const [currentUrl, setCurrentUrl] = useState('');
  const [error, setError] = useState('');

  const isValidUrl = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const getDomain = (url) => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return '';
    }
  };

  const addEvidence = () => {
    setError('');

    if (!currentUrl.trim()) {
      setError('Please enter a URL');
      return;
    }

    if (!isValidUrl(currentUrl)) {
      setError('Please enter a valid URL (must start with http:// or https://)');
      return;
    }

    if (evidence.includes(currentUrl)) {
      setError('This URL has already been added');
      return;
    }

    onChange([...evidence, currentUrl]);
    setCurrentUrl('');
  };

  const removeEvidence = (url) => {
    onChange(evidence.filter((e) => e !== url));
  };

  const calculateQualityScore = () => {
    const domains = new Set(evidence.map(getDomain));
    const diversityScore = Math.min(domains.size / 3, 1);
    const quantityScore = Math.min(evidence.length / 5, 1);
    return (diversityScore * 0.6 + quantityScore * 0.4) * 100;
  };

  const qualityScore = evidence.length > 0 ? calculateQualityScore() : 0;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="evidence">Evidence URLs (minimum {minRequired})</Label>
        <div className="flex gap-2">
          <Input
            id="evidence"
            type="url"
            placeholder="https://example.com/article"
            value={currentUrl}
            onChange={(e) => setCurrentUrl(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addEvidence();
              }
            }}
          />
          <Button
  type="button"
  size="icon"
  onClick={addEvidence}
  className="h-50 w-50"
  aria-label="Add evidence"
>
  <Plus className="h-5 w-5" />
</Button>
        </div>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        <p className="text-xs text-gray-500">
          Add links to articles, datasets, official statements, or primary sources that support your vote
        </p>
      </div>

      {evidence.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Evidence Added ({evidence.length})</span>
            {evidence.length >= minRequired && (
              <Badge className="bg-green-100 text-green-800">
                Quality Score: {qualityScore.toFixed(0)}%
              </Badge>
            )}
          </div>
          <div className="space-y-2">
            {evidence.map((url) => (
              <Card key={url}>
                <CardContent className="py-2 px-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1 truncate"
                      >
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{getDomain(url)}</span>
                      </a>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0"
                      onClick={() => removeEvidence(url)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {evidence.length < minRequired && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You must provide at least {minRequired} evidence {minRequired === 1 ? 'source' : 'sources'} to vote
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
