"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fetch_1 = require("./fetch");
const solana_1 = require("./solana");
const store_1 = require("./store");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
/**
 * Main function to run the integration
 */
function runIntegration() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Starting GraphQL to Solana integration process...');
        try {
            // Step 1: Set up Solana connection
            console.log('Step 1: Setting up Solana connection...');
            const wallet = (0, solana_1.loadWallet)();
            const connection = (0, solana_1.connectToSolana)();
            const program = yield (0, solana_1.initializeProgram)(wallet, connection);
            console.log('✅ Solana connection established');
            // Step 2: Fetch data from GraphQL API
            console.log('Step 2: Fetching data from GraphQL API...');
            const items = yield (0, fetch_1.fetchDataFromGraphQL)();
            console.log(`✅ Successfully fetched ${items.length} items from GraphQL`);
            // Step 3: Store data on Solana blockchain
            console.log('Step 3: Storing data on Solana blockchain...');
            const storedAccounts = yield (0, store_1.storeAllData)(program, wallet, items);
            console.log(`✅ Successfully stored ${storedAccounts.length} items on Solana`);
            // Success message
            console.log('🎉 Integration completed successfully!');
            console.log('Stored data account addresses:');
            storedAccounts.forEach((address, index) => {
                console.log(`  ${index + 1}. ${address}`);
            });
        }
        catch (error) {
            console.error('❌ Integration failed:', error);
            process.exit(1);
        }
    });
}
// Run the integration
runIntegration()
    .then(() => process.exit(0))
    .catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
});
