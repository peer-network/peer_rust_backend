import { main  } from "./airdrop";
import { tokenDistribution } from "../mockdata/distribution";
(async () => {
    await main( tokenDistribution);
  })();