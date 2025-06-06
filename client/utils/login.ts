import dotenv from 'dotenv';
import { logger } from './logger';
import path from 'path';
import { CodeDescription, ErrorHandler, ErrorFactory } from './errors';
import { PeerBackendDTO } from '../handlers/endpoint/client/PeerBackend/PeerBackendEndpointDTO';
import { baseConfig } from '../app/config/config';

dotenv.config({ path: path.resolve(__dirname, '../env/login.env') });

const EMAIL = process.env.LOCAL_PEER_BACKEND_BRIDGE_USER_EMAIL
const PASS = process.env.LOCAL_PEER_BACKEND_BRIDGE_USER_PASS

const query = `
    mutation Login {
        login(email: "${EMAIL}", password: "${PASS}") {
            accessToken
            refreshToken
            status
            ResponseCode
        }
    }
`;

class PeerBackendLoginErrors {
    public static ENV_ERROR : CodeDescription = {
        code: "-1",
        message: 'ENV_ERROR'
    };
    public static RESPONSE_ERROR : CodeDescription = {
        code: "-1",
        message: 'RESPONSE_ERROR'
    };
}

export default class PeerBackendLogin {
    private static errors : typeof PeerBackendLoginErrors

    private static validateLoginQuery() {
        if (!EMAIL || !PASS ) {
            const error = ErrorFactory.configurationError('login credentials', 'EMAIL or PASSWORD not set in environment');
            throw new Error(`${error.message} (Code: ${error.code})`);
        }
    }
    private static async getLoginResponse(responseRaw : any) : Promise<PeerBackendDTO.LoginDTO> {
        if (!responseRaw) {
            const error = ErrorFactory.externalServiceError('PeerBackend', undefined, 'No response received');
            throw new Error(`${error.message} (Code: ${error.code})`);
        }
        const responseJSON = await responseRaw.json();
        if (!responseJSON) {
            const error = ErrorFactory.externalServiceError('PeerBackend', undefined, 'Empty JSON response');
            throw new Error(`${error.message} (Code: ${error.code})`);
        }
        const data = responseJSON.data.login
        if (!data) {
            const error = ErrorFactory.resourceNotFound('login data', 'response.data.login');
            throw new Error(`${error.message} (Code: ${error.code})`);
        }
        const castedDTO = data as PeerBackendDTO.LoginDTO
        const loginResponse = new PeerBackendDTO.LoginDTO(
            castedDTO.status,
            castedDTO.ResponseCode,
            castedDTO.accessToken,
            castedDTO.refreshToken
        )

        if (!loginResponse) {
            const error = ErrorFactory.validationError('loginResponse', loginResponse, 'failed to create DTO');
            throw new Error(`${error.message} (Code: ${error.code})`);
        }
        return loginResponse
    }

    static async login(): Promise<PeerBackendDTO.LoginDTO> {
        this.validateLoginQuery()

        const responseRaw = await fetch(baseConfig.GRAPHQL.PEER_BACKEND_GRAPHQL_ENDPOINT, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ query }),
        });
        return await this.getLoginResponse(responseRaw)
    }
}