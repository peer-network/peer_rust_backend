export enum Status {
  error = "ERROR",
  success = "SUCCESS"
}

export interface BasicSolanaResponse {
    code : string,
    message : string
    status : Status
}

export interface MintResponse extends BasicSolanaResponse {
    data : any
}

export interface AirDropResponse extends BasicSolanaResponse {
    data : any
}
