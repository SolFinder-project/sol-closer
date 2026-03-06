import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const BUCKET = 'nft-creator';

/**
 * POST /api/nft-creator/submit
 * Body: FormData with image (file), name, description, attributes (JSON string), charteAccepted, f1ThemeAccepted, wallet.
 * Stores image + metadata, inserts submission as pending. No payment.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const wallet = formData.get('wallet') as string | null;
    const name = formData.get('name') as string | null;
    const description = formData.get('description') as string | null;
    const attributesStr = formData.get('attributes') as string | null;
    const charteAccepted = formData.get('charteAccepted');
    const f1ThemeAccepted = formData.get('f1ThemeAccepted');
    const imageFile = formData.get('image') as File | null;

    if (!wallet || typeof wallet !== 'string' || wallet.length < 32) {
      return NextResponse.json({ error: 'Missing or invalid wallet' }, { status: 400 });
    }
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!description || typeof description !== 'string') {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    }
    if (charteAccepted !== 'true' && charteAccepted !== true) {
      return NextResponse.json({ error: 'You must accept the creator charter' }, { status: 400 });
    }
    if (f1ThemeAccepted !== 'true' && f1ThemeAccepted !== true) {
      return NextResponse.json({ error: 'You must confirm your NFT is on the F1 theme and complies with the charter' }, { status: 400 });
    }
    if (!imageFile || !(imageFile instanceof Blob) || imageFile.size === 0) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
    }

    let attributes: Record<string, unknown> = {};
    if (attributesStr && typeof attributesStr === 'string') {
      try {
        attributes = JSON.parse(attributesStr) as Record<string, unknown>;
      } catch {
        // optional
      }
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error (storage)' }, { status: 500 });
    }

    // 1) Insert row with placeholder URIs to get id
    const { data: insertData, error: insertError } = await admin
      .from('nft_creator_submissions')
      .insert({
        wallet_address: wallet,
        image_uri: '',
        metadata_uri: null,
        name: name.trim(),
        description: description.trim(),
        attributes: Object.keys(attributes).length ? attributes : null,
        status: 'pending',
      })
      .select('id')
      .single();

    if (insertError || !insertData) {
      console.error('[nft-creator/submit] insert', insertError);
      return NextResponse.json({ error: 'Failed to create submission' }, { status: 500 });
    }

    const id = (insertData as { id: string }).id;
    const ext = imageFile.name?.split('.').pop()?.toLowerCase() || 'png';
    const safeExt = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) ? ext : 'png';
    const imagePath = `submissions/${id}/image.${safeExt}`;
    const metadataPath = `submissions/${id}/metadata.json`;

    // 2) Upload image
    const imageBytes = await imageFile.arrayBuffer();
    const { error: uploadImageError } = await admin.storage
      .from(BUCKET)
      .upload(imagePath, imageBytes, {
        contentType: imageFile.type || `image/${safeExt}`,
        upsert: true,
      });

    if (uploadImageError) {
      console.error('[nft-creator/submit] image upload', uploadImageError);
      await admin.from('nft_creator_submissions').delete().eq('id', id);
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    const { data: imageUrlData } = admin.storage.from(BUCKET).getPublicUrl(imagePath);
    const imageUri = imageUrlData?.publicUrl ?? '';

    // 3) Build and upload metadata JSON (Metaplex format)
    const metadataJson = {
      name: name.trim(),
      description: description.trim(),
      image: imageUri,
      attributes: Array.isArray((attributes as { attributes?: unknown[] }).attributes)
        ? (attributes as { attributes: unknown[] }).attributes
        : Object.entries(attributes).map(([trait_type, value]) => ({ trait_type, value })),
    };
    const { error: uploadMetaError } = await admin.storage
      .from(BUCKET)
      .upload(metadataPath, JSON.stringify(metadataJson), {
        contentType: 'application/json',
        upsert: true,
      });

    if (uploadMetaError) {
      console.error('[nft-creator/submit] metadata upload', uploadMetaError);
      await admin.from('nft_creator_submissions').delete().eq('id', id);
      return NextResponse.json({ error: 'Failed to upload metadata' }, { status: 500 });
    }

    const { data: metaUrlData } = admin.storage.from(BUCKET).getPublicUrl(metadataPath);
    const metadataUri = metaUrlData?.publicUrl ?? '';

    // 4) Update row with URIs
    const { error: updateError } = await admin
      .from('nft_creator_submissions')
      .update({
        image_uri: imageUri,
        metadata_uri: metadataUri,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('[nft-creator/submit] update URIs', updateError);
    }

    return NextResponse.json({
      id,
      status: 'pending',
      message: 'Your creation has been submitted. A human review may take up to 24 hours.',
    });
  } catch (error) {
    console.error('[nft-creator/submit]', error);
    return NextResponse.json({ error: 'Submission failed' }, { status: 500 });
  }
}
