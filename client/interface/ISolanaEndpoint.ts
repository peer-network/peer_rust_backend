import { StoreAllResult } from "../../api_integration/app/types"
import { DataItem } from "../../api_integration/app/types"

export interface ISolanaEndpoint {
  storeAllData(userId : string) : Promise<StoreAllResult | undefined>
  readingStoredDataFromSolana(storeResult : StoreAllResult) : Promise<DataItem | undefined>
}