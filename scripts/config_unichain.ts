import {commonPlatformWallets, IConfig} from './config_utils';

export const UnichainConfig: Record<string, IConfig> = {
  unichain_mainnet: {
    autoVerifyContract: true,
    tokens: {},
    //remember to check if this compatible w/ weth that dex used
    wNative: '0x4200000000000000000000000000000000000006',

    kyberSwapV3: {
      router: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
    },

    okx: {
      router: '0xA3d7C702e6Fa835504B4a9649F422d1DdC6995E3',
      okxTokenApprove: '0x2e28281Cf3D58f475cebE27bec4B8a23dFC7782c',
    },

    uniswapV3: {
      routers: [
        '0x73855d06DE49d0fe4A9c42636Ba96c62da12FF9C', // univ3
      ],
    },

    uniSwapV3Bsc: {
      routers: [
        '0x73855d06DE49d0fe4A9c42636Ba96c62da12FF9C', // univ3
      ],
      // testingTokens: ['dai', 'usdt', 'usdc'],
    },

    uniswap: {
      routers: {
        univ2: {
          address: '0x284f11109359a7e1306c3e447ef14d38400063ff',
        },
      },
    },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 2530,

    diabledFetchAaveDataWrapper: true,
  },
};
