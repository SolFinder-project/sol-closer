/**
 * Verify on-chain that a transaction is a SOL transfer to a given address for an exact amount.
 */

import { getConnection } from './connection';

/** Parsed transfer instruction from RPC jsonParsed (varies by RPC). */
interface ParsedTransferInfo {
  source?: string;
  destination?: string;
  lamports?: number;
  amount?: number;
}

interface ParsedInstruction {
  parsed?: { type?: string; info?: ParsedTransferInfo };
  program?: string;
  programId?: string;
}

function checkTransferInInstructions(
  instructions: ParsedInstruction[],
  expectedDestination: string,
  expectedLamports: number
): boolean {
  const destNorm = expectedDestination.trim();
  for (const ix of instructions) {
    const parsed = ix?.parsed;
    if (!parsed || parsed.type !== 'transfer') continue;
    const info = parsed.info as ParsedTransferInfo | undefined;
    if (!info?.destination) continue;
    const amount = info.lamports ?? info.amount;
    if (amount === undefined) continue;
    if (String(info.destination).trim() === destNorm && Number(amount) === expectedLamports) return true;
  }
  return false;
}

/**
 * Verify that the transaction with the given signature is a successful SOL transfer
 * to `expectedDestination` for exactly `expectedLamports`.
 * Returns true only if such a transfer is found and tx succeeded.
 * Checks both top-level instructions and meta.innerInstructions (some RPCs put transfer there).
 */
export async function verifySolTransfer(
  signature: string,
  expectedDestination: string,
  expectedLamports: number
): Promise<boolean> {
  const connection = getConnection();
  const tx = await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
    commitment: 'confirmed',
  });

  if (!tx?.meta || tx.meta.err !== null) return false;

  const transaction = (tx as { transaction?: { message?: { instructions?: ParsedInstruction[] } } }).transaction;
  const message = transaction?.message;
  const topLevel = message?.instructions ?? [];
  if (checkTransferInInstructions(topLevel, expectedDestination, expectedLamports)) return true;

  const inner = (tx.meta as { innerInstructions?: { instructions?: ParsedInstruction[] }[] }).innerInstructions ?? [];
  for (const group of inner) {
    const list = group?.instructions ?? [];
    if (checkTransferInInstructions(list, expectedDestination, expectedLamports)) return true;
  }

  return false;
}
