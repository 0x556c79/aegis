import { PublicKey, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import BN from 'bn.js';

// Configuration
// Must match the on-chain program id in packages/contracts/programs/aegis-vault/src/lib.rs
export const PROGRAM_ID = new PublicKey('AEG1SVault111111111111111111111111111111111');
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
export const DEVNET_USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

// Discriminators (pre-calculated sha256("global:<name>")[..8])
const DISCRIMINATOR_DEPOSIT = Buffer.from([0xf2, 0x23, 0xc6, 0x89, 0x52, 0xe1, 0xf2, 0xb6]);
const DISCRIMINATOR_WITHDRAW = Buffer.from([0xb7, 0x12, 0x46, 0x9c, 0x94, 0x6d, 0xa1, 0x22]);

// Utilities
function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey, allowOwnerOffCurve = false): PublicKey {
  if (!allowOwnerOffCurve && !PublicKey.isOnCurve(owner.toBuffer())) {
    throw new Error('Owner is off curve');
  }

  return PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];
}

export function getVaultAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), owner.toBuffer(), mint.toBuffer()],
    PROGRAM_ID
  )[0];
}

export function getStrategyAddress(vault: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('strategy'), vault.toBuffer()],
    PROGRAM_ID
  )[0];
}

export function getVaultTokenAccountAddress(vault: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('vault_token_account'), vault.toBuffer()],
    PROGRAM_ID
  )[0];
}

export function getPositionAddress(vault: PublicKey, user: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('position'), vault.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  )[0];
}

// Instruction Builders

/**
 * Creates a Deposit instruction.
 * 
 * Accounts:
 * 1. vault (mut)
 * 2. strategy
 * 3. vault_token_account (mut)
 * 4. position (mut, init_if_needed)
 * 5. user_token_account (mut)
 * 6. user (signer, mut)
 * 7. token_program
 * 8. system_program
 */
export async function createDepositInstruction(
  owner: PublicKey, // Owner of the vault (usually same as user for self-custody logic)
  user: PublicKey,  // The user depositing
  amount: number | BN, 
  mint: PublicKey = DEVNET_USDC_MINT
): Promise<TransactionInstruction> {
  const vault = getVaultAddress(owner, mint);
  const strategy = getStrategyAddress(vault);
  const vaultTokenAccount = getVaultTokenAccountAddress(vault);
  const position = getPositionAddress(vault, user);
  const userTokenAccount = getAssociatedTokenAddress(mint, user);

  const amountBN = amount instanceof BN ? amount : new BN(amount);
  
  const data = Buffer.concat([
    DISCRIMINATOR_DEPOSIT,
    amountBN.toArrayLike(Buffer, 'le', 8),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: strategy, isSigner: false, isWritable: false },
      { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
      { pubkey: position, isSigner: false, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

/**
 * Creates a Withdraw instruction.
 * 
 * Accounts:
 * 1. vault (mut)
 * 2. strategy
 * 3. agent_authority (pda)
 * 4. vault_token_account (mut)
 * 5. position (mut)
 * 6. user_token_account (mut)
 * 7. user (signer, mut)
 * 8. token_program
 */
export async function createWithdrawInstruction(
  owner: PublicKey, // Owner of the vault
  user: PublicKey,  // The user withdrawing
  amount: number | BN,
  mint: PublicKey = DEVNET_USDC_MINT
): Promise<TransactionInstruction> {
  const vault = getVaultAddress(owner, mint);
  const strategy = getStrategyAddress(vault);
  const agentAuthority = PublicKey.findProgramAddressSync(
    [Buffer.from('agent_authority'), vault.toBuffer()],
    PROGRAM_ID
  )[0];
  const vaultTokenAccount = getVaultTokenAccountAddress(vault);
  const position = getPositionAddress(vault, user);
  const userTokenAccount = getAssociatedTokenAddress(mint, user);

  const amountBN = amount instanceof BN ? amount : new BN(amount);

  const data = Buffer.concat([
    DISCRIMINATOR_WITHDRAW,
    amountBN.toArrayLike(Buffer, 'le', 8),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: strategy, isSigner: false, isWritable: false },
      { pubkey: agentAuthority, isSigner: false, isWritable: false },
      { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
      { pubkey: position, isSigner: false, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}
