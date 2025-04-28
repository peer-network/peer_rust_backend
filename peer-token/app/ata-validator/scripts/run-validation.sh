#!/bin/bash

# Change to the project root directory (from wherever the script is called)
cd "$(dirname "$0")/../.."

echo "Installing dependencies..."
npm install @solana/web3.js @solana/spl-token ts-node

echo "Running ATA validation script..."
npx ts-node app/ata-validator/scripts/validate-atas.ts

echo "Done!" 