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
exports.initializeProgram = exports.connectToSolana = exports.loadWallet = void 0;
const web3_js_1 = require("@solana/web3.js");
const anchor_1 = require("@coral-xyz/anchor");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
/**
 * Loads wallet from the keypair file specified in .env
 * @returns Solana Keypair
 */
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
exports.loadWallet = loadWallet;
/**
 * Creates a connection to the Solana network
 * @returns Solana Connection
 */
function connectToSolana() {
    const network = process.env.SOLANA_NETWORK || anchor_1.web3.clusterApiUrl('devnet');
    console.log(`Connecting to Solana network: ${network}`);
    return new web3_js_1.Connection(network, 'confirmed');
}
exports.connectToSolana = connectToSolana;
/**
 * Initializes the Anchor program
 * @param wallet The wallet keypair
 * @param connection The Solana connection
 * @returns Initialized Anchor program
 */
function initializeProgram(wallet, connection) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Get program ID from .env
            const programIdString = process.env.PROGRAM_ID;
            if (!programIdString) {
                throw new Error('PROGRAM_ID not found in environment variables');
            }
            const programId = new web3_js_1.PublicKey(programIdString);
            console.log(`Initializing program with ID: ${programId.toString()}`);
            // Create AnchorProvider
            const provider = new anchor_1.AnchorProvider(connection, {
                publicKey: wallet.publicKey,
                signTransaction: (tx) => __awaiter(this, void 0, void 0, function* () {
                    if (tx instanceof web3_js_1.VersionedTransaction) {
                        tx.sign([wallet]);
                    }
                    else {
                        tx.partialSign(wallet);
                    }
                    return tx;
                }),
                signAllTransactions: (txs) => __awaiter(this, void 0, void 0, function* () {
                    for (const tx of txs) {
                        if (tx instanceof web3_js_1.VersionedTransaction) {
                            tx.sign([wallet]);
                        }
                        else {
                            tx.partialSign(wallet);
                        }
                    }
                    return txs;
                }),
            }, { commitment: 'confirmed' });
            // Load the IDL (Interface Description Language) file
            const idlPath = path_1.default.resolve('target/idl/api_integration.json');
            console.log(`Loading IDL from: ${idlPath}`);
            const idl = JSON.parse(fs_1.default.readFileSync(idlPath, 'utf-8'));
            // Initialize and return the program
            return new anchor_1.Program(idl, programId, provider);
        }
        catch (error) {
            console.error('Error initializing program:', error);
            throw error;
        }
    });
}
exports.initializeProgram = initializeProgram;
