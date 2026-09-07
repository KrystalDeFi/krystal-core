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

    uniSwapV3Bsc: {
      routers: [
        '0xCaf681a66D020601342297493863E78C959E5cb2', // univ3
      ],
    },

    uniswapV4: {
      routers: [
        {
          router: '0x8876789976decbfcbbbe364623c63652db8c0904',
          stateView: '0xf3334192d15450cdd385c8b70e03f9a6bd9e673b',
          nfpm: '0x58daec3116aae6d93017baaea7749052e8a04fa7',
        },
      ],
    },

    uniswap: {
      routers: {
        univ2: {
          address: '0x89e5db8b5aa49aa85ac63f691524311aeb649eba',
        },
      },
    },

    okx: {
      router: '0x6e2a35a7ad683cf634d91492d73bb7ff774c6919',
      okxTokenApprove: '0x42170295F1173c9e5874ea9d00c6d137E1a4f53d',
    },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 2530,

    diabledFetchAaveDataWrapper: true,
  },
};
