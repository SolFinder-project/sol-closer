import { supabase } from './client';

export interface TransactionData {
  signature: string;
  wallet_address: string;
  accounts_closed: number;
  sol_reclaimed: number;
  fee: number;
  net_received: number;
  referrer_code?: string;
  referral_earned?: number;
  timestamp: number;
}

export async function saveTransaction(data: TransactionData) {
  try {
    // 1. Sauvegarder la transaction
    const { error: txError } = await supabase
      .from('transactions')
      .insert([{
        signature: data.signature,
        wallet_address: data.wallet_address,
        accounts_closed: data.accounts_closed,
        sol_reclaimed: data.sol_reclaimed,
        fee: data.fee,
        net_received: data.net_received,
        referrer_code: data.referrer_code,
        referral_earned: data.referral_earned,
        timestamp: data.timestamp,
      }]);

    if (txError) throw txError;

    // 2. Mettre à jour les stats utilisateur
    await updateUserStats(data);

    // 3. Mettre à jour les stats globales
    await updateGlobalStats(data);

    // 4. Si referral, mettre à jour les stats du parrain
    if (data.referrer_code && data.referral_earned && data.referral_earned > 0) {
      await updateReferrerStats(data.referrer_code, data.referral_earned, data.wallet_address);
    }

    return { success: true };
  } catch (error) {
    console.error('Error saving transaction to Supabase:', error);
    return { success: false, error };
  }
}

async function updateUserStats(data: TransactionData) {
  const { data: existing, error: fetchError } = await supabase
    .from('user_stats')
    .select('*')
    .eq('wallet_address', data.wallet_address)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError;
  }

  if (existing) {
    const { error } = await supabase
      .from('user_stats')
      .update({
        total_accounts_closed: Number(existing.total_accounts_closed) + Number(data.accounts_closed),
        total_sol_reclaimed: Number(existing.total_sol_reclaimed) + Number(data.sol_reclaimed),
        total_fees_paid: Number(existing.total_fees_paid) + Number(data.fee),
        total_net_received: Number(existing.total_net_received) + Number(data.net_received),
        transaction_count: Number(existing.transaction_count) + 1,
        last_transaction_at: data.timestamp,
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_address', data.wallet_address);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('user_stats')
      .insert([{
        wallet_address: data.wallet_address,
        total_accounts_closed: data.accounts_closed,
        total_sol_reclaimed: data.sol_reclaimed,
        total_fees_paid: data.fee,
        total_net_received: data.net_received,
        transaction_count: 1,
        first_transaction_at: data.timestamp,
        last_transaction_at: data.timestamp,
        referral_earnings: 0,
        referral_count: 0,
      }]);

    if (error) throw error;
  }
}

async function updateGlobalStats(data: TransactionData) {
  const { data: stats, error: fetchError } = await supabase
    .from('global_stats')
    .select('*')
    .eq('id', 1)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError;
  }

  if (stats) {
    const { error } = await supabase
      .from('global_stats')
      .update({
        total_accounts_closed: Number(stats.total_accounts_closed) + Number(data.accounts_closed),
        total_sol_reclaimed: Number(stats.total_sol_reclaimed) + Number(data.sol_reclaimed),
        total_transactions: Number(stats.total_transactions) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('global_stats')
      .insert([{
        id: 1,
        total_accounts_closed: data.accounts_closed,
        total_sol_reclaimed: data.sol_reclaimed,
        total_transactions: 1,
        total_users: 1,
      }]);

    if (error) throw error;
  }

  // Update total_users count
  const { count } = await supabase
    .from('user_stats')
    .select('*', { count: 'exact', head: true });

  if (count !== null) {
    await supabase
      .from('global_stats')
      .update({ total_users: count })
      .eq('id', 1);
  }
}

async function updateReferrerStats(referrerWallet: string, amount: number, referredWallet: string) {
  console.log(`📊 Updating referrer stats: ${referrerWallet} earned ${amount} SOL from ${referredWallet}`);
  
  // Le referrer_code est maintenant l'adresse wallet complète
  const { data: referrerStats, error: fetchError } = await supabase
    .from('user_stats')
    .select('*')
    .eq('wallet_address', referrerWallet)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('Error fetching referrer stats:', fetchError);
    return;
  }

  if (referrerStats) {
    const { error } = await supabase
      .from('user_stats')
      .update({
        referral_earnings: Number(referrerStats.referral_earnings || 0) + Number(amount),
        referral_count: Number(referrerStats.referral_count || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_address', referrerWallet);

    if (error) {
      console.error('Error updating referrer stats:', error);
    } else {
      console.log(`✅ Referrer ${referrerWallet.slice(0, 8)} credited with ${amount} SOL`);
    }
  } else {
    // Le parrain n'a pas encore de stats, créer une entrée
    const { error } = await supabase
      .from('user_stats')
      .insert([{
        wallet_address: referrerWallet,
        total_accounts_closed: 0,
        total_sol_reclaimed: 0,
        total_fees_paid: 0,
        total_net_received: 0,
        transaction_count: 0,
        first_transaction_at: Date.now(),
        last_transaction_at: Date.now(),
        referral_earnings: amount,
        referral_count: 1,
      }]);

    if (error) {
      console.error('Error creating referrer stats:', error);
    } else {
      console.log(`✅ Created referrer stats for ${referrerWallet.slice(0, 8)} with ${amount} SOL`);
    }
  }
}

export async function getUserStats(walletAddress: string) {
  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .eq('wallet_address', walletAddress)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching user stats:', error);
    return null;
  }

  return data;
}

export async function getGlobalStats() {
  const { data, error } = await supabase
    .from('global_stats')
    .select('*')
    .eq('id', 1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      const { data: newData, error: insertError } = await supabase
        .from('global_stats')
        .insert([{
          id: 1,
          total_accounts_closed: 0,
          total_sol_reclaimed: 0,
          total_transactions: 0,
          total_users: 0,
        }])
        .select()
        .single();
      
      if (!insertError && newData) {
        return newData;
      }
    }
    
    return {
      total_accounts_closed: 0,
      total_sol_reclaimed: 0,
      total_transactions: 0,
      total_users: 0,
    };
  }

  return data;
}

export async function getLeaderboard(limit = 10) {
  const { data, error } = await supabase
    .from('user_stats')
    .select('*')
    .order('total_sol_reclaimed', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }

  return data;
}

export async function getUserTransactions(walletAddress: string) {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('wallet_address', walletAddress)
    .order('timestamp', { ascending: false });

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }

  return data;
}
