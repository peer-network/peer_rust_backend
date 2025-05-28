import { ClientTypes } from "../../domain/GemsResultsData"
import { MintResponse } from "../../handlers/solanaProvider/SolanaProviderResponse"
import { Result } from "../../domain/Result"
import { Status } from "../../handlers/solanaProvider/SolanaProviderResponse"
import { CodeDescription, ErrorHandler, ErrorFactory } from '../../utils/errors'

export interface ISolanaRepository {
    mint(): Promise<Result<undefined,CodeDescription>>
    airdrop(data: ClientTypes.TokensDistibution): void
}