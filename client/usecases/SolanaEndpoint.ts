import path from 'path';
import dotenv from 'dotenv';
import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { ISolanaEndpoint } from "../interfaces/ISolanaEndpoint"
import { 
  loadWallet, 
  connectToSolana, 
  initializeProgram,
  storeAllData,
  readDataFromAccount,
  Program
} from "../../api_integration/app/blockchain"
import { logger } from '../utils/logger';
import { DataItem, StoreAllResult } from '../../api_integration/app/types';

class SolanaDataItem implements DataItem {
	currentuserid: string;

	constructor(currentuserid : string) {
		this.currentuserid = currentuserid
	}
}

export class SolanaEndpoint implements ISolanaEndpoint {
	program : Program
	wallet : Keypair

	constructor() {
		this.initialSetup()
		this.runIntegration()
	}

	initialSetup() {
		// Load environment variables
		dotenv.config({ path: path.resolve(__dirname, '../../.env') });

		// Log environment variables to verify they are loaded
		logger.info('Environment variables loaded:');
		logger.info(`SOLANA_NETWORK: ${process.env.SOLANA_NETWORK}`);
		logger.info(`PROGRAM_ID: ${process.env.PROGRAM_ID}`);
		logger.info(`KEYPAIR_FILE: ${process.env.KEYPAIR_FILE}`);
	}

	async runIntegration() {
		logger.info('Starting GraphQL to Solana integration process...');
		try {
			// Step 1: Set up Solana connection
			logger.info('Step 1: Setting up Solana connection...');
			this.wallet = loadWallet();
			const connection = connectToSolana();
			this.program = await initializeProgram(this.wallet, connection);
			logger.info('✅ Solana connection established');
		} catch (error) {
			logger.error('❌ Integration failed:', error);
		}
	}

	async storeAllData(userId : string) : Promise<StoreAllResult | undefined> {
		try {
			logger.info('Step 3: Storing data on Solana blockchain...');
			const storeResult = await storeAllData(this.program, this.wallet, [{
				currentuserid: userId
			}]);
			logger.info('✅ Successfully stored data on Solana');
			return storeResult
		} catch (error) {
			logger.error('❌ Integration failed:', error);
			return undefined
		}
	}

	async readingStoredDataFromSolana(storeResult : StoreAllResult) : Promise<DataItem | undefined> {
		logger.info('Step 4: Reading stored data from Solana...');
		try {
			for (const result of storeResult.results) {
				if (result.success) {
					logger.info(`  ${result.accountAddress}`);
					
					// Read the data from the account
					const storedData = await readDataFromAccount(this.program, result.accountAddress);
					if (storedData) {
						logger.info('  Stored data:', storedData);
					} else {
						logger.error(`  Failed to read data from account ${result.accountAddress}`);
					}
				} else {
					logger.error(`  Failed: ${result.accountAddress} - ${result.error}`);
				}
			}
			return new SolanaDataItem("userId")
		} catch (error) {
			logger.error('❌ Integration failed:', error);
			return undefined
		}
	}
}