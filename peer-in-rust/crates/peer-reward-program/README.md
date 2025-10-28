# 🎁 Peer Reward Program - Solana On-Chain Reward System

## 📖 Overview

This is a **Solana smart contract (on-chain program)** that implements a **user-pays-gas reward claim system**.

### The Problem It Solves

Companies want to reward users with SPL tokens but **don't want to pay gas fees** for every reward distribution.

### The Solution

1. **Company deposits tokens** into a vault (PDA - Program Derived Address)
2. **Backend verifies eligibility** and signs an authorization message
3. **User claims reward** by submitting a transaction (user pays gas)
4. **Smart contract verifies** the backend signature and releases tokens

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     REWARD CLAIM FLOW                        │
└─────────────────────────────────────────────────────────────┘

1. USER REQUESTS CLAIM
   ┌─────────┐
   │ Frontend│──→ "I want to claim my reward"
   └─────────┘
         │
         ▼
   ┌─────────────────┐
   │ Backend API     │
   │ (peer-server)   │
   └─────────────────┘
         │
         ├─→ Check eligibility (database, rules, etc.)
         ├─→ Calculate reward amount
         └─→ Sign authorization message
             (user_pubkey + amount + expiry + signature)
         │
         ▼
   Returns: { amount, expiry, signature }


2. USER SUBMITS CLAIM TRANSACTION
   ┌─────────┐
   │ Frontend│──→ Build transaction with backend signature
   └─────────┘
         │
         ├─→ User's wallet signs (pays gas fee in SOL)
         └─→ Submit to Solana network
         │
         ▼
   ┌─────────────────────────────────────────┐
   │    SOLANA BLOCKCHAIN                     │
   │  ┌─────────────────────────────────┐   │
   │  │ Peer Reward Program (On-Chain)  │   │
   │  └─────────────────────────────────┘   │
   │            │                             │
   │            ├─→ Verify backend signature  │
   │            ├─→ Check expiry              │
   │            ├─→ Check not already claimed │
   │            ├─→ Transfer tokens to user   │
   │            └─→ Record claim (prevent double-claim)
   │                                          │
   └─────────────────────────────────────────┘
         │
         ▼
   ✅ User receives tokens!
   💰 User paid the gas fee (not company)
```

---

## 🔐 Security Features

1. **Backend Authorization**: Only backend-signed claims are valid
2. **Expiry Timestamp**: Claims expire after a certain time
3. **Double-Claim Prevention**: Each user can only claim once per reward
4. **PDA Vault**: Tokens stored in program-controlled account (not company wallet)
5. **User Pays Gas**: Company doesn't need to fund SOL for every transaction

---

## 📁 File Structure

```
crates/peer-reward-program/
├── Cargo.toml                 # Dependencies
├── src/
│   ├── lib.rs                 # Program entry
│   ├── entrypoint.rs          # Solana program entrypoint
│   ├── instruction.rs         # Program instructions (InitializeVault, ClaimReward, etc.)
│   ├── processor.rs           # Business logic (THE CORE)
│   ├── state.rs              # Data structures (RewardVault, ClaimRecord)
│   └── error.rs              # Error types
```

---

## 🚀 Instructions Supported

### 1. **InitializeVault**
   - **Who calls**: Company (once, during setup)
   - **What it does**: Creates the reward vault (PDA) to store tokens
   - **Who pays gas**: Company

### 2. **ClaimReward** ⭐ (MAIN FEATURE)
   - **Who calls**: User (every time they claim)
   - **What it does**: Transfers tokens from vault to user
   - **Who pays gas**: **USER** (this is the key feature!)
   - **Requires**: Backend signature authorizing the claim

### 3. **DepositRewards**
   - **Who calls**: Company (when adding tokens to vault)
   - **What it does**: Transfers tokens from company wallet to vault
   - **Who pays gas**: Company

### 4. **WithdrawRewards**
   - **Who calls**: Company (emergency only)
   - **What it does**: Removes tokens from vault
   - **Who pays gas**: Company

---

## 🔧 How to Build & Deploy

### 1. Build the program

```bash
cargo build-bpf --manifest-path crates/peer-reward-program/Cargo.toml
```

### 2. Deploy to Solana

```bash
solana program deploy \
  target/deploy/peer_reward_program.so \
  --url devnet
```

This will return a **Program ID** (e.g., `AbC123...xyz`)

### 3. Update Program ID

Edit `crates/peer-reward-program/src/lib.rs`:

```rust
solana_program::declare_id!("YOUR_DEPLOYED_PROGRAM_ID_HERE");
```

---

## 💻 Integration with Your Backend

### Backend Flow (peer-server)

Add a new GraphQL mutation:

```rust
// In peer-server/src/graphql/mutations/

async fn request_reward_claim(
    ctx: &Context<'_>,
    user_pubkey: String,
) -> Result<ClaimAuthorization> {
    // 1. Check if user is eligible
    let eligible = check_user_eligibility(&user_pubkey).await?;
    if !eligible {
        return Err("User not eligible for reward".into());
    }

    // 2. Calculate reward amount
    let amount = calculate_reward_amount(&user_pubkey).await?;

    // 3. Set expiry (e.g., 5 minutes from now)
    let expiry = Utc::now().timestamp() + 300;

    // 4. Create message to sign
    let message = format!("{}{}{}", user_pubkey, amount, expiry);

    // 5. Sign with backend private key
    let signature = sign_message(&message, &backend_keypair);

    // 6. Return authorization
    Ok(ClaimAuthorization {
        amount,
        expiry,
        signature: base58::encode(signature),
    })
}
```

### Frontend Flow (JavaScript)

```javascript
// 1. Request claim authorization from backend
const { amount, expiry, signature } = await fetch(
  'http://localhost:4000/graphql',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation {
          requestRewardClaim(userPubkey: "${userWallet.publicKey}") {
            amount
            expiry
            signature
          }
        }
      `
    })
  }
).then(r => r.json());

// 2. Build Solana transaction
const tx = new Transaction().add(
  // ClaimReward instruction
  new TransactionInstruction({
    keys: [
      { pubkey: userWallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: vaultPDA, isSigner: false, isWritable: true },
      // ... other accounts
    ],
    programId: REWARD_PROGRAM_ID,
    data: serializeClaimInstruction(amount, expiry, signature)
  })
);

// 3. User signs and sends (PAYS GAS)
const txSignature = await userWallet.sendTransaction(tx, connection);
await connection.confirmTransaction(txSignature);

console.log('Reward claimed! User paid gas fee.');
```

---

## ✅ Benefits of This Approach

| Feature | Benefit |
|---------|---------|
| **User pays gas** | Company doesn't need SOL for every reward |
| **Backend control** | Company still authorizes who gets rewards |
| **Scalable** | Can handle millions of claims |
| **Secure** | Signature verification + double-claim prevention |
| **Transparent** | All claims recorded on-chain |
| **Standard pattern** | Same as Solana airdrops, staking rewards, etc. |

---

## 🎯 Next Steps

1. ✅ Smart contract created
2. ⏳ Build and deploy to devnet
3. ⏳ Add backend mutation to sign claim authorizations
4. ⏳ Add frontend UI to request and submit claims
5. ⏳ Test the full flow
6. ⏳ Deploy to mainnet

---

## 📝 Notes

- **TODO**: Implement ed25519 signature verification in `processor.rs`
- **TODO**: Add deposit/withdraw implementations
- **TODO**: Add comprehensive tests
- **TODO**: Add rate limiting in backend
- **TODO**: Add claim history tracking

---

## 🤝 Comparison with Other Approaches

### Approach 1: Backend Pays Gas (Simple but Expensive)
- ❌ Company pays SOL for every reward
- ❌ Doesn't scale
- ✅ Simple to implement

### Approach 2: This Program (User Pays Gas)
- ✅ Company doesn't pay gas
- ✅ Highly scalable
- ✅ Industry standard
- ⚠️ Requires Rust smart contract

### Approach 3: Multi-Sig Treasury
- ✅ Very secure
- ❌ Slow execution
- ❌ Complex setup
- 💡 Good for large fund releases, not micro-rewards

---

**Your implementation uses Approach 2** - the same pattern used by:
- Solana airdrops
- Staking reward claims
- Referral program rewards
- NFT minting (user pays gas, program controls logic)

This is **the best practice** for your use case! 🚀
