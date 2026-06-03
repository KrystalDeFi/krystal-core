import {commonPlatformWallets, IConfig} from './config_utils';

export const PolygonConfig: Record<string, IConfig> = {
  polygon_mainnet: {
    autoVerifyContract: true,

    tokens: {
      quick: {symbol: 'quick', address: '0x831753dd7087cac61ab5644b308642cc1c33dc13', usdRate: 473},
      uni: {symbol: 'uni', address: '0xb33eaad8d922b1083446dc23f610c2567fb5180f', usdRate: 25},
      aave: {symbol: 'aave', address: '0xd6df932a45c0f255f85145f286ea0b292b21c90b', usdRate: 364},
      weth: {symbol: 'weth', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', usdRate: 3000},
      dai: {symbol: 'dai', address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', usdRate: 1},
      usdc: {symbol: 'usdc', address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', usdRate: 1},
      knc: {symbol: 'knc', address: '0x1c954e8fe737f99f68fa1ccda3e51ebdb291948c', usdRate: 1},
    },

    wNative: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',

    // Uniswap & clones
    uniswap: {
      routers: {
        quickswap: {
          address: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
          testingTokens: ['quick', 'uni', 'aave', 'weth', 'dai', 'usdc'],
        },
        sushiswap: {
          address: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
          testingTokens: ['dai', 'weth'],
        },
        apeswap: {
          address: '0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607',
          testingTokens: ['dai', 'weth', 'usdc'],
        },
      },
    },

    kyberDmm: {
      router: '0x546C79662E028B661dFB4767664d0273184E4dD1',
      testingTokens: ['knc'],
    },

    kyberDmmV2: {
      router: '0x1Fc3607fa67B58DedDB0fAf7a116F417a20C551c',
      aggregationExecutor: '0x276e31882AD6C784858CdE5770B21eE09d79b744',
      testingTokens: ['knc'],
    },

    kyberSwapV2: {
      router: '0xdf1a1b60f2d438842916c0adc43748768353ec25',
      aggregationExecutor: '0xd12bcdfb9a39be79da3bdf02557efdcd5ca59e77',
      testingTokens: ['usdc'],
    },

    kyberSwapV3: {
      router: '0x617Dee16B86534a5d792A4d7A62FB491B544111E',
    },

    openOcean: {
      router: '0x6352a56caadC4F1E25CD6c75970Fa768A3304e64',
    },

    oneInch: {
      router: '0x11111112542d85b3ef69ae05771c2dccff4faa26',
      testingTokens: ['weth'],
    },

    okx: {
      router: '0xF6E1B4b201e220FC3741bd7a75675ffEA25c02AD',
      okxTokenApprove: '0x3b86917369b83a6892f553609f3c2f439c184e31',
    },

    // Compound
    // compound: {
    //   compTroller: '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b',
    //   cNative: '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5',
    //   // empty array for the full market data
    //   cTokens: [],
    // },

    aaveV2: {
      poolV2: '0x8dff5e27ea6b7ac08ebfdf9eb090f32ee9a30fcf',
      provider: '0x7551b5D2763519d4e37e8B81929D336De671d46d',
      weth: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // wmatic
      referralCode: 157,
      // empty array for the full market data
      tokens: [
        '0xD6DF932A45C0f255f85145f286eA0b292B21C90B', // aave
        '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // dai
        '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // usdc
        '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // usdt
        '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', // wbtc
        '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // weth
        '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // wmatic
      ],
    },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 1,
  },

  polygon_staging: {
    autoVerifyContract: true,

    tokens: {
      quick: {symbol: 'quick', address: '0x831753dd7087cac61ab5644b308642cc1c33dc13', usdRate: 473},
      uni: {symbol: 'uni', address: '0xb33eaad8d922b1083446dc23f610c2567fb5180f', usdRate: 25},
      aave: {symbol: 'aave', address: '0xd6df932a45c0f255f85145f286ea0b292b21c90b', usdRate: 364},
      weth: {symbol: 'weth', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', usdRate: 3000},
      dai: {symbol: 'dai', address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', usdRate: 1},
      usdc: {symbol: 'usdc', address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', usdRate: 1},
      knc: {symbol: 'knc', address: '0x1c954e8fe737f99f68fa1ccda3e51ebdb291948c', usdRate: 1},
    },

    wNative: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',

    // Uniswap & clones
    uniswap: {
      routers: {
        quickswap: {
          address: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
          testingTokens: ['quick', 'uni', 'aave', 'weth', 'dai', 'usdc'],
        },
        sushiswap: {
          address: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
          testingTokens: ['dai', 'weth'],
        },
        apeswap: {
          address: '0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607',
          testingTokens: ['dai', 'weth', 'usdc'],
        },
      },
    },

    kyberDmm: {
      router: '0x546C79662E028B661dFB4767664d0273184E4dD1',
      testingTokens: ['knc'],
    },

    kyberDmmV2: {
      router: '0x1Fc3607fa67B58DedDB0fAf7a116F417a20C551c',
      aggregationExecutor: '0x276e31882AD6C784858CdE5770B21eE09d79b744',
      testingTokens: ['knc'],
    },

    oneInch: {
      router: '0x11111112542d85b3ef69ae05771c2dccff4faa26',
      testingTokens: ['weth'],
    },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 1,
  },

  polygon_mumbai: {
    autoVerifyContract: true,

    tokens: {
      // {symbol: 'quick', address: '0x831753dd7087cac61ab5644b308642cc1c33dc13'},
      // {symbol: 'uni', address: '0xb33eaad8d922b1083446dc23f610c2567fb5180f'},'
      // {symbol: 'aave', address: '0xd6df932a45c0f255f85145f286ea0b292b21c90b'},
      // {symbol: 'weth', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'},
      dai: {symbol: 'dai', address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', usdRate: 1},
      usdc: {symbol: 'usdc', address: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', usdRate: 1},
    },

    wNative: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',

    // Uniswap & clones
    uniswap: {
      routers: {
        quickswap: {
          address: '0xFCB5348111665Cf95a777f0c4FCA768E05601760',
        },
      },
    },

    // Compound
    // compound: {
    //   compTroller: '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b',
    //   cNative: '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5',
    //   // empty array for the full market data
    //   cTokens: [],
    // },

    // aaveV2: {
    //   poolV2: '0x8dff5e27ea6b7ac08ebfdf9eb090f32ee9a30fcf',
    //   provider: '0x7551b5D2763519d4e37e8B81929D336De671d46d',
    //   weth: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // wmatic
    //   referralCode: 157,
    //   // empty array for the full market data
    //   tokens: [
    //     '0xD6DF932A45C0f255f85145f286eA0b292B21C90B', // aave
    //     '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // dai
    //     '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // usdc
    //     '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', // usdt
    //     '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', // wbtc
    //     '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // weth
    //     '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // wmatic
    //   ],
    // },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 1,
  },
};
