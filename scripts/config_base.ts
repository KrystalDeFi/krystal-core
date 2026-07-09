import {commonPlatformWallets, IConfig} from './config_utils';

export const BaseConfig: Record<string, IConfig> = {
  base_mainnet: {
    autoVerifyContract: true,
    tokens: {},
    //remember to check if this compatible w/ weth that dex used
    wNative: '0x4200000000000000000000000000000000000006',

    uniSwapV3Bsc: {
      routers: [
        '0x2626664c2603336E57B271c5C0b26F421741e481', // univ3
      ],
      // testingTokens: ['dai', 'usdt', 'usdc'],
    },

    kyberSwapV3: {
      router: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
    },

    okx: {
      router: '0x6b2c0c7be2048daa9b5527982c29f48062b34d58',
      okxTokenApprove: '0x57df6092665eb6058DE53939612413ff4B09114E',
    },

    uniswapUniversalRouter: {
      swapProxy: '0x0000000085E102724e78eCd2F45DC9cA239Affad',
      universalRouter: '0x6fF5693b99212Da76ad316178A184AB56D299b43',
    },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 3385,

    diabledFetchAaveDataWrapper: true,
  },
};
