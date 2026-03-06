'use client';

import { useState, useRef } from 'react';
import { CHARTE_CREATORS_BODY } from '@/lib/nftCreator/charte';

interface CreateNftFormProps {
  wallet: string;
  ceilingSol: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function CreateNftForm({ wallet, ceilingSol, onSuccess, onCancel }: CreateNftFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [attributes, setAttributes] = useState('');
  const [charteAccepted, setCharteAccepted] = useState(false);
  const [f1ThemeAccepted, setF1ThemeAccepted] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!charteAccepted || !f1ThemeAccepted) {
      setError('You must accept the charter and confirm the F1 theme.');
      return;
    }
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!imageFile) {
      setError('Please select an image.');
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.set('wallet', wallet);
      formData.set('name', name.trim());
      formData.set('description', description.trim());
      formData.set('attributes', attributes.trim() ? attributes : '{}');
      formData.set('charteAccepted', 'true');
      formData.set('f1ThemeAccepted', 'true');
      formData.set('image', imageFile);
      const res = await fetch('/api/nft-creator/submit', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Submission failed');
        return;
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      <p className="text-sm text-gray-400">
        Eligible from last reclaim: <span className="font-mono text-amber-400">{ceilingSol.toFixed(4)} SOL</span>. You pay only mint cost (rent + fee, ~0.01–0.02 SOL).
      </p>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Image *</label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
          onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-gray-300 file:mr-3 file:py-2 file:px-3 file:rounded file:border-0 file:bg-neon-purple/20 file:text-neon-purple"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Name *</label>
        <input
          type="text"
          maxLength={32}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My F1 NFT"
          className="w-full px-3 py-2 rounded-lg bg-dark-bg border border-dark-border text-white placeholder-gray-500 focus:border-neon-purple focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Description *</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your F1-themed creation..."
          rows={3}
          className="w-full px-3 py-2 rounded-lg bg-dark-bg border border-dark-border text-white placeholder-gray-500 focus:border-neon-purple focus:outline-none resize-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-400 mb-1">Attributes (JSON, optional)</label>
        <textarea
          value={attributes}
          onChange={(e) => setAttributes(e.target.value)}
          placeholder='{"attributes": [{"trait_type": "Team", "value": "F1"}]}'
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-dark-bg border border-dark-border text-white placeholder-gray-500 focus:border-neon-purple focus:outline-none font-mono text-sm resize-none"
        />
      </div>
      <div className="rounded-lg bg-dark-bg border border-dark-border p-3 text-sm text-gray-300 max-h-32 overflow-y-auto">
        {CHARTE_CREATORS_BODY}
      </div>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={charteAccepted}
          onChange={(e) => setCharteAccepted(e.target.checked)}
          className="mt-1 rounded border-gray-500"
        />
        <span className="text-sm">I accept the creator charter.</span>
      </label>
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={f1ThemeAccepted}
          onChange={(e) => setF1ThemeAccepted(e.target.checked)}
          className="mt-1 rounded border-gray-500"
        />
        <span className="text-sm">My NFT is on the F1 theme and complies with the charter.</span>
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <p className="text-xs text-gray-500">
        A human review may take up to 24 hours. No payment is taken until your creation is approved and you finalize.
      </p>
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 py-2.5 px-4 rounded-lg font-medium bg-neon-purple text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? 'Submitting…' : 'Submit for review'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="py-2.5 px-4 rounded-lg font-medium border border-dark-border text-gray-300 hover:bg-dark-bg"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
