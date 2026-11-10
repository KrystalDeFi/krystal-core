import {commonPlatformWallets, IConfig} from './config_utils';

export const ElysiumConfig: Record<string, IConfig> = {
  elysium_mainnet: {
    autoVerifyContract: true,
    tokens: {
      usdc: {
        symbol: 'USDC',
        address: '0xb47c4c8f73f009cc0c0d3f92b388d13e293f0b65',
        usdRate: 1,
      },
    },
    //remember to check if this compatible w/ weth that dex used
    wNative: '0xbA876237B0F021A6c6D852d6c26E107997cC5E81',

    // kyberSwapV3: {
    //   router: '',
    // },

    okx: {
      router: '0x91Ab9c4B07f479D48b60AEFE8F7E31B3760C88c1',
      okxTokenApprove: '0xA32f4EC37de04ACcBB6303bC6f8C7056ed1cfefA',
    },

    uniswapUniversalRouter: {
      swapProxy: '0x0000000085E102724e78eCd2F45DC9cA239Affad',
      universalRouter: '0x1B341FDD55d56F8E08409A2C25DDFad93Eb03C1a',
    },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 55,

    diabledFetchAaveDataWrapper: true,
  },
};
