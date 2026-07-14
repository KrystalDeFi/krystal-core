import {commonPlatformWallets, IConfig} from './config_utils';

export const RobinhoodConfig: Record<string, IConfig> = {
  robinhood_mainnet: {
    autoVerifyContract: true,
    tokens: {},
    //remember to check if this compatible w/ weth that dex used
    wNative: '0x0bd7d308f8e1639fab988df18a8011f41eacad73',

    kyberSwapV3: {
      router: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
    },

    uniswapUniversalRouter: {
      swapProxy: '0x0000000085E102724e78eCd2F45DC9cA239Affad',
      universalRouter: '0x8876789976dEcBfCbBbe364623C63652db8C0904',
    },

    uniswapV3: {
      routers: [
        '0xCaf681a66D020601342297493863E78C959E5cb2', // univ3
      ],
    },

    uniswap: {
      routers: {
        univ2: {
          address: '0x89e5db8b5aa49aa85ac63f691524311aeb649eba',
        },
      },
    },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 2530,

    diabledFetchAaveDataWrapper: true,
  },
};
