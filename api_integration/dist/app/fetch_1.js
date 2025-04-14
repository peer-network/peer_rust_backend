"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateData = exports.fetchDataWithAxios = exports.fetchDataFromGraphQL = void 0;
const graphql_request_1 = require("graphql-request");
const dotenv_1 = __importDefault(require("dotenv"));
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Load environment variables
dotenv_1.default.config();
// GraphQL API endpoint from .env
const GRAPHQL_ENDPOINT = process.env.GRAPHQL_ENDPOINT;
// Error handling if GraphQL endpoint is not defined
if (!GRAPHQL_ENDPOINT) {
    throw new Error('GRAPHQL_ENDPOINT is not defined in the .env file');
}
// GraphQL client with authentication and configuration
const createGraphQLClient = () => {
    const client = new graphql_request_1.GraphQLClient(GRAPHQL_ENDPOINT, {
        headers: {
            // Add any necessary authentication headers here
            // 'Authorization': `Bearer ${process.env.API_TOKEN}`,
            'Content-Type': 'application/json',
        }
    });
    return client;
};
// GraphQL query - adjust based on your actual GraphQL schema
const FETCH_ITEMS_QUERY = (0, graphql_request_1.gql) `
  query Hello {
    hello {
      currentuserid
    }
  }
`;
// Cache mechanism for data
let cachedData = null;
let lastFetchTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds
/**
 * Fetches data from the GraphQL API with caching, pagination, and error handling
 * @param options Configuration options for the fetch operation
 * @returns Promise with array of data items
 */
function fetchDataFromGraphQL(options = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        const { forceRefresh = false, retries = 3, cacheTTL = CACHE_TTL, } = options;
        // Check cache first if not forcing refresh
        const now = Date.now();
        if (!forceRefresh &&
            cachedData &&
            now - lastFetchTime < cacheTTL) {
            console.log('Using cached data from previous fetch');
            return cachedData[0];
        }
        // Retry logic
        let currentTry = 0;
        let lastError = null;
        while (currentTry < retries) {
            try {
                console.log(`Fetching data from GraphQL API: ${GRAPHQL_ENDPOINT}`);
                console.log(`Attempt ${currentTry + 1} of ${retries}`);
                const client = createGraphQLClient();
                // Execute the GraphQL query
                const response = yield client.request(FETCH_ITEMS_QUERY);
                console.log('Successfully fetched data from GraphQL API');
                // Save to cache
                cachedData = [response.hello];
                lastFetchTime = now;
                // Optionally save the data to a local file for backup
                yield saveDataToLocalBackup(cachedData);
                return response.hello;
            }
            catch (error) {
                console.error(`Error on attempt ${currentTry + 1}:`, error);
                lastError = error;
                currentTry++;
                // Exponential backoff
                if (currentTry < retries) {
                    const backoffTime = Math.pow(2, currentTry) * 1000;
                    console.log(`Retrying in ${backoffTime / 1000} seconds...`);
                    yield new Promise(resolve => setTimeout(resolve, backoffTime));
                }
            }
        }
        // If we've exhausted retries, check if we have cached data to return as fallback
        if (cachedData) {
            console.warn('Using stale cached data after failed API requests');
            return cachedData[0];
        }
        // If no cached data available, try to load from local backup
        try {
            const backupData = yield loadDataFromLocalBackup();
            if (backupData && backupData.length > 0) {
                console.warn('Using local backup data after failed API requests');
                return backupData[0];
            }
        }
        catch (err) {
            console.error('Failed to load backup data:', err);
        }
        // If all strategies fail, throw the last error
        throw new Error(`Failed to fetch data after ${retries} attempts: ${lastError === null || lastError === void 0 ? void 0 : lastError.message}`);
    });
}
exports.fetchDataFromGraphQL = fetchDataFromGraphQL;
/**
 * Save fetched data to a local file as backup
 */
function saveDataToLocalBackup(data) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const backupDir = path.join(process.cwd(), 'data-backup');
            // Create backup directory if it doesn't exist
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            const timestamp = new Date().toISOString().replace(/:/g, '-');
            const backupPath = path.join(backupDir, `graphql-data-${timestamp}.json`);
            yield fs.promises.writeFile(backupPath, JSON.stringify(data, null, 2));
            console.log(`Backup saved to ${backupPath}`);
            // Keep only the 5 most recent backups
            const files = yield fs.promises.readdir(backupDir);
            const backupFiles = files
                .filter(file => file.startsWith('graphql-data-'))
                .sort((a, b) => b.localeCompare(a)); // Sort in descending order
            for (let i = 5; i < backupFiles.length; i++) {
                yield fs.promises.unlink(path.join(backupDir, backupFiles[i]));
            }
        }
        catch (error) {
            console.warn('Failed to save backup:', error);
            // Don't throw - this is a non-critical operation
        }
    });
}
/**
 * Load data from the most recent local backup file
 */
function loadDataFromLocalBackup() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const backupDir = path.join(process.cwd(), 'data-backup');
            if (!fs.existsSync(backupDir)) {
                return null;
            }
            const files = yield fs.promises.readdir(backupDir);
            const backupFiles = files
                .filter(file => file.startsWith('graphql-data-'))
                .sort((a, b) => b.localeCompare(a)); // Sort in descending order
            if (backupFiles.length === 0) {
                return null;
            }
            const latestBackup = path.join(backupDir, backupFiles[0]);
            const data = JSON.parse(yield fs.promises.readFile(latestBackup, 'utf-8'));
            console.log(`Loaded backup from ${latestBackup}`);
            return data;
        }
        catch (error) {
            console.error('Error loading data from backup:', error);
            return null;
        }
    });
}
/**
 * Alternative fetch method using axios for edge cases where graphql-request doesn't work
 */
function fetchDataWithAxios() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield axios_1.default.post(process.env.GRAPHQL_ENDPOINT || '', {
                query: FETCH_ITEMS_QUERY,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });
            if (response.data.errors) {
                throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
            }
            return response.data.data.hello;
        }
        catch (error) {
            console.error('Error fetching with axios:', error);
            throw error;
        }
    });
}
exports.fetchDataWithAxios = fetchDataWithAxios;
// Function to validate data format
function validateData(data) {
    if (!data || typeof data !== 'object') {
        console.error('Data is not an object');
        return false;
    }
    if (!data.currentuserid || typeof data.currentuserid !== 'string') {
        console.error('Invalid data - missing or invalid currentuserid');
        return false;
    }
    return true;
}
exports.validateData = validateData;
