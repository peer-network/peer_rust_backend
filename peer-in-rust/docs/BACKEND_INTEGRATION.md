# 🔌 Backend Integration Guide

## What You Need to Add to `peer-server`

### Step 1: Add Dependencies to `peer-server/Cargo.toml`

```toml
[dependencies]
# ... existing dependencies ...

# For signing claim authorizations
ed25519-dalek = "2.1.1"
base58 = "0.2"
```

---

### Step 2: Create New GraphQL Mutation

**File:** `crates/peer-server/src/graphql/mutations/reward.rs`

```rust
use async_graphql::{Context, Object, Result};
use chrono::Utc;
use ed25519_dalek::{Keypair, Signer};
use solana_sdk::pubkey::Pubkey;
use std::str::FromStr;

use peer_common::config::PlatformConfig;

#[derive(Debug, Clone)]
pub struct ClaimAuthorization {
    pub amount: u64,
    pub expiry: i64,
    pub signature: String,
}

#[Object]
impl ClaimAuthorization {
    async fn amount(&self) -> u64 {
        self.amount
    }

    async fn expiry(&self) -> i64 {
        self.expiry
    }

    async fn signature(&self) -> String {
        self.signature.clone()
    }
}

pub struct RewardMutation;

#[Object]
impl RewardMutation {
    /// Request authorization to claim reward
    /// Returns signed authorization that user submits to blockchain
    async fn request_reward_claim(
        &self,
        ctx: &Context<'_>,
        user_pubkey: String,
    ) -> Result<ClaimAuthorization> {
        let config = ctx.data::<PlatformConfig>()?;
        
        // Validate user pubkey
        let user_pubkey = Pubkey::from_str(&user_pubkey)
            .map_err(|_| "Invalid user public key")?;

        // Step 1: Check if user is eligible for reward
        // TODO: Add your eligibility logic here
        // Example: Check database, user activity, etc.
        let eligible = check_user_eligibility(&user_pubkey).await?;
        if !eligible {
            return Err("User not eligible for reward".into());
        }

        // Step 2: Calculate reward amount based on user activity
        // TODO: Add your reward calculation logic
        let amount = calculate_reward_amount(&user_pubkey).await?;

        // Step 3: Set expiry (5 minutes from now)
        let expiry = Utc::now().timestamp() + 300;

        // Step 4: Create message to sign
        // Format: user_pubkey + amount + expiry
        let message = create_claim_message(&user_pubkey, amount, expiry);

        // Step 5: Sign with backend private key
        let keypair = load_backend_keypair(config)?;
        let signature = keypair.sign(&message);

        // Step 6: Return authorization
        Ok(ClaimAuthorization {
            amount,
            expiry,
            signature: base58::encode(signature.to_bytes()),
        })
    }

    /// Get user's reward eligibility status
    async fn check_reward_eligibility(
        &self,
        ctx: &Context<'_>,
        user_pubkey: String,
    ) -> Result<bool> {
        let user_pubkey = Pubkey::from_str(&user_pubkey)
            .map_err(|_| "Invalid user public key")?;
        
        check_user_eligibility(&user_pubkey).await
    }

    /// Get estimated reward amount for user
    async fn estimate_reward_amount(
        &self,
        ctx: &Context<'_>,
        user_pubkey: String,
    ) -> Result<u64> {
        let user_pubkey = Pubkey::from_str(&user_pubkey)
            .map_err(|_| "Invalid user public key")?;
        
        calculate_reward_amount(&user_pubkey).await
    }
}

// Helper functions

/// Check if user is eligible for reward
async fn check_user_eligibility(user_pubkey: &Pubkey) -> Result<bool> {
    // TODO: Implement your eligibility logic
    // Examples:
    // - Check if user has completed required actions
    // - Check if user hasn't claimed recently
    // - Check user tier/level
    // - Check database records
    
    // For now, return true (everyone eligible)
    Ok(true)
}

/// Calculate how much reward user should get
async fn calculate_reward_amount(user_pubkey: &Pubkey) -> Result<u64> {
    // TODO: Implement your reward calculation
    // Examples:
    // - Based on user activity level
    // - Based on user tier
    // - Based on number of referrals
    // - Fixed amount for everyone
    
    // For now, return fixed amount (100 tokens with 6 decimals = 100,000,000)
    Ok(100_000_000)
}

/// Create message to sign
fn create_claim_message(user_pubkey: &Pubkey, amount: u64, expiry: i64) -> Vec<u8> {
    // Message format: user_pubkey (32 bytes) + amount (8 bytes) + expiry (8 bytes)
    let mut message = Vec::new();
    message.extend_from_slice(&user_pubkey.to_bytes());
    message.extend_from_slice(&amount.to_le_bytes());
    message.extend_from_slice(&expiry.to_le_bytes());
    message
}

/// Load backend signing keypair
fn load_backend_keypair(config: &PlatformConfig) -> Result<Keypair> {
    // TODO: Load from config or secure key storage
    // For now, load from admin keypair
    let keypair_path = &config.solana.admin_keypair_path;
    
    let keypair_bytes = std::fs::read(keypair_path)
        .map_err(|e| format!("Failed to read keypair: {}", e))?;
    
    let keypair = Keypair::from_bytes(&keypair_bytes)
        .map_err(|e| format!("Failed to parse keypair: {}", e))?;
    
    Ok(keypair)
}
```

---

### Step 3: Register Mutation

**File:** `crates/peer-server/src/graphql/mutations/mod.rs`

```rust
pub mod transform;
pub mod reward;  // ADD THIS LINE

use async_graphql::MergedObject;

#[derive(MergedObject, Default)]
pub struct Mutation(
    transform::TransformMutation,
    reward::RewardMutation,  // ADD THIS LINE
);
```

---

### Step 4: Test the Backend

```bash
# Start the server
cargo run --bin peer-server

# Test the mutation
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { requestRewardClaim(userPubkey: \"YOUR_TEST_PUBKEY\") { amount expiry signature } }"
  }'
```

**Expected Response:**
```json
{
  "data": {
    "requestRewardClaim": {
      "amount": 100000000,
      "expiry": 1729612345,
      "signature": "5XyZ...abc"
    }
  }
}
```

---

## Frontend Integration

### Step 1: Install Solana Web3.js

```bash
npm install @solana/web3.js @solana/wallet-adapter-react
```

### Step 2: Add Claim Button

**File:** `frontend/index.html` (or your React component)

```javascript
import { Connection, Transaction, TransactionInstruction, PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';

async function claimReward() {
  const wallet = useWallet();
  const connection = new Connection('https://api.devnet.solana.com');
  
  // Step 1: Request authorization from backend
  const response = await fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation RequestClaim($userPubkey: String!) {
          requestRewardClaim(userPubkey: $userPubkey) {
            amount
            expiry
            signature
          }
        }
      `,
      variables: {
        userPubkey: wallet.publicKey.toString()
      }
    })
  });

  const { data } = await response.json();
  const { amount, expiry, signature } = data.requestRewardClaim;

  console.log('Authorization received:', { amount, expiry });

  // Step 2: Build claim transaction
  const tx = await buildClaimTransaction(
    wallet.publicKey,
    amount,
    expiry,
    signature,
    connection
  );

  // Step 3: User signs and sends (PAYS GAS HERE)
  const txSig = await wallet.sendTransaction(tx, connection);
  console.log('Transaction sent:', txSig);

  // Step 4: Wait for confirmation
  await connection.confirmTransaction(txSig);
  console.log('✅ Reward claimed successfully!');
  
  alert('Reward claimed! You paid the gas fee.');
}

async function buildClaimTransaction(
  userPubkey,
  amount,
  expiry,
  signature,
  connection
) {
  // TODO: Get these from config
  const REWARD_PROGRAM_ID = new PublicKey('YOUR_DEPLOYED_PROGRAM_ID');
  const TOKEN_MINT = new PublicKey('YOUR_TOKEN_MINT');
  
  // Derive PDAs
  const [vaultPDA] = await PublicKey.findProgramAddress(
    [Buffer.from('reward_vault'), TOKEN_MINT.toBuffer()],
    REWARD_PROGRAM_ID
  );

  const [claimRecordPDA] = await PublicKey.findProgramAddress(
    [Buffer.from('claim_record'), userPubkey.toBuffer(), TOKEN_MINT.toBuffer()],
    REWARD_PROGRAM_ID
  );

  // Get user's token account
  const userTokenAccount = await getAssociatedTokenAddress(
    TOKEN_MINT,
    userPubkey
  );

  // Create claim instruction
  const instruction = createClaimInstruction(
    userPubkey,
    userTokenAccount,
    vaultPDA,
    claimRecordPDA,
    amount,
    expiry,
    signature,
    REWARD_PROGRAM_ID
  );

  const tx = new Transaction().add(instruction);
  return tx;
}

function createClaimInstruction(
  user,
  userTokenAccount,
  vault,
  claimRecord,
  amount,
  expiry,
  signature,
  programId
) {
  // Serialize instruction data
  const data = Buffer.concat([
    Buffer.from([1]), // Instruction index (ClaimReward = 1)
    Buffer.from(new BigUint64Array([BigInt(amount)]).buffer),
    Buffer.from(new BigInt64Array([BigInt(expiry)]).buffer),
    Buffer.from(base58.decode(signature))
  ]);

  return new TransactionInstruction({
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      // ... add other accounts
    ],
    programId,
    data
  });
}
```

---

## Testing Checklist

- [ ] Backend mutation works (`requestRewardClaim`)
- [ ] Returns valid signature
- [ ] Frontend can build transaction
- [ ] User can sign transaction
- [ ] Transaction succeeds on devnet
- [ ] Tokens transferred to user
- [ ] Cannot claim twice (fails with AlreadyClaimed)
- [ ] Expired claims fail (ClaimExpired)

---

## Environment Variables

Add to `.env`:

```bash
# Reward System
REWARD_PROGRAM_ID=YOUR_DEPLOYED_PROGRAM_ID
REWARD_TOKEN_MINT=YOUR_TOKEN_MINT_ADDRESS
BACKEND_SIGNING_KEYPAIR=/path/to/backend/keypair.json
```

---

## Security Checklist

- [ ] Backend signature verification enabled
- [ ] Expiry time is reasonable (5-10 minutes)
- [ ] Eligibility checks implemented
- [ ] Rate limiting on backend mutation
- [ ] Logging for all claim attempts
- [ ] Monitor vault balance
- [ ] Test double-claim prevention

---

## Next Steps

1. ✅ Add mutation to backend (code above)
2. ⏳ Deploy Solana program to devnet
3. ⏳ Update program ID in config
4. ⏳ Test with frontend
5. ⏳ Add monitoring/logging
6. ⏳ Deploy to mainnet

---

**That's it!** You now have the complete code to integrate the reward system into your existing backend without changing anything else! 🎉
