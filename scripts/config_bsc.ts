import {commonNftConfig, commonPlatformWallets, IConfig} from './config_utils';

export const BscConfig: Record<string, IConfig> = {
  bsc_mainnet: {
    autoVerifyContract: true,
    tokens: {
      busc: {symbol: 'busd', address: '0xe9e7cea3dedca5984780bafc599bd69add087d56', usdRate: 1},
      dai: {symbol: 'dai', address: '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3', usdRate: 1},
      usdc: {symbol: 'usdc', address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', usdRate: 1},
      eth: {symbol: 'eth', address: '0x2170ed0880ac9a755fd29b2688956bd959f933f8', usdRate: 3500},
    },
    wNative: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',

    // Pancake swap
    uniswap: {
      routers: {
        pancakeV2: {
          address: '0x10ed43c718714eb63d5aa57b78b54704e256024e',
        },
        pancakeV1: {
          address: '0x05ff2b0db69458a0750badebc4f9e13add608c7f',
        },
        sushiswap: {
          address: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
        },
        apeswap: {
          address: '0xcF0feBd3f17CEf5b47b0cD257aCf6025c5BFf3b7',
        },
        mdex: {
          address: '0x7DAe51BD3E3376B8c7c4900E9107f12Be3AF1bA8',
        },
        babyswap: {
          address: '0x325E343f1dE602396E256B67eFd1F61C3A6B38Bd',
        },
        bakeryswap: {
          address: '0xCDe540d7eAFE93aC5fE6233Bee57E1270D3E330F',
        },
      },
      customSelectors: {
        // bakeryswap
        '0xCDe540d7eAFE93aC5fE6233Bee57E1270D3E330F': {
          swapFromEth: 'swapExactBNBForTokensSupportingFeeOnTransferTokens(uint256,address[],address,uint256)',
          swapToEth: 'swapExactTokensForBNBSupportingFeeOnTransferTokens(uint256,uint256,address[],address,uint256)',
        },
      },
    },

    kyberDmm: {
      router: '0x78df70615ffc8066cc0887917f2Cd72092C86409',
    },

    kyberDmmV2: {
      router: '0x1Fc3607fa67B58DedDB0fAf7a116F417a20C551c',
      aggregationExecutor: '0x276e31882AD6C784858CdE5770B21eE09d79b744',
      testingTokens: ['knc'],
    },

    kyberSwapV2: {
      router: '0xdf1a1b60f2d438842916c0adc43748768353ec25',
      aggregationExecutor: '0xd12bcdfb9a39be79da3bdf02557efdcd5ca59e77',
      testingTokens: ['busd'],
    },

    kyberSwapV3: {
      router: '0x617Dee16B86534a5d792A4d7A62FB491B544111E',
    },

    uniSwapV3Bsc: {
      routers: ['0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2'],
      testingTokens: ['busd', 'knc'],
    },

    openOcean: {
      router: '0x6352a56caadC4F1E25CD6c75970Fa768A3304e64',
    },

    okx: {
      router: '0x9333C74BDd1E118634fE5664ACA7a9710b108Bab',
      okxTokenApprove: '0x2c34A2Fb1d0b4f55de51E1d0bDEfaDDce6b7cDD6',
    },

    uniswapUniversalRouter: {
      swapProxy: '0x0000000085E102724e78eCd2F45DC9cA239Affad',
      universalRouter: '0x1906c1d672b88cD1B9aC7593301cA990F94Eae07',
    },

    // Venus protocol
    compound: {
      compTroller: '0xfd36e2c2a6789db23113685031d7f16329158384',
      // cBNB or cETH
      cNative: '0xA07c5b74C9B40447a954e1466938b865b6BBea36',
      // https://api.venus.io/api/vToken
      // empty array for the full market data
      cTokens: [],
    },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 400,

    nft: {
      ...commonNftConfig,
      uri: 'https://api.krystal.app/bsc/nft/',
      name: 'Krystal Collectibles',
    },

    proxyAdminMultisig: '0xD84f47F60F518C37a07FC7371aC1438F989aE7dc',
    maintainerMultisig: '0x5dCB1EFD48AB4927EA9F801bdC0848bE72d23082',
  },

  bsc_staging: {
    disableProxy: true,
    autoVerifyContract: true,
    tokens: {
      busd: {symbol: 'busd', address: '0xe9e7cea3dedca5984780bafc599bd69add087d56', usdRate: 1},
      dai: {symbol: 'dai', address: '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3', usdRate: 1},
    },
    wNative: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',

    uniSwapV3Bsc: {
      routers: ['0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2'],
      testingTokens: ['busd', 'knc'],
    },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 400,

    nft: {
      ...commonNftConfig,
      uri: 'https://dev-krystal-api.knstats.com/bsc/nft/',
      name: 'Krystal Collectibles Staging',
    },

    proxyAdminMultisig: '0xD84f47F60F518C37a07FC7371aC1438F989aE7dc',
  },

  bsc_testnet: {
    autoVerifyContract: true,

    tokens: {
      busd: {symbol: 'busd', address: '0x8301f2213c0eed49a7e28ae4c3e91722919b8b47', usdRate: 1},
    },

    uniSwapV3Bsc: {
      routers: ['0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2'],
      testingTokens: ['busd', 'knc'],
    },

    wNative: '0x094616f0bdfb0b526bd735bf66eca0ad254ca81f',

    // Pancake swap
    uniswap: {
      routers: {},
    },

    kyberDmm: {
      router: '0x19395624C030A11f58e820C3AeFb1f5960d9742a',
    },

    // Compound
    compound: {
      compTroller: '0x94d1820b2D1c7c7452A163983Dc888CEC546b77D',
      cNative: '0x2E7222e51c0f6e98610A1543Aa3836E092CDe62c',
      // empty array for the full market data
      cTokens: [],
    },
    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 400,

    nft: {
      ...commonNftConfig,
      uri: 'https://staging-krystal-api.knstats.com/bsc/nft/',
      name: 'Krystal Collectibles Test',
    },

    // This is the mainnet one as gnosis doesnt support bsc-testnet, but it doesnt matter on testnet anw
    proxyAdminMultisig: '0xD84f47F60F518C37a07FC7371aC1438F989aE7dc',
  },
};
