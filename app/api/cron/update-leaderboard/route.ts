import { NextResponse } from 'next/server';
import { updateTopUsers, updateTopReferrers, updateTopPosters } from '@/lib/updateLeaderboard';

export async function GET(request: Request) {
  // Sécurité : vérifie que c'est bien Vercel Cron qui appelle
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error('❌ Unauthorized cron attempt');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    console.log('🚀 Cron job started:', new Date().toISOString());
    
    // Met à jour les 3 leaderboards en parallèle
    await Promise.all([
      updateTopUsers(),
      updateTopReferrers(),
      updateTopPosters(),
    ]);
    
    return NextResponse.json({ 
      success: true, 
      updated: new Date().toISOString() 
    });
    
  } catch (error) {
    console.error('❌ Cron job failed:', error);
    return NextResponse.json({ 
      error: 'Update failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
