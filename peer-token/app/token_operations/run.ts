// This is created for testing purposes.
import { main  } from "./airdrop";
import { tokenDistribution } from "../mockdata/distribution";
import { ErrorHandler } from "../errors";

(async () => {
    try {
        await main( tokenDistribution);
    } catch (error) {
        console.error("❌ Error in run script:");
        ErrorHandler.handle(error);
        process.exit(1);
    }
})();