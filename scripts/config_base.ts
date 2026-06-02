import {commonPlatformWallets, IConfig} from './config_utils';

export const BaseConfig: Record<string, IConfig> = {
  base_mainnet: {
    autoVerifyContract: true,
    tokens: {
      usdc: {
        address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
        symbol: 'USDC',
        usdRate: 1,
      },
      cbbtc: {
        address: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',
        symbol: 'cbBTC',
        usdRate: 73700,
      },
    },
    //remember to check if this compatible w/ weth that dex used
    wNative: '0x4200000000000000000000000000000000000006',
    native: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',

    uniSwapV3Bsc: {
      routers: [
        '0x2626664c2603336E57B271c5C0b26F421741e481', // univ3
      ],
      // testingTokens: ['dai', 'usdt', 'usdc'],
    },

    // kyberSwapV3: {
    //   router: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
    // },

    // okx: {
    //   router: '0x6b2c0c7be2048daa9b5527982c29f48062b34d58',
    //   okxTokenApprove: '0x57df6092665eb6058DE53939612413ff4B09114E',
    // },

    uniswapV4: {
      routers: ['0xFdf682F51FE81Aa4898F0AE2163d8A55c127fbC7'],
      stateView: '0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71',
      testingTokens: ['usdc', 'cbbtc'],
    },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 2020,

    diabledFetchAaveDataWrapper: true,
  },
};
