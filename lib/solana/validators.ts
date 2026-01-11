import { PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';

/**
 * Validates if a string is a valid Solana address (base58)
 */
export function isValidSolanaAddress(address: string): boolean {
  try {
    // Remove whitespace and newlines
    const cleaned = address.trim();
    
    // Check length (Solana addresses are typically 32-44 chars)
    if (cleaned.length < 32 || cleaned.length > 44) {
      return false;
    }
    
    // Check if it's valid base58
    bs58.decode(cleaned);
    
    // Try to create PublicKey
    new PublicKey(cleaned);
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely creates a PublicKey from a string
 * Returns null if invalid
 */
export function safePublicKey(address: string | null | undefined): PublicKey | null {
  if (!address) return null;
  
  try {
    const cleaned = address.trim();
    if (!isValidSolanaAddress(cleaned)) {
      console.error('Invalid Solana address:', cleaned.slice(0, 10) + '...');
      return null;
    }
    return new PublicKey(cleaned);
  } catch (error) {
    console.error('Failed to create PublicKey:', error);
    return null;
  }
}

/**
 * Clean and validate environment variable
 */
export function cleanEnvAddress(envVar: string | undefined): string {
  if (!envVar) {
    throw new Error('Environment variable is not defined');
  }
  
  // Remove all whitespace, newlines, tabs
  const cleaned = envVar.replace(/\s+/g, '').trim();
  
  if (!isValidSolanaAddress(cleaned)) {
    throw new Error(`Invalid Solana address in environment variable: ${cleaned.slice(0, 10)}...`);
  }
  
  return cleaned;
}
