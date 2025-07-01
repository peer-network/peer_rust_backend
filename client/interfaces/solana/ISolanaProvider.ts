import {GemData} from "../../../../peer-token/app/token_operations/user_token"
import {MintResponse,AirDropResponse} from "../../handlers/solanaProvider/SolanaProviderResponse"

export interface ISolanaProvider {
    airdrop(data : any): void
    mint(): Promise<MintResponse>
}