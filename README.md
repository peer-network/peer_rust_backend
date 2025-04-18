# Mint Implementation Workflow

## Overview

This repository implements the minting process for the Peer Network project. The workflow involves calculating user gems, updating the database, triggering interactions with the Solana blockchain, and distributing Peer Tokens to users. This process is automated via cron jobs, backend scripts, and smart contract calls.

## Workflow Breakdown

### 1. **Daily Calculation Trigger (Cron Job)**
- **Time**: 12:00 AM daily
- **Action**: A cron job is scheduled to execute the `cal_gems.php` script at 12:00 AM every day.
    - **Purpose**: This task initiates the gem calculation process for users based on their interactions (likes, comments, views) during the day.
    - **How it Works**:
        - The `cal_gems.php` script calls an API endpoint to fetch relevant data about user interactions.
        - It then performs calculations to determine how many gems each user has accumulated.
        - The script updates the database with the new gem values for each user.

### 2. **API Call (PHP Backend)**
- **API Endpoint**: `https://peer-network.eu/graphql`
- **Process**:
    - The script uses GraphQL to retrieve data related to user interactions such as likes, comments, and views.
    - For each user, the script calculates the total gems they have accumulated.
    - After calculations, the script updates the database with the new total gems for each user.

    **Example Data**:
    - **User A**: 5 Gems (e.g., from 1 like)
    - **User B**: 3 Gems (e.g., from 1 comment)
    - **User C**: 2 Gems (e.g., from 2 views)

### 3. **Error Handling (Post-Script Execution)**
- **Successful Calculation**:
    - If the `cal_gems.php` script executes successfully and updates the database with new gem totals, it triggers a ping to the Solana client-side to start the minting process.
- **Failed Calculation**:
    - If the script encounters an error (e.g., fails to update the database), no ping is sent to the client, halting further processing. Additional error handling can be added to manage edge cases.

### 4. **Blockchain Interaction (Client-Side)**
- **Ping Reception**:
    - After the successful execution of `cal_gems.php`, the backend triggers a ping to the Solana client-side.
    - The Solana client-side script listens for this ping and reacts accordingly.
- **Automated Data Request**:
    - Upon receiving the ping, the Solana client automatically queries the backend to retrieve the latest gem data for users.
    - **GraphQL Query**:
    ```graphql
    query dailygemResult {
        userid
        gems
        totalGems
    }
    ```
    - This query retrieves the user's ID, the number of gems they have, and the total gems across all users.

### 5. **Data Validation**
- **Data Validation Process**:
    - After receiving the data from the backend, the Solana client performs validation to ensure that the data is correct and complete.
    - If there is an issue with the data, appropriate error handling mechanisms will be triggered.

### 6. **Smart Contract Call (Minting Process)**
- **Smart Contract Interaction**:
    - Once the data is validated, the Solana client interacts with the Solana smart contract to initiate the minting of tokens.
    - **Parameters**: 
        - The smart contract uses **ProgramID**, **IDL**, and **Keys** to communicate with the Solana network and carry out the minting process.
    - **Minting Tokens**:
        - The smart contract creates an SPL custom token based on the minting logic and parameters passed by the client.

### 7. **Airdrop Distribution**
- **Airdrop Calculation**:
    - The smart contract contains an airdrop function that distributes tokens to users based on their gem share.
    - The formula used to calculate the user’s share of the total tokens is:
    \[
    \text{User Token} = \left(\frac{\text{user gems}}{\text{total gems}}\right) \times 5000
    \]
    - Tokens are minted from the founder's wallet and airdropped to each user's wallet proportionally to their gem total.

    **Example**:
    - **User A**: Receives tokens based on their share of total gems.
    - **User B**: Similarly receives tokens based on their gem share.

### 8. **Deployment to Solana Network**
- **Deployment**:
    - Once the minting and airdrop operations are completed, the transaction is deployed to the Solana network.
    - The users' wallets now hold the Peer Tokens minted by the smart contract.

### 9. **User Token Access**
- **Accessing Tokens**:
    - After the minting process is complete, users can check their Peer Token balances.
    - Users can view their token balances on the Solana network by checking their public key via the Solana Explorer.

    **Example**:
    - **User A**: 2500 Peer Tokens
    - **User B**: 1500 Peer Tokens
    - **User C**: 1000 Peer Tokens
    - **Verification**: Users can verify their Peer Token balance using their public key in the Solana Explorer.

## Requirements
- **Solana Client**: Required for interacting with the Solana blockchain.
- **PHP**: Used for backend calculations and API interactions.
- **Solana Smart Contract**: Facilitates minting and token distribution.
- **Cron Job**: Schedules the execution of the `cal_gems.php` script to run daily at 12:00 AM.

## How to Run

### 1. Set up Cron Job
- Configure a cron job to run the `cal_gems.php` script every day at **12:00 AM**.
    - The cron job will trigger the gem calculation process and handle subsequent minting and airdrop actions.

### 2. Solana Smart Contract Setup
- Deploy the smart contract on the Solana network to handle token minting and airdrop functions.
    - Ensure that the contract includes the necessary logic to create custom SPL tokens and distribute them based on the gem calculations.

### 3. Verify User Tokens
- After the minting and airdrop process is complete, users can check their Peer Token balances on the Solana Explorer by entering their public key.

---

This `README.md` provides an overview and detailed step-by-step breakdown of the minting process. It includes the technical workflow, data flow, and interaction between backend PHP scripts and the Solana blockchain. The document also covers the minting and airdrop logic, along with instructions for setting up cron jobs and verifying user tokens.
