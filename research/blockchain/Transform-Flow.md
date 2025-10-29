*Transform Peer Tokens Workflow (web2 \-\> web3)*   

The PEER platform implements a seamless Web2-to-Web3 transition model 

where users earn tokens through interactions,  Earn Gems Convert to Peer tokens by daily Minting which all these happens in Backend and no Actual Peer tokens 

Now when users want to Transform ( Dummy Peer tokens to Real Blockchain asset as Spl tokens on top of Solana ) . 

This hybrid approach maximizes user adoption while preserving the benefits of decentralized token ownership.

Basically we are converting Dummy Backend Peer tokens to Real spl Peer tokens 

**Step 1\) User onboarding** 

Users join the PEER platform using traditional signup methods without any cryptocurrency requirements:

* No Wallet Required: Users register with email )  
* Instant Participation: Immediate Interactions Free posts , likes , comments   
* Virtual Token Display: In-app balance shows earned PEER tokens like Gems( Based on the Interactions )   
* Zero Crypto Knowledge Needed: Complete abstraction of blockchain complexity

**Backend** 

All token-related calculations occur off-chain for optimal performance:

* PHP Backend Processing: Handles user interactions, gem calculations, and token distributions  
* Daily Token Allocation: 5,000 PEER tokens minted (Virtual)  and distributed daily based on user engagement  
* User balances maintained in DB   
* Posts, comments, and likes automatically generate gem rewards converted to PEER tokens everyday 

**STEP 2\) CASHOUT INITIATION PROCESS** 

When users decide to convert their virtual PEER tokens into real blockchain assets they can use elsewhere:

User will go to **Wallet page** 

There will be **Transform** in wallet \>\> **transform**

When user clicks on **Transform** Button 

**Case 1 : When user have Solana Wallet** 

    Solana Wallet Input

* User enters their Solana wallet public key as the destination address  
* System validates the address format to ensure compatibility

**Case 2 : When user Dont have Solana wallet** 

If the user doesn't have a Solana wallet, the platform Should provide clear instructions:

* Phantom Wallet: Guide to install Chrome extension and create wallet  
* Solflare Alternative: Secondary option with setup instructions  
* Public Key Extraction: Step-by-step process to copy wallet address


Once user enter Pub key and next is Token amount   
( How much user want to Transform)  

So User enters Pubkey & Token Amount   
Then click on **NEXT BUTTON** 

Once user clicks on Next Button ,

**Next page ( Fee page )** 

Fee Calculation and Transparency

* Transfer Fee Display: Shows 4% fee breakdown   
* Final Amount Preview: Displays exact PEER tokens user will receive after fees  
* User Confirmation: "Ready for Cashout" button requires explicit user consent

When user clicks the Ready for Cashout ( BUTTON)   
 Validation executes ( Below) 

## **Transaction Validation System**

Input Validation

* Address Verification: Confirms the provided address is a valid Solana public key  **( CHECK )**   
* Balance Confirmation: Checks user has sufficient PEER tokens for the requested amount  
* Peer token account check 

## **Token Account Verification**

## **Associated Token Account (ATA) Checking**

The system determines if the user's wallet can receive PEER tokens:  
Process

* Address Derivation: Generates the Associated Token Account address using user's wallet \+ PEER mint address  
* Account Existence Check: Queries Solana blockchain to verify if the token account exists ( Possibilities in php or typescript)   
* GraphQL Integration: PHP backend communicates with TypeScript Solana client via GraphQL API


Two Possible Outcomes

Case 1: **Token Account Exists**

* System proceeds directly to token transfer process ( Next Steps)   
* User experience remains seamless


Case 2: **Token Account Missing**

* System displays clear explanation of requirements as  
* Throw an Error that User must complete Peer token account creation before proceeding

The Token account Check done through the Solana/[web3.js](http://web3.js) Librabry   
\-\> Frontend \-\> Php backend \-\> Call Mutation ( CheckTokenaccount) to Solana Client \-\> Revert Back   
Check by Mint address \+ Wallet Address of User   
Derives the address through PDA   
Then check whether address account exist or not 

If No \-\> Cash out Fails  ( Later we can Implement **Create Token Account Button**)  
For that we need to integrate to Phantom Sdk To pay Sols for account creation by User itself by signing the transaction 

If yes “ **Ready to Cash out** “ Executes 

   
**Next Step : Token Transfer Transaction** 

Actual Token Transfer Through GraphQL Transfer Request 

There will be one Mutation ( Transfer Peer ) 

Triggers to Solana Client    ( If there is chance to Query Solana Block chain Through php Then Flows makes more Easy ) 

Company Control over Token Distribution 

So RUST Creates a Partial Transaction  \-\> Here we need to make Function await till Feepayer ( User needs to sign and Pay the Gas Fees in Sols ) 

So to make transfer success authorization Requires from the Both parties 

User cannot Sign and take out Company Tokens because here to make any actions from the Company wallet Company needs to sign 

Company wallet sign to authorize the Specific Transfer instruction   
Token reservers is in Custody 

## **Transaction Processing Flow**

Backend Coordination

1. PHP Validation: Confirms all requirements are met (wallet address, token account, sufficient balance)  
2. GraphQL Request: Sends transfer parameters to TypeScript Solana client  
3. Transaction Assembly: Creates SPL Token-2022 transfer instruction with proper authorities  
4. Company Signing: Backend applies company wallet signature for token authorization  
5. Partial Transaction: Returns partially signed transaction to frontend

User Completion

1. Wallet Prompt: User's wallet displays transaction details for review  
2. Fee Confirmation: User sees exact SOL amount required for network fees  
3. Final Signature: User approves and signs the transaction  
4. Blockchain Submission: Complete transaction submitted to Solana network

## **Transaction Completion**

## **Successful Transfer Outcome**

* Real Token Ownership: PEER tokens appear in user's personal wallet  
* Blockchain Verification: Transaction hash provides cryptographic proof  
* Balance Updates: PHP backend reduces user's virtual balance by transferred amount  
* Full Control: User can now trade, hold, or use tokens across the Solana ecosystem

