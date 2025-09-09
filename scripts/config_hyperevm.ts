import {commonPlatformWallets, IConfig} from './config_utils';

export const HyperevmConfig: Record<string, IConfig> = {
  hyperevm_mainnet: {
    autoVerifyContract: true,
    tokens: {},
    //remember to check if this compatible w/ weth that dex used
    wNative: '0x5555555555555555555555555555555555555555',

    kyberSwapV3: {
      router: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
    },

    uniswapV3: {
      routers: [
        '0x1EbDFC75FfE3ba3de61E7138a3E8706aC841Af9B', // ProjectX
      ],
    },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 55,

    diabledFetchAaveDataWrapper: true,
  },

  hyperevm_testnet: {
    autoVerifyContract: true,
    tokens: {},
    //remember to check if this compatible w/ weth that dex used
    wNative: '0x5555555555555555555555555555555555555555',

    kyberSwapV3: {
      router: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
    },

    uniswapV3: {
      routers: [
        '0x1EbDFC75FfE3ba3de61E7138a3E8706aC841Af9B', // ProjectX
      ],
    },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 55,

    diabledFetchAaveDataWrapper: true,
  },
};
