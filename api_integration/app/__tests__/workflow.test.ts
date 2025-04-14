import { loadWallet, connectToSolana, initializeProgram } from '../blockchain/client';
import { storeDataItem, readDataFromAccount } from '../blockchain/store';
import { fetchHelloData } from '../api/client';
import { logger } from '../../utils/logger';
import { StoreResult, DataItem } from '../types';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Mock dependencies
jest.mock('../blockchain/client');
jest.mock('../blockchain/store');
jest.mock('../api/client');
jest.mock('../../utils/logger');

describe('Integration Workflow', () => {
  let mockWallet: any;
  let mockConnection: any;
  let mockProgram: any;
  let mockApiData: { hello: DataItem };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock data
    mockApiData = {
      hello: {
        currentuserid: 'test-user-123'
      }
    };

    // Setup mock objects
    mockWallet = { publicKey: { toString: () => 'mock-wallet-key' } };
    mockConnection = { rpcEndpoint: 'mock-endpoint' };
    mockProgram = {
      methods: {
        initialize: jest.fn().mockReturnThis(),
        accounts: jest.fn().mockReturnThis(),
        rpc: jest.fn().mockResolvedValue('mock-tx')
      },
      provider: {
        connection: {
          confirmTransaction: jest.fn().mockResolvedValue({ value: { err: null } })
        }
      },
      account: {
        dataAccount: {
          fetch: jest.fn().mockResolvedValue({ data: JSON.stringify(mockApiData.hello) })
        }
      }
    };

    // Setup mock implementations
    (loadWallet as jest.Mock).mockReturnValue(mockWallet);
    (connectToSolana as jest.Mock).mockReturnValue(mockConnection);
    (initializeProgram as jest.Mock).mockResolvedValue(mockProgram);
    (fetchHelloData as jest.Mock).mockResolvedValue(mockApiData);
    (storeDataItem as jest.Mock).mockResolvedValue({
      accountAddress: 'mock-account-address',
      success: true
    } as StoreResult);
    (readDataFromAccount as jest.Mock).mockResolvedValue(mockApiData.hello);
  });

  it('should complete the full workflow successfully', async () => {
    // Execute workflow
    await testWorkflow();

    // Verify API call
    expect(fetchHelloData).toHaveBeenCalledTimes(1);

    // Verify Solana setup
    expect(loadWallet).toHaveBeenCalledTimes(1);
    expect(connectToSolana).toHaveBeenCalledTimes(1);
    expect(initializeProgram).toHaveBeenCalledWith(mockWallet, mockConnection);

    // Verify store operation
    expect(storeDataItem).toHaveBeenCalledWith(
      mockProgram,
      mockWallet,
      mockApiData.hello
    );

    // Verify read operation
    expect(readDataFromAccount).toHaveBeenCalledWith(
      mockProgram,
      'mock-account-address'
    );
  });

  it('should handle API errors gracefully', async () => {
    // Mock API error
    (fetchHelloData as jest.Mock).mockRejectedValue(new Error('API Error'));

    // Execute workflow
    await testWorkflow();

    // Verify API call was made
    expect(fetchHelloData).toHaveBeenCalledTimes(1);

    // Verify blockchain operations were not called
    expect(storeDataItem).not.toHaveBeenCalled();
    expect(readDataFromAccount).not.toHaveBeenCalled();
  });

  it('should handle blockchain errors gracefully', async () => {
    // Mock blockchain error
    (storeDataItem as jest.Mock).mockResolvedValue({
      accountAddress: 'mock-account-address',
      success: false,
      error: 'Blockchain Error'
    } as StoreResult);

    // Execute workflow
    await testWorkflow();

    // Verify store operation was attempted
    expect(storeDataItem).toHaveBeenCalledTimes(1);

    // Verify read operation was not called
    expect(readDataFromAccount).not.toHaveBeenCalled();
  });
});

async function testWorkflow() {
  try {
    // Step 1: Fetch data from GraphQL API
    logger.info('Step 1: Fetching data from GraphQL API...');
    const apiData = await fetchHelloData();
    logger.info('Data fetched from API:', apiData);

    // Step 2: Set up Solana connection
    logger.info('Step 2: Setting up Solana connection...');
    const wallet = loadWallet();
    const connection = connectToSolana();
    const program = await initializeProgram(wallet, connection);
    logger.info('✅ Solana connection established');
    
    // Step 3: Store data on Solana
    logger.info('Step 3: Storing data on Solana...');
    const storeResult = await storeDataItem(program, wallet, apiData.hello);
    
    if (!storeResult.success) {
      throw new Error(`Failed to store data: ${storeResult.error}`);
    }
    logger.info('✅ Data stored successfully on Solana');
    
    // Step 4: Read data back from Solana
    logger.info('Step 4: Reading data from Solana...');
    const storedData = await readDataFromAccount(program, storeResult.accountAddress);
    
    if (!storedData) {
      throw new Error('Failed to read data from Solana');
    }
    logger.info('✅ Data read successfully from Solana:', storedData);
    
    // Step 5: Verify data matches
    logger.info('Step 5: Verifying data integrity...');
    const originalData = JSON.stringify(apiData.hello);
    const retrievedData = JSON.stringify(storedData);
    
    if (originalData === retrievedData) {
      logger.info('✅ Data integrity verified - API data matches Solana data');
    } else {
      logger.error('❌ Data mismatch detected:');
      logger.error('Original:', originalData);
      logger.error('Retrieved:', retrievedData);
    }
    
  } catch (error) {
    logger.error('Workflow test failed:', error);
    throw error;
  }
} 