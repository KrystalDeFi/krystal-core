import {commonPlatformWallets, IConfig} from './config_utils';

export const BerachainConfig: Record<string, IConfig> = {
  berachain_mainnet: {
    autoVerifyContract: true,
    tokens: {},
    //remember to check if this compatible w/ weth that dex used
    wNative: '0x6969696969696969696969696969696969696969',

    kyberSwapV3: {
      router: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
    },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 3385,

    diabledFetchAaveDataWrapper: true,
  },
};
