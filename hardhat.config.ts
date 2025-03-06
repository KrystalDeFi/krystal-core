import '@nomicfoundation/hardhat-verify';
import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';

import 'hardhat-contract-sizer';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import {HardhatUserConfig} from 'hardhat/types';
import * as dotenv from 'dotenv';
import {accounts} from './scripts/testWallet';

// General config in .env
dotenv.config();

// Network specific config
dotenv.config({path: `${__dirname}/./env/.env.${process.env.CHAIN}.${process.env.NETWORK}`});

const {
  PRIVATE_KEY,
  INFURA_API_KEY,
  ETHERSCAN_KEY,
  BSCSCAN_KEY,
  AVAXSCAN_KEY,
  POLYGONSCAN_KEY,
  FANTOMSCAN_KEY,
  AURORASCAN_KEY,
  ARBISCAN_KEY,
  OPTIMISTICSCAN_KEY,
  MAINNET_ID,
  MAINNET_FORK,
  MAINNET_FORK_BLOCK,
  LINEASCAN_KEY,
  BASESCAN_KEY,
  SONICSCAN_KEY,
  BERASCAN_KEY,
} = process.env;

// custom network config for testing. See scripts/config.ts
export const customNetworkConfig =
  process.env.CHAIN && process.env.CHAIN ? `${process.env.CHAIN}_${process.env.NETWORK}` : undefined;

export const multisig = process.env.MULTISIG ?? undefined;

console.log(
  `--ENVS:\n--CHAIN=${process.env.CHAIN}, NETWORK=${process.env.NETWORK}, customConfig=${customNetworkConfig}`
);
console.log(
  `--MAINNET_FORK=${process.env.MAINNET_FORK}, MAINNET_ID=${process.env.MAINNET_ID}, MAINNET_FORK_BLOCK=${process.env.MAINNET_FORK_BLOCK}`
);

const config: HardhatUserConfig = {
  defaultNetwork: 'hardhat',

  contractSizer: {
    alphaSort: false,
    runOnCompile: false,
    disambiguatePaths: false,
  },

  gasReporter: {
    currency: 'USD',
    gasPrice: 100,
  },

  networks: {},

  solidity: {
    compilers: [
      {
        version: '0.7.6',
        settings: {
          optimizer: {
            enabled: true,
            runs: 780,
          },
          metadata: {
            // metadata hash is machine dependent, we want all generated code to be deterministic
            // https://docs.soliditylang.org/en/v0.7.6/metadata.html
            bytecodeHash: 'none',
          },
        },
      },
    ],
  },

  paths: {
    sources: './contracts',
    tests: './test/',
  },

  mocha: {
    timeout: 0,
    fullStackTrace: true,
    parallel: false,
    fullTrace: true,
  },

  etherscan: {
    // Your API key for bscscan / ethscan
    // Obtain one at https://bscscan.io/
    apiKey: {
      mainnet: ETHERSCAN_KEY as string,
      ropsten: ETHERSCAN_KEY as string,
      goerli: ETHERSCAN_KEY as string,
      rinkeby: ETHERSCAN_KEY as string,

      // binance smart chain
      bsc: BSCSCAN_KEY as string,
      bscTestnet: BSCSCAN_KEY as string,

      // fantom mainnet
      opera: FANTOMSCAN_KEY as string,
      ftmTestnet: FANTOMSCAN_KEY as string,

      // polygon
      polygon: POLYGONSCAN_KEY as string,
      polygonMumbai: POLYGONSCAN_KEY as string,

      // avalanche
      avalanche: AVAXSCAN_KEY as string,
      avalancheFujiTestnet: AVAXSCAN_KEY as string,

      // aurora
      aurora: AURORASCAN_KEY as string,
      auroraTestnet: AURORASCAN_KEY as string,

      // arbitrum
      arbitrumOne: ARBISCAN_KEY as string,
      arbitrumTestnet: ARBISCAN_KEY as string,

      // optimism
      optimisticEthereum: OPTIMISTICSCAN_KEY as string,

      // linea
      // lineaGoerli: 'YourApiKeyToken',
      linea: LINEASCAN_KEY as string,

      base: BASESCAN_KEY as string,

      sonic: SONICSCAN_KEY as string,

      berachain: BERASCAN_KEY as string,
    },
    customChains: [
      {
        network: 'lineaGoerli',
        chainId: 59140,
        urls: {
          apiURL: 'https://goerli.lineascan.build/api',
          browserURL: 'https://goerli.lineascan.build/',
        },
      },
      {
        network: 'linea',
        chainId: 59144,
        urls: {
          apiURL: 'https://api.lineascan.build/api',
          browserURL: 'https://lineascan.build/',
        },
      },
      {
        network: 'base',
        chainId: 8453,
        urls: {
          apiURL: 'https://api.basescan.org/api',
          browserURL: 'https://api.basescan.org',
        },
      },
      {
        network: 'sonic',
        chainId: 146,
        urls: {
          apiURL: 'https://api.sonicscan.org/api',
          browserURL: 'https://sonicscan.org',
        },
      },
      {
        network: 'berachain',
        chainId: 80094,
        urls: {
          apiURL: 'https://api.berascan.com/api',
          browserURL: 'https://berascan.com',
        },
      },
    ],
  },

  typechain: {
    outDir: './typechain',
    target: 'ethers-v5',
  },
};

if (MAINNET_FORK) {
  config.networks!.hardhat = {
    accounts: accounts,
    chainId: parseInt(MAINNET_ID || '') || undefined,
    forking: {
      url: MAINNET_FORK,
      blockNumber: parseInt(MAINNET_FORK_BLOCK || '') || undefined,
    },
  };
}

if (PRIVATE_KEY) {
  config.networks!.bsc_testnet = {
    url: 'https://bsc-testnet.public.blastapi.io',
    chainId: 97,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
  };

  config.networks!.bsc_mainnet = {
    url: 'https://bsc-dataseed.binance.org/',
    chainId: 56,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 3 * 1e9,
  };

  config.networks!.bsc_staging = {
    url: 'https://bsc-dataseed.binance.org/',
    chainId: 56,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 3 * 1e9,
  };

  config.networks!.avalanche_fuji = {
    url: 'https://api.avax-test.network/ext/bc/C/rpc',
    chainId: 43113,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
  };

  config.networks!.avalanche_mainnet = {
    url: 'https://avalanche-c-chain.publicnode.com',
    chainId: 43114,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 30 * 1e9,
  };

  config.networks!.fantom_mainnet = {
    url: 'https://rpc.ftm.tools/',
    chainId: 250,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 50 * 1e9,
  };

  config.networks!.arbitrum_mainnet = {
    url: 'https://arb1.arbitrum.io/rpc',
    chainId: 42161,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 0.1 * 1e9,
  };

  config.networks!.arbitrum_rinkeby = {
    url: 'https://rinkeby.arbitrum.io/rpc',
    chainId: 421611,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 0.1 * 1e9,
  };

  config.networks!.cronos_mainnet = {
    url: 'https://evm-cronos.crypto.org',
    chainId: 25,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 5000 * 1e9,
  };

  config.networks!.aurora_mainnet = {
    url: 'https://mainnet.aurora.dev/',
    chainId: 1313161554,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 1 * 1e9,
  };

  config.networks!.aurora_testnet = {
    url: 'https://testnet.aurora.dev/',
    chainId: 1313161555,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 1 * 1e9,
  };

  config.networks!.klaytn_mainnet = {
    url: 'https://public-node-api.klaytnapi.com/v1/cypress',
    chainId: 8217,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 250 * 1e9,
  };

  config.networks!.klaytn_testnet = {
    url: 'https://api.baobab.klaytn.net:8651',
    chainId: 1001,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 250 * 1e9,
  };

  config.networks!.optimism_mainnet = {
    url: `https://mainnet.optimism.io/`,
    chainId: 10,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 0.1 * 1e9,
  };

  config.networks!.optimism_testnet = {
    url: `https://goerli.optimism.io/`,
    chainId: 420,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 0.001 * 1e9,
  };

  config.networks!.eth_mainnet = {
    url: `https://eth-mainnet.public.blastapi.io`,
    chainId: 1,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 18 * 1e9,
  };

  config.networks!.eth_goerli = {
    url: `https://rpc.ankr.com/eth_goerli`,
    chainId: 5,
    accounts: [PRIVATE_KEY],
    timeout: 2000,
    gasPrice: 20 * 1e9,
  };

  config.networks!.linea_goerli = {
    url: `https://rpc.goerli.linea.build`,
    chainId: 59140,
    accounts: [PRIVATE_KEY],
    timeout: 2000,
    gasPrice: 5 * 1e9,
  };

  config.networks!.linea_mainnet = {
    url: `https://rpc.linea.build`,
    chainId: 59144,
    accounts: [PRIVATE_KEY],
    timeout: 2000,
    gasPrice: 1.65 * 1e9,
  };

  config.networks!.base_mainnet = {
    url: `https://mainnet.base.org`,
    chainId: 8453,
    accounts: [PRIVATE_KEY],
    timeout: 60000,
    gasPrice: 0.0025 * 1e9,
  };

  config.networks!.sonic_testnet = {
    url: 'https://rpc.blaze.soniclabs.com',
    chainId: 57054,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 13 * 1e9,
  };

  config.networks!.sonic_mainnet = {
    url: 'https://sonic-rpc.publicnode.com:443',
    chainId: 146,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 70 * 1e9,
  };

  config.networks!.berachain_mainnet = {
    url: 'https://rpc.berachain.com',
    chainId: 80094,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 70 * 1e9,
  };
}

if (PRIVATE_KEY && INFURA_API_KEY) {
  config.networks!.polygon_mainnet = {
    url: `https://polygon.rpc.blxrbdn.com`,
    chainId: 137,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 150 * 1e9,
  };

  config.networks!.polygon_staging = {
    url: `https://polygon-mainnet.infura.io/v3/${INFURA_API_KEY}`,
    chainId: 137,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 35 * 1e9,
  };

  config.networks!.polygon_mumbai = {
    url: `https://rpc.ankr.com/polygon_mumbai`,
    chainId: 80001,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 2 * 1e9,
  };

  config.networks!.eth_kovan = {
    url: `https://kovan.infura.io/v3/${INFURA_API_KEY}`,
    chainId: 42,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
  };

  config.networks!.eth_rinkeby = {
    url: `https://rinkeby.infura.io/v3/${INFURA_API_KEY}`,
    chainId: 4,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 10 * 1e9,
  };

  config.networks!.eth_ropsten = {
    url: `https://ropsten.infura.io/v3/${INFURA_API_KEY}`,
    chainId: 3,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 15 * 1e9,
  };

  config.networks!.eth_mainnet = {
    url: `https://mainnet.infura.io/v3/${INFURA_API_KEY}`,
    chainId: 1,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 13 * 1e9,
  };

  config.networks!.sonic_testnet = {
    url: 'https://rpc.blaze.soniclabs.com',
    chainId: 57054,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 13 * 1e9,
  };

  config.networks!.sonic_mainnet = {
    url: 'https://sonic-rpc.publicnode.com:443',
    chainId: 146,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 70 * 1e9,
  };
  config.networks!.berachain_mainnet = {
    url: 'https://rpc.berachain.com',
    chainId: 80094,
    accounts: [PRIVATE_KEY],
    timeout: 20000,
    gasPrice: 70 * 1e9,
  };
}

export default config;
