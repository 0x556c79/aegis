/* eslint-disable no-console */

const anchor = require('@coral-xyz/anchor');
const { Keypair, PublicKey, SystemProgram } = require('@solana/web3.js');
const {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} = require('@solana/spl-token');
const { expect } = require('chai');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

describe('aegis-vault', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.AegisVault;

  const owner = provider.wallet;

  it('initialize -> deposit -> withdraw', async () => {
    // Create a mint controlled by owner
    const mint = await createMint(provider.connection, owner.payer, owner.publicKey, null, 6);

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), owner.publicKey.toBuffer(), mint.toBuffer()],
      program.programId,
    );

    const [strategyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('strategy'), vaultPda.toBuffer()],
      program.programId,
    );

    const [agentAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent_authority'), vaultPda.toBuffer()],
      program.programId,
    );

    const [vaultTokenAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault_token_account'), vaultPda.toBuffer()],
      program.programId,
    );

    // Initialize vault
    await program.methods
      .initialize(50, [mint]) // 0.50% max slippage, allow deposit mint
      .accounts({
        vault: vaultPda,
        strategy: strategyPda,
        agentAuthority: agentAuthorityPda,
        vaultTokenAccount: vaultTokenAccountPda,
        depositMint: mint,
        owner: owner.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    // Create user ATA + mint funds
    const userTokenAccount = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      owner.payer,
      mint,
      owner.publicKey,
    );

    await mintTo(
      provider.connection,
      owner.payer,
      mint,
      userTokenAccount.address,
      owner.publicKey,
      1_000_000, // 1 token with 6 decimals
    );

    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('position'), vaultPda.toBuffer(), owner.publicKey.toBuffer()],
      program.programId,
    );

    // Deposit
    await program.methods
      .deposit(new anchor.BN(400_000))
      .accounts({
        vault: vaultPda,
        strategy: strategyPda,
        vaultTokenAccount: vaultTokenAccountPda,
        position: positionPda,
        userTokenAccount: userTokenAccount.address,
        user: owner.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const pos1 = await program.account.position.fetch(positionPda);
    expect(pos1.amount.toNumber()).to.eq(400_000);

    // Withdraw
    await program.methods
      .withdraw(new anchor.BN(150_000))
      .accounts({
        vault: vaultPda,
        strategy: strategyPda,
        agentAuthority: agentAuthorityPda,
        vaultTokenAccount: vaultTokenAccountPda,
        position: positionPda,
        userTokenAccount: userTokenAccount.address,
        user: owner.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .rpc();

    const pos2 = await program.account.position.fetch(positionPda);
    expect(pos2.amount.toNumber()).to.eq(250_000);
  });

  it('agent whitelist + agent_transfer respects authority + allowed mint', async () => {
    const mint = await createMint(provider.connection, owner.payer, owner.publicKey, null, 6);

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), owner.publicKey.toBuffer(), mint.toBuffer()],
      program.programId,
    );
    const [strategyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('strategy'), vaultPda.toBuffer()],
      program.programId,
    );
    const [agentAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('agent_authority'), vaultPda.toBuffer()],
      program.programId,
    );
    const [vaultTokenAccountPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault_token_account'), vaultPda.toBuffer()],
      program.programId,
    );

    await program.methods
      .initialize(100, [mint])
      .accounts({
        vault: vaultPda,
        strategy: strategyPda,
        agentAuthority: agentAuthorityPda,
        vaultTokenAccount: vaultTokenAccountPda,
        depositMint: mint,
        owner: owner.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();

    // Fund the vault via owner deposit
    const ownerAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      owner.payer,
      mint,
      owner.publicKey,
    );
    await mintTo(
      provider.connection,
      owner.payer,
      mint,
      ownerAta.address,
      owner.publicKey,
      500_000,
    );

    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('position'), vaultPda.toBuffer(), owner.publicKey.toBuffer()],
      program.programId,
    );

    await program.methods
      .deposit(new anchor.BN(500_000))
      .accounts({
        vault: vaultPda,
        strategy: strategyPda,
        vaultTokenAccount: vaultTokenAccountPda,
        position: positionPda,
        userTokenAccount: ownerAta.address,
        user: owner.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Create agent
    const agent = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(agent.publicKey, 2e9);
    await provider.connection.confirmTransaction(sig, 'confirmed');
    await sleep(500);

    // Owner whitelists agent
    await program.methods
      .addAgent(agent.publicKey)
      .accounts({ vault: vaultPda, owner: owner.publicKey })
      .rpc();

    const destinationAta = await getOrCreateAssociatedTokenAccount(
      provider.connection,
      owner.payer,
      mint,
      agent.publicKey,
    );

    // Agent transfers from vault to their ATA
    await program.methods
      .agentTransfer(new anchor.BN(123_000))
      .accounts({
        vault: vaultPda,
        strategy: strategyPda,
        agentAuthority: agentAuthorityPda,
        vaultTokenAccount: vaultTokenAccountPda,
        destination: destinationAta.address,
        agent: agent.publicKey,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .signers([agent])
      .rpc();

    const destAcc = await getAccount(provider.connection, destinationAta.address);
    expect(Number(destAcc.amount)).to.eq(123_000);
  });
});
