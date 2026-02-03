use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("AEG1SVault111111111111111111111111111111111");

pub const MAX_ALLOWED_MINTS: usize = 8;
pub const MAX_AGENTS: usize = 8;

#[program]
pub mod aegis_vault {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        max_slippage_bps: u16,
        allowed_mints: Vec<Pubkey>,
    ) -> Result<()> {
        require!(allowed_mints.len() <= MAX_ALLOWED_MINTS, VaultError::TooManyAllowedMints);

        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.owner.key();
        vault.deposit_mint = ctx.accounts.deposit_mint.key();
        vault.vault_token_account = ctx.accounts.vault_token_account.key();
        vault.agent_authority = ctx.accounts.agent_authority.key();
        vault.vault_bump = ctx.bumps.vault;
        vault.vault_token_bump = ctx.bumps.vault_token_account;
        vault.agent_authority_bump = ctx.bumps.agent_authority;
        vault.total_deposits = 0;
        vault.agent_count = 0;
        vault.agents = [Pubkey::default(); MAX_AGENTS];

        let strategy = &mut ctx.accounts.strategy;
        strategy.vault = vault.key();
        strategy.max_slippage_bps = max_slippage_bps;
        strategy.is_active = true;
        strategy.allowed_mint_count = allowed_mints.len() as u8;
        strategy.allowed_mints = [Pubkey::default(); MAX_ALLOWED_MINTS];
        for (i, pk) in allowed_mints.iter().enumerate() {
            strategy.allowed_mints[i] = *pk;
        }

        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::InvalidAmount);
        require_keys_eq!(ctx.accounts.user_token_account.mint, ctx.accounts.vault.deposit_mint);

        // Enforce strategy: only allow deposits for allowed mints list if configured.
        let strategy = &ctx.accounts.strategy;
        require!(strategy.is_active, VaultError::StrategyInactive);
        require!(
            strategy.is_mint_allowed(&ctx.accounts.vault.deposit_mint),
            VaultError::MintNotAllowed
        );

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;

        let vault = &mut ctx.accounts.vault;
        let position = &mut ctx.accounts.position;
        position.vault = vault.key();
        position.user = ctx.accounts.user.key();
        position.amount = position
            .amount
            .checked_add(amount)
            .ok_or(VaultError::MathOverflow)?;

        vault.total_deposits = vault
            .total_deposits
            .checked_add(amount)
            .ok_or(VaultError::MathOverflow)?;

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::InvalidAmount);

        let vault = &mut ctx.accounts.vault;
        let position = &mut ctx.accounts.position;

        require_keys_eq!(position.user, ctx.accounts.user.key());
        require!(position.amount >= amount, VaultError::InsufficientPosition);

        // sign as the agent_authority PDA, which is the token authority for the vault token account
        let signer_seeds: &[&[u8]] = &[
            b"agent_authority",
            vault.key().as_ref(),
            &[vault.agent_authority_bump],
        ];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: ctx.accounts.agent_authority.to_account_info(),
                },
                &[signer_seeds],
            ),
            amount,
        )?;

        position.amount = position.amount - amount;
        vault.total_deposits = vault.total_deposits - amount;

        Ok(())
    }

    pub fn update_strategy(
        ctx: Context<UpdateStrategy>,
        max_slippage_bps: u16,
        allowed_mints: Vec<Pubkey>,
        is_active: bool,
    ) -> Result<()> {
        require!(allowed_mints.len() <= MAX_ALLOWED_MINTS, VaultError::TooManyAllowedMints);

        let strategy = &mut ctx.accounts.strategy;
        strategy.max_slippage_bps = max_slippage_bps;
        strategy.is_active = is_active;
        strategy.allowed_mint_count = allowed_mints.len() as u8;
        strategy.allowed_mints = [Pubkey::default(); MAX_ALLOWED_MINTS];
        for (i, pk) in allowed_mints.iter().enumerate() {
            strategy.allowed_mints[i] = *pk;
        }
        Ok(())
    }

    pub fn add_agent(ctx: Context<AddAgent>, agent: Pubkey) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        require!(vault.agent_count < MAX_AGENTS as u8, VaultError::TooManyAgents);
        require!(!vault.is_agent(&agent), VaultError::AgentAlreadyExists);
        vault.agents[vault.agent_count as usize] = agent;
        vault.agent_count += 1;
        Ok(())
    }

    /// Allows a whitelisted agent to move funds from the vault token account.
    ///
    /// This is the core "AgentAuthority" mechanic: the *program* signs as a PDA,
    /// and the agent is only an authenticated caller bound by the vault's strategy.
    pub fn agent_transfer(ctx: Context<AgentTransfer>, amount: u64) -> Result<()> {
        require!(amount > 0, VaultError::InvalidAmount);

        let vault = &ctx.accounts.vault;
        require!(vault.is_agent(&ctx.accounts.agent.key()), VaultError::UnauthorizedAgent);

        let strategy = &ctx.accounts.strategy;
        require!(strategy.is_active, VaultError::StrategyInactive);
        // Destination mint must be allowed by strategy (simple policy hook).
        require!(strategy.is_mint_allowed(&ctx.accounts.destination.mint), VaultError::MintNotAllowed);

        let signer_seeds: &[&[u8]] = &[
            b"agent_authority",
            vault.key().as_ref(),
            &[vault.agent_authority_bump],
        ];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: ctx.accounts.agent_authority.to_account_info(),
                },
                &[signer_seeds],
            ),
            amount,
        )?;

        Ok(())
    }
}

// -----------------------------
// Accounts
// -----------------------------

#[derive(Accounts)]
#[instruction(max_slippage_bps: u16, allowed_mints: Vec<Pubkey>)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + Vault::LEN,
        seeds = [b"vault", owner.key().as_ref(), deposit_mint.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init,
        payer = owner,
        space = 8 + Strategy::LEN,
        seeds = [b"strategy", vault.key().as_ref()],
        bump
    )]
    pub strategy: Account<'info, Strategy>,

    /// PDA used as SPL token authority for the vault token account.
    /// CHECK: PDA derivation enforced via seeds.
    #[account(
        seeds = [b"agent_authority", vault.key().as_ref()],
        bump
    )]
    pub agent_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = owner,
        seeds = [b"vault_token_account", vault.key().as_ref()],
        bump,
        token::mint = deposit_mint,
        token::authority = agent_authority,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    pub deposit_mint: Account<'info, Mint>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.owner.as_ref(), vault.deposit_mint.as_ref()],
        bump = vault.vault_bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        seeds = [b"strategy", vault.key().as_ref()],
        bump,
        constraint = strategy.vault == vault.key() @ VaultError::InvalidStrategyVault
    )]
    pub strategy: Account<'info, Strategy>,

    #[account(
        mut,
        seeds = [b"vault_token_account", vault.key().as_ref()],
        bump = vault.vault_token_bump,
        constraint = vault_token_account.key() == vault.vault_token_account @ VaultError::InvalidVaultTokenAccount
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Position::LEN,
        seeds = [b"position", vault.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub position: Account<'info, Position>,

    #[account(mut, constraint = user_token_account.owner == user.key() @ VaultError::InvalidOwner)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.owner.as_ref(), vault.deposit_mint.as_ref()],
        bump = vault.vault_bump
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        seeds = [b"strategy", vault.key().as_ref()],
        bump,
        constraint = strategy.vault == vault.key() @ VaultError::InvalidStrategyVault
    )]
    pub strategy: Account<'info, Strategy>,

    /// CHECK: PDA derivation enforced.
    #[account(
        seeds = [b"agent_authority", vault.key().as_ref()],
        bump = vault.agent_authority_bump,
        constraint = agent_authority.key() == vault.agent_authority @ VaultError::InvalidAgentAuthority
    )]
    pub agent_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"vault_token_account", vault.key().as_ref()],
        bump = vault.vault_token_bump,
        constraint = vault_token_account.key() == vault.vault_token_account @ VaultError::InvalidVaultTokenAccount
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"position", vault.key().as_ref(), user.key().as_ref()],
        bump,
        constraint = position.vault == vault.key() @ VaultError::InvalidPositionVault
    )]
    pub position: Account<'info, Position>,

    #[account(mut, constraint = user_token_account.owner == user.key() @ VaultError::InvalidOwner)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateStrategy<'info> {
    #[account(mut, constraint = owner.key() == vault.owner @ VaultError::Unauthorized)]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [b"strategy", vault.key().as_ref()],
        bump,
        constraint = strategy.vault == vault.key() @ VaultError::InvalidStrategyVault
    )]
    pub strategy: Account<'info, Strategy>,

    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct AddAgent<'info> {
    #[account(mut, constraint = owner.key() == vault.owner @ VaultError::Unauthorized)]
    pub vault: Account<'info, Vault>,
    pub owner: Signer<'info>,
}

#[derive(Accounts)]
pub struct AgentTransfer<'info> {
    #[account(seeds = [b"vault", vault.owner.as_ref(), vault.deposit_mint.as_ref()], bump = vault.vault_bump)]
    pub vault: Account<'info, Vault>,

    #[account(
        seeds = [b"strategy", vault.key().as_ref()],
        bump,
        constraint = strategy.vault == vault.key() @ VaultError::InvalidStrategyVault
    )]
    pub strategy: Account<'info, Strategy>,

    /// CHECK: PDA derivation enforced.
    #[account(
        seeds = [b"agent_authority", vault.key().as_ref()],
        bump = vault.agent_authority_bump,
        constraint = agent_authority.key() == vault.agent_authority @ VaultError::InvalidAgentAuthority
    )]
    pub agent_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        seeds = [b"vault_token_account", vault.key().as_ref()],
        bump = vault.vault_token_bump,
        constraint = vault_token_account.key() == vault.vault_token_account @ VaultError::InvalidVaultTokenAccount
    )]
    pub vault_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub destination: Account<'info, TokenAccount>,

    pub agent: Signer<'info>,

    pub token_program: Program<'info, Token>,
}

// -----------------------------
// State
// -----------------------------

#[account]
pub struct Vault {
    pub owner: Pubkey,
    pub deposit_mint: Pubkey,
    pub vault_token_account: Pubkey,
    pub agent_authority: Pubkey,

    pub total_deposits: u64,

    pub vault_bump: u8,
    pub vault_token_bump: u8,
    pub agent_authority_bump: u8,

    pub agent_count: u8,
    pub agents: [Pubkey; MAX_AGENTS],
}

impl Vault {
    pub const LEN: usize =
        32 + 32 + 32 + 32 + // keys
        8 + // total
        1 + 1 + 1 + // bumps
        1 + // agent_count
        (32 * MAX_AGENTS);

    pub fn is_agent(&self, agent: &Pubkey) -> bool {
        self.agents
            .iter()
            .take(self.agent_count as usize)
            .any(|a| a == agent)
    }
}

#[account]
pub struct Position {
    pub vault: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
}

impl Position {
    pub const LEN: usize = 32 + 32 + 8;
}

#[account]
pub struct Strategy {
    pub vault: Pubkey,
    pub max_slippage_bps: u16,
    pub is_active: bool,

    pub allowed_mint_count: u8,
    pub allowed_mints: [Pubkey; MAX_ALLOWED_MINTS],
}

impl Strategy {
    pub const LEN: usize = 32 + 2 + 1 + 1 + (32 * MAX_ALLOWED_MINTS);

    pub fn is_mint_allowed(&self, mint: &Pubkey) -> bool {
        // If list empty => deny by default (safer)
        if self.allowed_mint_count == 0 {
            return false;
        }
        self.allowed_mints
            .iter()
            .take(self.allowed_mint_count as usize)
            .any(|m| m == mint)
    }
}

// -----------------------------
// Errors
// -----------------------------

#[error_code]
pub enum VaultError {
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Invalid owner")]
    InvalidOwner,
    #[msg("Insufficient position balance")]
    InsufficientPosition,
    #[msg("Strategy is inactive")]
    StrategyInactive,
    #[msg("Mint is not allowed by strategy")]
    MintNotAllowed,
    #[msg("Too many allowed mints")]
    TooManyAllowedMints,
    #[msg("Too many agents")]
    TooManyAgents,
    #[msg("Agent already exists")]
    AgentAlreadyExists,
    #[msg("Unauthorized agent")]
    UnauthorizedAgent,
    #[msg("Strategy account does not match vault")]
    InvalidStrategyVault,
    #[msg("Position account does not match vault")]
    InvalidPositionVault,
    #[msg("Vault token account mismatch")]
    InvalidVaultTokenAccount,
    #[msg("Agent authority mismatch")]
    InvalidAgentAuthority,
}
