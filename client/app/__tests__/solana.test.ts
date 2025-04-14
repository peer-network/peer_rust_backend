import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { loadWallet, connectToSolana, initializeProgram } from '../blockchain/client';
import { Keypair, Connection } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';

// Mock the environment variables
jest.mock('dotenv', () => ({
  config: jest.fn()
}));

// Mock file system
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
  existsSync: jest.fn(),
  readdirSync: jest.fn()
}));

describe('Solana Functions', () => {
  let mockKeypair: Keypair;
  
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Create a mock keypair
    mockKeypair = Keypair.generate();
    
    // Mock fs.readFileSync to return a valid keypair
    require('fs').readFileSync.mockImplementation((path: string) => {
      if (path.includes('keypair.json')) {
        return JSON.stringify(Array.from(mockKeypair.secretKey));
      }
      if (path.includes('api_integration.json')) {
        return JSON.stringify({
          version: "0.1.0",
          name: "api_integration",
          instructions: []
        });
      }
      throw new Error('File not found');
    });

    // Mock fs.existsSync to return true for IDL file
    require('fs').existsSync.mockImplementation((path: string) => {
      return path.includes('api_integration.json');
    });
    
    // Mock environment variables
    process.env.PROGRAM_ID = 'ByB8NvWuXWG5KCw5MPY2kV478UY9VnVzhyss9bXPGYkb';
    process.env.SOLANA_RPC_URL = 'https://api.devnet.solana.com';
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.PROGRAM_ID;
    delete process.env.SOLANA_RPC_URL;
  });

  describe('loadWallet', () => {
    it('should load wallet from keypair file', () => {
      const wallet = loadWallet();
      expect(wallet).toBeInstanceOf(Keypair);
      expect(wallet.publicKey).toBeDefined();
    });

    it('should throw error when keypair file is invalid', () => {
      require('fs').readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });
      
      expect(() => loadWallet()).toThrow('Failed to load wallet');
    });
  });

  describe('connectToSolana', () => {
    it('should connect to Solana network', () => {
      const connection = connectToSolana();
      expect(connection).toBeInstanceOf(Connection);
      expect(connection.rpcEndpoint).toBe('https://api.devnet.solana.com');
    });
  });

  describe('initializeProgram', () => {
    it('should initialize program with valid parameters', async () => {
      const connection = connectToSolana();
      const program = await initializeProgram(mockKeypair, connection);
      expect(program).toBeInstanceOf(Program);
    });

    it('should throw error when PROGRAM_ID is not defined', async () => {
      delete process.env.PROGRAM_ID;
      const connection = connectToSolana();
      await expect(initializeProgram(mockKeypair, connection))
        .rejects
        .toThrow('PROGRAM_ID not found in environment variables');
    });
  });
}); 