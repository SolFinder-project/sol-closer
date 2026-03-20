import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import type { NftCreatorTier } from '@/types/nftCreator';
import {
  CREATOR_POINTS_BONUS,
  CREATOR_REFERRAL_PERCENT,
  CREATOR_RECLAIM_FEE_PERCENT,
  CREATOR_TIME_BONUS_MS,
  NFT_CREATOR_FINALIZE_DAYS,
} from '@/types/nftCreator';

export const dynamic = 'force-dynamic';
const BUCKET = 'nft-creator';
const VALID_TIERS: NftCreatorTier[] = ['standard', 'silver', 'gold', 'platinum'];

function checkAdmin(request: NextRequest): boolean {
  const secret = request.headers.get('x-admin-secret') ?? request.nextUrl.searchParams.get('adminSecret');
  const expected = process.env.NFT_CREATOR_ADMIN_SECRET || process.env.F1_ADMIN_SECRET;
  return !!expected && secret === expected;
}

type NftAttribute = { trait_type: string; value: string | number | boolean };

function normalizeAttributeValue(value: unknown): string | number | boolean {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (value == null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function parseAttributesArray(input: unknown[]): NftAttribute[] {
  return input
    .filter((item) => item && typeof item === 'object' && 'trait_type' in item && 'value' in item)
    .map((item) => {
      const attr = item as { trait_type?: unknown; value?: unknown };
      return {
        trait_type: String(attr.trait_type ?? '').trim(),
        value: normalizeAttributeValue(attr.value),
      };
    })
    .filter((attr) => attr.trait_type.length > 0);
}

function normalizeAttributes(input: unknown): NftAttribute[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return parseAttributesArray(input);
  }
  if (typeof input === 'object') {
    // Submission form can store { attributes: [{ trait_type, value }] }.
    const nested = (input as { attributes?: unknown }).attributes;
    if (Array.isArray(nested)) {
      return parseAttributesArray(nested);
    }
    return Object.entries(input as Record<string, unknown>).map(([trait_type, value]) => ({
      trait_type,
      value: normalizeAttributeValue(value),
    }));
  }
  return [];
}

function setAttribute(attributes: NftAttribute[], traitType: string, value: string | number | boolean) {
  const normalizedTrait = traitType.trim().toLowerCase();
  const index = attributes.findIndex((attr) => attr.trait_type.trim().toLowerCase() === normalizedTrait);
  if (index >= 0) {
    attributes[index] = { trait_type: traitType, value };
    return;
  }
  attributes.push({ trait_type: traitType, value });
}

function tierLabel(tier: NftCreatorTier): string {
  const labels: Record<NftCreatorTier, string> = {
    standard: 'Standard',
    silver: 'Silver',
    gold: 'Gold',
    platinum: 'Platinum',
  };
  return labels[tier];
}

function tierBenefitsLines(tier: NftCreatorTier): string[] {
  const timeBonusMs = CREATOR_TIME_BONUS_MS[tier];
  const timeBonusText = timeBonusMs > 0 ? `-${(timeBonusMs / 1000).toFixed(1).replace('.0', '')}s` : '0s';
  return [
    `Tier: ${tierLabel(tier)}`,
    `Reclaim fee: ${CREATOR_RECLAIM_FEE_PERCENT[tier]}%`,
    `Referral reward: ${CREATOR_REFERRAL_PERCENT[tier]}%`,
    `F1 race time bonus: ${timeBonusText}`,
    `Points bonus per reclaim: +${CREATOR_POINTS_BONUS[tier]}`,
    'Collector bonus (2+ Creator NFTs): +2 points and -1s race time',
  ];
}

function withTierBenefitsDescription(baseDescription: string, tier: NftCreatorTier): string {
  const marker = '---\nSolPit Utility Benefits';
  const cleanBase = baseDescription.split(marker)[0].trim();
  const lines = tierBenefitsLines(tier);
  return `${cleanBase}\n\n${marker}\n${lines.map((line) => `- ${line}`).join('\n')}`.trim();
}

async function buildAndUploadTierMetadata(
  request: NextRequest,
  submission: {
    id: string;
    name: string | null;
    description: string | null;
    image_uri: string | null;
    attributes: unknown;
  },
  tier: NftCreatorTier
): Promise<{ metadataUri: string }> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Server configuration error');

  const metadataPath = `submissions/${submission.id}/metadata.json`;
  const defaultAttributes = normalizeAttributes(submission.attributes);

  setAttribute(defaultAttributes, 'Tier', tierLabel(tier));
  setAttribute(defaultAttributes, 'Reclaim Fee', `${CREATOR_RECLAIM_FEE_PERCENT[tier]}%`);
  setAttribute(defaultAttributes, 'Referral Bonus', `${CREATOR_REFERRAL_PERCENT[tier]}%`);
  setAttribute(
    defaultAttributes,
    'F1 Time Bonus',
    CREATOR_TIME_BONUS_MS[tier] > 0 ? `-${(CREATOR_TIME_BONUS_MS[tier] / 1000).toFixed(1).replace('.0', '')}s` : '0s'
  );
  setAttribute(defaultAttributes, 'Points Bonus', `+${CREATOR_POINTS_BONUS[tier]}`);
  setAttribute(defaultAttributes, 'Collector Bonus', '+2 points / -1s (2+ Creator NFTs)');
  setAttribute(defaultAttributes, 'Utility', 'SolPit App Benefits');

  const metadataJson = {
    name: String(submission.name || 'SolPit Creator').slice(0, 32),
    description: withTierBenefitsDescription(String(submission.description || 'SolPit Creator NFT'), tier),
    image: submission.image_uri ?? '',
    external_url: process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin,
    attributes: defaultAttributes,
  };

  const { error: uploadMetaError } = await admin.storage.from(BUCKET).upload(metadataPath, JSON.stringify(metadataJson), {
    contentType: 'application/json',
    upsert: true,
  });
  if (uploadMetaError) {
    throw new Error(uploadMetaError.message || 'Failed to upload metadata');
  }

  const { data: metaUrlData } = admin.storage.from(BUCKET).getPublicUrl(metadataPath);
  const metadataUri = metaUrlData?.publicUrl ?? '';
  if (!metadataUri) {
    throw new Error('Failed to resolve metadata URI');
  }
  return { metadataUri };
}

/**
 * POST /api/nft-creator/admin/review
 * Body: { submissionId, action: 'approve' | 'reject', tier?: 'standard'|'silver'|'gold'|'platinum', rejectionReason?: string }
 * Approve: set status=approved, tier, approved_at, expires_at (now + 7 days).
 * Reject: set status=rejected, rejection_reason.
 */
export async function POST(request: NextRequest) {
  if (!checkAdmin(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  let body: { submissionId?: string; action?: string; tier?: string; rejectionReason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { submissionId, action, tier, rejectionReason } = body;
  if (!submissionId || !action) {
    return NextResponse.json({ error: 'submissionId and action are required' }, { status: 400 });
  }

  if (action === 'approve') {
    const tierVal = (tier && VALID_TIERS.includes(tier as NftCreatorTier)) ? (tier as NftCreatorTier) : 'standard';
    const now = new Date();
    const expiresAt = new Date(now.getTime() + NFT_CREATOR_FINALIZE_DAYS * 24 * 60 * 60 * 1000);

    const { data: submission, error: fetchError } = await admin
      .from('nft_creator_submissions')
      .select('id, name, description, image_uri, attributes')
      .eq('id', submissionId)
      .eq('status', 'pending')
      .maybeSingle();

    if (fetchError || !submission) {
      console.error('[nft-creator/admin/review] approve/fetch submission', fetchError);
      return NextResponse.json({ error: 'Submission not found or no longer pending' }, { status: 404 });
    }

    let metadataUri: string;
    try {
      const result = await buildAndUploadTierMetadata(request, submission, tierVal);
      metadataUri = result.metadataUri;
    } catch (error) {
      console.error('[nft-creator/admin/review] approve/metadata', error);
      return NextResponse.json({ error: 'Failed to prepare NFT metadata' }, { status: 500 });
    }

    const { error: updateError } = await admin
      .from('nft_creator_submissions')
      .update({
        status: 'approved',
        tier: tierVal,
        metadata_uri: metadataUri,
        approved_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        rejection_reason: null,
        updated_at: now.toISOString(),
      })
      .eq('id', submissionId)
      .eq('status', 'pending');

    if (updateError) {
      console.error('[nft-creator/admin/review] approve', updateError);
      return NextResponse.json({ error: 'Failed to approve' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, status: 'approved', tier: tierVal });
  }

  if (action === 'reject') {
    const { error: updateError } = await admin
      .from('nft_creator_submissions')
      .update({
        status: 'rejected',
        rejection_reason: rejectionReason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .eq('status', 'pending');

    if (updateError) {
      console.error('[nft-creator/admin/review] reject', updateError);
      return NextResponse.json({ error: 'Failed to reject' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, status: 'rejected' });
  }

  return NextResponse.json({ error: 'action must be approve or reject' }, { status: 400 });
}
