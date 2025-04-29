# ATA Validator Tool

This tool validates Associated Token Accounts (ATAs) for a list of wallet addresses.

## What it does

- Reads wallet addresses from a JSON file
- For each address, it checks if there is an Associated Token Account for your token
- Validates that the ATA is correctly owned by the wallet
- Reports token balances for valid ATAs
- Generates a detailed report of all wallet ATAs

## How to use

1. Update the wallet addresses in `data/wallets.json`

2. Configure your token in `scripts/validate-atas.ts`:
   - Update `MINT_ADDRESS` with your token's mint address
   - Set `TOKEN_DECIMALS` to match your token's decimals
   - Choose the `CLUSTER` (devnet or mainnet-beta)

3. Run the validation script:
   ```
   chmod +x scripts/run-validation.sh
   ./scripts/run-validation.sh
   ```

4. View the results in `data/validation-results.json`

## Structure

- `data/`: Contains input wallet data and output validation results
- `scripts/`: Contains the validation code and runner script
  - `validate-atas.ts`: Main TypeScript validator
  - `run-validation.sh`: Shell script for running the validator

## Example results

```json
{
  "timestamp": "2023-06-15T12:34:56.789Z",
  "mintAddress": "5wzfDw7tg2z1UKsAmqBMVm43tXTQxd8wVZYBYLHHhotW",
  "cluster": "devnet",
  "results": [
    {
      "walletAddress": "GiZ5wt99f2hFqkwQHk8Jzn7VwNUuXRwSVviCPj2ixTsK",
      "hasATA": true,
      "ataAddress": "ATmzR5gqFkBSh8Vd9CmP5xvFh4GwXo2NSX2jFkMHLarh",
      "ataBalance": 100
    },
    {
      "walletAddress": "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
      "hasATA": false,
      "ataAddress": "6m1MBQdnBmn9LpYk86vKDecGvMsX7aQUVgCz6AxN8mqa",
      "error": "ATA does not exist"
    }
  ]
}
``` 