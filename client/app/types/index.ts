/**
 * Response from the hello query
 */
export interface HelloResponse {
  hello: {
    currentuserid: string;
  };
}

/**
 * Data item for blockchain storage
 */
export interface DataItem {
  currentuserid: string;
}

/**
 * Result of storing data on blockchain
 */
export interface StoreResult {
  accountAddress: string;
  success: boolean;
  error?: string;
}

/**
 * Result of storing multiple data items
 */
export interface StoreAllResult {
  results: StoreResult[];
  totalItems: number;
  successfulItems: number;
  failedItems: number;
} 