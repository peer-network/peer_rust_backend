use anchor_lang::prelude::*;
use crate::{
    constants::*,
    errors::PeerTokenError
};

///  Fee breakdown for a transfer
#[derive(Debug, Clone)]
pub struct TransferFeeBreakdown {
    pub original_amount: u64,
    pub burn_amount: u64,
    pub treasury_amount: u64,
    pub lp_amount: u64,
    pub referral_amount: u64,
    pub gas_fee_amount: u64,
    pub recipient_amount: u64,
}

impl TransferFeeBreakdown {
    /// Calculate all fees from transfer amount
    pub fn calculate(amount: u64, fee_config: &FeeParams) -> Result<Self> {

        //  Step 1: Calculate burn fee 
        let burn_amount = Self::calculate_percentage(amount, fee_config.burn_percent)?;
        let after_burn = amount.checked_sub(burn_amount)
            .ok_or(PeerTokenError::ArithmeticUnderflow)?;

        // Step 2: Calculate other fees ( amount after burn)
        let treasury_amount = Self::calculate_percentage(after_burn, fee_config.company_percent)?;
        let lp_amount = Self::calculate_percentage(after_burn, fee_config.lp_percent)?;
        let referral_amount = Self::calculate_percentage(after_burn, fee_config.referral_percent)?;
        
        // Step 3: Gas fee is fixed amount (in tokens, not SOL)
        let gas_fee_amount = std::cmp::min(fee_config.gas_fee_amount, after_burn);
        
        // Step 4: Calculate remaining for recipient
        let total_fees = treasury_amount
            .checked_add(lp_amount)
            .and_then(|sum| sum.checked_add(referral_amount))
            .and_then(|sum| sum.checked_add(gas_fee_amount))
            .ok_or(PeerTokenError::ArithmeticOverflow)?;
            
        let recipient_amount = after_burn.checked_sub(total_fees)
            .ok_or(PeerTokenError::ArithmeticUnderflow)?;

        let breakdown = Self {
            original_amount: amount,
            burn_amount,
            treasury_amount,
            lp_amount,
            referral_amount,
            gas_fee_amount,
            recipient_amount,
        };

        // Verify calculation integrity
        breakdown.verify_integrity()?;
        
        Ok(breakdown)
    }

    /// Calculate percentage of amount
    fn calculate_percentage(amount: u64, basis_points: u16) -> Result<u64> {
        let result = (amount as u128)
            .checked_mul(basis_points as u128)
            .ok_or(PeerTokenError::ArithmeticOverflow)?
            .checked_div(MAX_BASIS_POINTS as u128)
            .ok_or(PeerTokenError::DivisionByZero)?;
            
        if result > u64::MAX as u128 {
            return err!(PeerTokenError::ArithmeticOverflow);
        }
        
        Ok(result as u64)
    }

    /// Verify that all calculations are correct
    fn verify_integrity(&self) -> Result<()> {
        // Verify burn + remaining fees + recipient = original
        let calculated_total = self.burn_amount
            .checked_add(self.treasury_amount)
            .and_then(|sum| sum.checked_add(self.lp_amount))
            .and_then(|sum| sum.checked_add(self.referral_amount))
            .and_then(|sum| sum.checked_add(self.gas_fee_amount))
            .and_then(|sum| sum.checked_add(self.recipient_amount))
            .ok_or(PeerTokenError::ArithmeticOverflow)?;

        require_eq!(
            calculated_total,
            self.original_amount,
            PeerTokenError::InvalidFeeCalculation
        );

        // Verify no negative amounts (already handled by checked_sub)
        require!(self.recipient_amount > 0, PeerTokenError::InvalidTransferAmount);
        
        Ok(())
    }

    /// Check if user has sufficient balance for this transfer
    pub fn validate_sufficient_balance(&self, user_balance: u64) -> Result<()> {
        require!(
            user_balance >= self.original_amount,
            PeerTokenError::InsufficientPeerTokens
        );
        Ok(())
    }
}
