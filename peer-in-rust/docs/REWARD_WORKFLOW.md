# 🚀 Quick Start Guide - Reward Claim System

## 🎯 Complete Workflow (Step by Step)

### Phase 1: Setup (One-time)

#### 1.1 Build the Solana Program
```bash
cd /Users/macbookpro/Solana/peer_rust_backend/peer-in-rust

# Build the on-chain program
cargo build-sbf --manifest-path crates/peer-reward-program/Cargo.toml
```

#### 1.2 Deploy to Devnet
```bash
solana program deploy \
  target/deploy/peer_reward_program.so \
  --url devnet \
  --keypair keys/admin.json
```

**Output**: You'll get a Program ID like: `AbC123...xyz`

#### 1.3 Initialize Reward Vault
```bash
# This creates the PDA (vault) that holds reward tokens
# Run once per token mint
solana program call <PROGRAM_ID> initialize_vault \
  --keypair keys/admin.json \
  --url devnet
```

---

### Phase 2: Company Deposits Rewards

```bash
# Transfer reward tokens to the vault
# Do this whenever you want to add more rewards
cargo run -p peer-token-cli -- deposit-rewards \
  --mint <TOKEN_MINT> \
  --amount 1000000 \
  --url devnet
```

---

### Phase 3: User Claims (The Magic! ✨)

#### 3.1 **User Request** (Frontend → Backend)

**Frontend Code:**
```javascript
// User clicks "Claim Reward"
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
    variables: { userPubkey: wallet.publicKey.toString() }
  })
});

const { data } = await response.json();
console.log('Authorization received:', data.requestRewardClaim);
```

#### 3.2 **Backend Authorizes** (peer-server)

**Backend checks:**
- ✅ Is user eligible?
- ✅ How much reward do they get?
- ✅ Sign authorization message

**Backend returns:**
```json
{
  "amount": 100000000,
  "expiry": 1729612345,
  "signature": "5XyZ...abc"
}
```

#### 3.3 **User Submits Claim** (Frontend → Solana)

**Frontend Code:**
```javascript
// Build claim transaction
import { Transaction, TransactionInstruction } from '@solana/web3.js';

const tx = new Transaction().add(
  createClaimInstruction({
    user: wallet.publicKey,
    userTokenAccount: userATA,
    vault: vaultPDA,
    amount: data.amount,
    expiry: data.expiry,
    signature: data.signature
  })
);

// User signs (THIS IS WHERE USER PAYS GAS)
const txSig = await wallet.sendTransaction(tx, connection);
await connection.confirmTransaction(txSig);

// ✅ Done! User received tokens and paid gas
```

#### 3.4 **On-Chain Verification** (Solana Program)

The smart contract automatically:
1. ✅ Verifies backend signature is valid
2. ✅ Checks expiry hasn't passed
3. ✅ Checks user hasn't already claimed
4. ✅ Transfers tokens from vault to user
5. ✅ Records claim to prevent double-claiming

---

## 📊 Visual Flow

```
USER                 FRONTEND              BACKEND              SOLANA
 │                      │                      │                   │
 │  Click "Claim"       │                      │                   │
 ├──────────────────────→                      │                   │
 │                      │   Request Auth       │                   │
 │                      ├─────────────────────→│                   │
 │                      │                      │                   │
 │                      │   ✅ Check eligible  │                   │
 │                      │   ✅ Calculate amt   │                   │
 │                      │   ✅ Sign message    │                   │
 │                      │                      │                   │
 │                      │   Return signature   │                   │
 │                      ←─────────────────────┤                   │
 │                      │                      │                   │
 │  Sign Transaction    │                      │                   │
 │  (PAY GAS HERE! 💰)  │                      │                   │
 ├──────────────────────→                      │                   │
 │                      │   Submit Transaction │                   │
 │                      ├─────────────────────────────────────────→│
 │                      │                      │                   │
 │                      │                      │   ✅ Verify sig   │
 │                      │                      │   ✅ Check expiry │
 │                      │                      │   ✅ Transfer tkn │
 │                      │                      │                   │
 │  Tokens Received! 🎉 │                      │                   │
 ←────────────────────────────────────────────────────────────────┤
```

---

## 🔑 Key Points

### ✅ User Pays Gas
- Every claim transaction costs ~0.00001 SOL
- User pays this (not company)
- Scales to millions of users

### ✅ Company Controls Access
- Backend signs authorization
- Only authorized users can claim
- Can add any eligibility rules

### ✅ Prevents Cheating
- Can't claim twice
- Can't fake signature
- Can't claim expired rewards

---

## 🧪 Testing the Flow

### Test 1: Full Happy Path
```bash
# 1. Backend signs authorization
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { requestRewardClaim(userPubkey: \"USER123\") { amount expiry signature } }"
  }'

# 2. Frontend submits claim (user pays gas)
# Use the signature from step 1

# 3. Check user's token balance
spl-token balance <TOKEN_MINT> --owner <USER_PUBKEY>
```

### Test 2: Try to Claim Twice (Should Fail)
```bash
# Try claiming again with same user
# Expected: "Error: AlreadyClaimed"
```

### Test 3: Expired Signature (Should Fail)
```bash
# Wait for expiry time to pass
# Try claiming with old signature
# Expected: "Error: ClaimExpired"
```

---

## 📝 Integration Checklist

- [ ] Deploy Solana program to devnet
- [ ] Initialize reward vault
- [ ] Deposit tokens into vault
- [ ] Add `requestRewardClaim` mutation to backend
- [ ] Add claim UI to frontend
- [ ] Test full flow
- [ ] Add monitoring/logging
- [ ] Deploy to mainnet

---

## 🆘 Common Issues

### Issue: "Insufficient funds"
**Solution**: User needs SOL for gas (even if just 0.00001 SOL)

### Issue: "InvalidBackendSignature"
**Solution**: Make sure backend is signing with correct keypair

### Issue: "AlreadyClaimed"
**Solution**: Each user can only claim once. This is by design.

### Issue: "ClaimExpired"
**Solution**: Signatures expire after 5 minutes. Request new one.

---

## 🎓 Understanding the Architecture

### Why PDA (Program Derived Address)?
- Vault is owned by the **program** (not a person)
- Only program can transfer tokens from it
- No one can steal tokens (not even company)
- Company can only withdraw via program instructions

### Why Backend Signature?
- Proves company authorized this specific claim
- Prevents users from claiming without permission
- Allows complex eligibility rules (checked off-chain)

### Why Expiry?
- Prevents replay attacks
- Forces users to claim within reasonable time
- Allows company to revoke authorization

---

## 📚 Further Reading

- [Solana Program Library (SPL)](https://spl.solana.com/)
- [Program Derived Addresses (PDAs)](https://docs.solana.com/developing/programming-model/calling-between-programs#program-derived-addresses)
- [Token-2022 Standard](https://spl.solana.com/token-2022)

---

**Questions?** Check the main README.md for detailed architecture explanation!
