import { PublicKey, TransactionInstruction } from '@solana/web3.js';

// Configuration
export const PROGRAM_ID = new PublicKey('AeG1sVaUlT11111111111111111111111111111111');
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

function getVaultAddress(authority: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from('vault'), authority.toBuffer()], PROGRAM_ID)[0];
}

// Instruction Builders
export async function createDepositInstruction(
  authority: PublicKey,
  amount: number, // In raw units (atoms)
  mint: PublicKey = DEVNET_USDC_MINT
): Promise<TransactionInstruction> {
  const vault = getVaultAddress(authority);
  const vaultTokenAccount = getAssociatedTokenAddress(mint, vault, true);
  const userTokenAccount = getAssociatedTokenAddress(mint, authority);

  const data = Buffer.concat([
    DISCRIMINATOR_DEPOSIT,
    new BN(amount).toArrayLike(Buffer, 'le', 8),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

export async function createWithdrawInstruction(
  authority: PublicKey,
  amount: number, // In raw units
  mint: PublicKey = DEVNET_USDC_MINT
): Promise<TransactionInstruction> {
  const vault = getVaultAddress(authority);
  const vaultTokenAccount = getAssociatedTokenAddress(mint, vault, true);
  const userTokenAccount = getAssociatedTokenAddress(mint, authority);

  const data = Buffer.concat([
    DISCRIMINATOR_WITHDRAW,
    new BN(amount).toArrayLike(Buffer, 'le', 8),
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data,
  });
}

// Simple BN polyfill for little-endian u64 serialization if BN not available
// (But usually we'd add bn.js. For now, using a helper to avoid deps issue if not present)
class BN {
  constructor(public num: number) {}

  toArrayLike(_type: unknown, _endian: string, length: number): Buffer {
    const buffer = Buffer.alloc(length);
    const bigInt = BigInt(this.num);
    for (let i = 0; i < length; i++) {
      buffer[i] = Number((bigInt >> BigInt(8 * i)) & BigInt(0xff));
    }
    return buffer;
  }
}
