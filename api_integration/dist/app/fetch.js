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
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUERIES = exports.executeQuery = void 0;
const graphql_request_1 = require("graphql-request");
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config();
// Custom error class for GraphQL errors
class GraphQLError extends Error {
    constructor(message, errors) {
        super(message);
        this.errors = errors;
        this.name = 'GraphQLError';
    }
}
// Initialize GraphQL client with error handling
const createGraphQLClient = () => {
    const endpoint = process.env.GRAPHQL_ENDPOINT;
    if (!endpoint) {
        throw new Error('GRAPHQL_ENDPOINT environment variable is not set');
    }
    return new graphql_request_1.GraphQLClient(endpoint, {
        timeout: 10000,
        headers: {
            // Add any required headers here
            'Content-Type': 'application/json',
        },
    });
};
// Rate limiting implementation
class RateLimiter {
    constructor(requestsPerSecond = 5) {
        this.queue = [];
        this.processing = false;
        this.lastRequestTime = 0;
        this.minInterval = 1000 / requestsPerSecond;
    }
    add(fn) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.queue.push(() => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const result = yield fn();
                        resolve(result);
                    }
                    catch (error) {
                        reject(error);
                    }
                }));
                this.process();
            });
        });
    }
    process() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.processing || this.queue.length === 0)
                return;
            this.processing = true;
            while (this.queue.length > 0) {
                const now = Date.now();
                const timeSinceLastRequest = now - this.lastRequestTime;
                if (timeSinceLastRequest < this.minInterval) {
                    yield new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLastRequest));
                }
                const fn = this.queue.shift();
                if (fn) {
                    yield fn();
                }
                this.lastRequestTime = Date.now();
            }
            this.processing = false;
        });
    }
}
// Create rate limiter instance (5 requests per second)
const rateLimiter = new RateLimiter(5);
// Main GraphQL query function with error handling and retries
function executeQuery(query, variables, retries = 3) {
    return __awaiter(this, void 0, void 0, function* () {
        const client = createGraphQLClient();
        const executeWithRetry = (attempt) => __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield rateLimiter.add(() => client.request(query, variables));
                if (response.errors) {
                    throw new GraphQLError('GraphQL query failed', response.errors);
                }
                return response.data;
            }
            catch (error) {
                if (attempt < retries && (error instanceof GraphQLError || error instanceof Error)) {
                    // Exponential backoff
                    yield new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                    return executeWithRetry(attempt + 1);
                }
                throw error;
            }
        });
        return executeWithRetry(0);
    });
}
exports.executeQuery = executeQuery;
// Example queries
exports.QUERIES = {
    // Add your GraphQL queries here
    GET_DATA: `
    query GetData($input: DataInput!) {
      data(input: $input) {
        id
        field1
        field2
        # Add more fields as needed
      }
    }
  `,
    // Add more queries as needed
};
