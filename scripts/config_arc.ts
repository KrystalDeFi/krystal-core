import {commonPlatformWallets, IConfig} from './config_utils';

export const ArcConfig: Record<string, IConfig> = {
  arc_mainnet: {
    autoVerifyContract: true,
    tokens: {
      usdc: {
        address: '0x3600000000000000000000000000000000000000',
        symbol: 'USDC',
        usdRate: 1,
      },
      cirBTC: {
        address: '0x171a4217b86a807a64eb94757db6849fb4bdbaa0',
        symbol: 'cirBTC',
        usdRate: 75700,
      },
    },
    //remember to check if this compatible w/ weth that dex used
    wNative: '0x3600000000000000000000000000000000000000',
    // USDC is Arc's native token, exposed at wNative via an ERC20-interface precompile - there's
    // no separate wrap contract, so swap adapters should trade wNative directly as an ERC20
    // instead of relying on a DEX router's own (unrelated/illiquid) WETH.
    nativeIsErc20: true,

    uniSwapV3Bsc: {
      routers: [
        '0x53BF6B0684Ec7eF91e1387Da3D1a1769bC5A6F77', // univ3
      ],
      // testingTokens: ['dai', 'usdt', 'usdc'],
    },

    kyberSwapV3: {
      router: '0x6131B5fae19EA4f9D964eAc0408E4408b66337b5',
    },

    okx: {
      router: '0x4E3bcCE28cAf98A143Fd8BD9e4875ccAb3E7bBE0',
      okxTokenApprove: '0x2B9899bC46Bf0eE094225995f4bD496d42f261Af',
    },

    uniswap: {
      routers: {
        univ2: {
          address: '0x1f7d7550B1b028f7571E69A784071F0205FD2EfA',
          // usdc *is* native here, so a native<->usdc pair is a self-swap (rejected by any AMM);
          // cirBTC has no pool against native on this particular router (verified on-chain via
          // the factory - only V3/V4 have real cirBTC liquidity, see uniswapV3Arc/uniswapV4Arc
          // tests). Leaving this empty until a token with genuine native-paired liquidity here
          // is added to `tokens` above.
          testingTokens: [],
        },
      },
    },

    uniswapV4: {
      routers: [
        {
          router: '0x4fcA4a51Ab4F23A7447b3284fBd7D73289A89Fb1',
          stateView: '0xF3334192D15450CdD385c8B70e03f9A6bD9E673b',
          nfpm: '0x6049c9a0e26405C0985f9E3685C87d0aE917f82B',
        },
      ],
      testingTokens: ['usdc', 'cirBTC'],
    },

    uniswapUniversalRouter: {
      swapProxy: '0x0000000085E102724e78eCd2F45DC9cA239Affad',
      universalRouter: '0x4fcA4a51Ab4F23A7447b3284fBd7D73289A89Fb1',
    },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 1,

    diabledFetchAaveDataWrapper: true,
  },
};
