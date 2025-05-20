import {commonPlatformWallets, IConfig} from './config_utils';

export const RoninConfig: Record<string, IConfig> = {
  ronin_mainnet: {
    diabledFetchAaveDataWrapper: true,
    autoVerifyContract: true,

    tokens: {},

    wNative: '0xe514d9deb7966c8be0ca922de8a064264ea6bcd4',

    kyberSwapV3: {
      router: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
    },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 0.7,
  },
};
