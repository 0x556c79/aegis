use anchor_lang::prelude::*;

declare_id!("AEG1SVault111111111111111111111111111111111");

/// AEGIS Vault Program (skeleton)
///
/// Purpose (future):
/// - User deposits/withdrawals
/// - Strategy registry & policy constraints
/// - Agent authority PDA to enforce bounds
#[program]
pub mod aegis_vault {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        // TODO: Create vault state and initialize configuration
        Ok(())
    }

    pub fn deposit(_ctx: Context<Deposit>, _amount: u64) -> Result<()> {
        // TODO: Transfer tokens into vault
        Ok(())
    }

    pub fn withdraw(_ctx: Context<Withdraw>, _amount: u64) -> Result<()> {
        // TODO: Withdraw tokens from vault
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
}
