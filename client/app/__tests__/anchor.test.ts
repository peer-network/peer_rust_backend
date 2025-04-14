import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { expect } from 'chai';

describe("solana-program", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.YourProgram as Program<YourProgram>;

  it("Is initialized!", async () => {
    // Add your test here
    const dataAccount = new PublicKey("your_data_account");
    
    try {
      // Example: Fetch account data
      const account = await program.account.dataAccount.fetch(dataAccount);
      expect(account).to.not.be.null;
    } catch (error) {
      console.error("Error:", error);
      throw error;
    }
  });
}); 