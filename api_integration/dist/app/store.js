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
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeAllData = exports.storeDataItem = void 0;
const web3_js_1 = require("@solana/web3.js");
const anchor_1 = require("@project-serum/anchor");
/**
 * Stores a single data item on the Solana blockchain
 * @param program The Anchor program
 * @param wallet The wallet keypair
 * @param item The data item to store
 * @returns Promise resolved when storage is complete
 */
function storeDataItem(program, wallet, item) {
    return __awaiter(this, void 0, void 0, function* () {
        // Generate a new account to store this data item
        const dataAccount = web3_js_1.Keypair.generate();
        const dataAccountPublicKey = dataAccount.publicKey.toString();
        console.log(`Storing item ${item.id} in account ${dataAccountPublicKey}`);
        try {
            // Call the program's initialize instruction
            // This matches the initialize function in the Anchor program (lib.rs)
            yield program.methods
                .initialize(item.id, item.name, new anchor_1.BN(item.value))
                .accounts({
                dataAccount: dataAccount.publicKey,
                user: wallet.publicKey,
                systemProgram: web3_js_1.SystemProgram.programId,
            })
                .signers([dataAccount])
                .rpc();
            console.log(`Successfully stored item ${item.id} on Solana blockchain`);
            return dataAccountPublicKey;
        }
        catch (error) {
            console.error(`Error storing item ${item.id}:`, error);
            throw error;
        }
    });
}
exports.storeDataItem = storeDataItem;
/**
 * Stores multiple data items on the Solana blockchain
 * @param program The Anchor program
 * @param wallet The wallet keypair
 * @param items Array of data items to store
 * @returns Promise resolved when all items are stored
 */
function storeAllData(program, wallet, items) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(`Preparing to store ${items.length} items on Solana`);
        const results = [];
        for (const item of items) {
            try {
                const accountAddress = yield storeDataItem(program, wallet, item);
                results.push(accountAddress);
            }
            catch (error) {
                console.error(`Failed to store item ${item.id}:`, error);
                // Continue with other items even if one fails
            }
        }
        console.log(`Successfully stored ${results.length} out of ${items.length} items`);
        return results;
    });
}
exports.storeAllData = storeAllData;
