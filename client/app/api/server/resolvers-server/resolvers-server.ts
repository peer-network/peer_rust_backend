import { Resolvers } from '../../../../infrastructure/gql/generated-types/server/types-server';
import { HelloUseCase } from '../../../../useCases/HelloUseCase' 
import { MintUseCase } from '../../../../useCases/Mint/MintUseCase' 
import { PeerBackendRepositoryImpl } from '../../../../handlers/repos/PeerBackendRepository';
import { SolanaRepository } from '../../../../handlers/repos/SolanaRepository';
import { PeerBackendAuthRepositoryImpl } from '../../../../handlers/repos/PeerBackendAuthRepositoryImpl';
import MockPeerBackendClientAuthEndpointImpl from '../../../../handlers/endpoint/client/PeerBackendAuth/MockPeerBackendClientAuthEndpointImpl';
import MockPeerBackendClientEndpointImpl from '../../../../handlers/endpoint/client/PeerBackend/MockPeerBackendClientEndpointImpl';
import {SolanaRPCProviderImpl} from '../../../../handlers/solanaProvider/SolanaProviderImpl';
import MintUseCaseValidator from '../../../../useCases/Mint/validation/MintUseCaseValidator';
import PeerBackendClientEndpointImpl from '../../../../handlers/endpoint/client/PeerBackend/PeerBackendClientEndpointImpl';
import PeerBackendClientAuthEndpointImpl from '../../../../handlers/endpoint/client/PeerBackendAuth/PeerBackendClientAuthEndpointImpl';
import {ClientTypes} from '../../../../domain/GemsResultsData';

const queries: Resolvers = {
  Query: {
    hello: async () => { 
      const response = await new HelloUseCase().execute();
      if (response.data) {
        return response.data;
      }
      throw new Error(`${response.responseCode}: ${response.message}`);
    }
  },
  Mutation: {
    mint(parent, args, contextValue, info) {
      const day = args.day as unknown as ClientTypes.DayFilterType
      
      return new MintUseCase(
        new PeerBackendRepositoryImpl(
          new PeerBackendClientEndpointImpl()
        ),
        new PeerBackendAuthRepositoryImpl(
          new PeerBackendClientAuthEndpointImpl()
        ),
        new SolanaRepository(
          new SolanaRPCProviderImpl()
        ),
        new MintUseCaseValidator()
      ).execute(day)
    },
    mockMint(parent, args, contextValue, info) {
      const day = args.day as unknown as ClientTypes.DayFilterType
      
      return new MintUseCase(
        new PeerBackendRepositoryImpl(
          new MockPeerBackendClientEndpointImpl()
        ),
        new PeerBackendAuthRepositoryImpl(
          new MockPeerBackendClientAuthEndpointImpl()
        ),
        new SolanaRepository(
          new SolanaRPCProviderImpl()
        ),
        new MintUseCaseValidator()
      ).execute(day)
    }
  }
};

export default queries;