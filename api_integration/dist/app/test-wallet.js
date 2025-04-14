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
const web3_js_1 = require("@solana/web3.js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
// Copy the exact loadWallet function from solana.ts
function loadWallet() {
    try {
        const keypairFile = process.env.KEYPAIR_FILE || path_1.default.resolve('wallet/keypair.json');
        console.log(`Loading wallet from: ${keypairFile}`);
        const secretKey = new Uint8Array(JSON.parse(fs_1.default.readFileSync(keypairFile, 'utf-8')));
        const wallet = web3_js_1.Keypair.fromSecretKey(secretKey);
        console.log(`Wallet loaded with public key: ${wallet.publicKey.toString()}`);
        return wallet;
    }
    catch (error) {
        console.error('Error loading wallet:', error);
        if (error instanceof Error) {
            throw new Error(`Failed to load wallet: ${error.message}`);
        }
        throw new Error('Failed to load wallet: Unknown error');
    }
}
// Test the function
function test() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('Starting wallet test...');
            const wallet = loadWallet();
            console.log('Test completed successfully!');
        }
        catch (error) {
            console.error('Test failed:', error);
        }
    });
}
// Run the test
test();
