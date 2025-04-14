"use strict";
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
const fetch_1_1 = require("./fetch_1");
function testFetch() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('Testing GraphQL fetch...');
            // Test the main fetch function
            const data = yield (0, fetch_1_1.fetchDataFromGraphQL)({
                forceRefresh: true
            });
            console.log('Fetched data:', data);
            console.log('Data validation:', (0, fetch_1_1.validateData)(data));
            // Test axios fetch as backup
            console.log('\nTesting axios fetch...');
            const axiosData = yield (0, fetch_1_1.fetchDataWithAxios)();
            console.log('Axios fetched data:', axiosData);
            console.log('Axios data validation:', (0, fetch_1_1.validateData)(axiosData));
        }
        catch (error) {
            console.error('Test failed:', error);
        }
    });
}
// Run the test
testFetch();
