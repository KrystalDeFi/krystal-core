import {commonPlatformWallets, IConfig} from './config_utils';

export const SonicConfig: Record<string, IConfig> = {
  sonic_mainnet: {
    autoVerifyContract: true,
    tokens: {},
    //remember to check if this compatible w/ weth that dex used
    wNative: '0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38',

    kyberSwapV3: {
      router: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
    },
    okx: {
      router: '0x79f7C6C6dc16Ed3154E85A8ef9c1Ef31CEFaEB19',
      okxTokenApprove: '0xd321ab5589d3e8fa5df985ccfef625022e2dd910',
    },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 3385,

    diabledFetchAaveDataWrapper: true,
  },
  sonic_testnet: {
    autoVerifyContract: true,
    tokens: {},
    //remember to check if this compatible w/ weth that dex used
    wNative: '0x039e2fb66102314ce7b64ce5ce3e5183bc94ad38',

    kyberSwapV3: {
      router: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
    },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 3385,

    diabledFetchAaveDataWrapper: true,
  },
};
