export interface IAaveV2Config {
  poolV2: string;
  provider: string;
  weth: string;
  referralCode: number;
  tokens: string[];
}
export interface IConfig {
  autoVerifyContract: boolean;

  // mostly used for testing purpose
  tokens: Record<
    string,
    {
      symbol: string;
      address: string;
      usdRate: number; // Should always be interger
    }
  >;

  // wrapped native token (wEth/wBnb ..)
  //remember to check if this compatible w/ weth that dex used
  wNative: string;

  // Uniswap or clones
  uniswap?: {
    routers: Record<
      string,
      {
        address: string;
        testingTokens?: string[];
      }
    >;
    customSelectors?: Record<
      string,
      {
        swapFromEth: string;
        swapToEth: string;
      }
    >;
  };

  uniswapV3?: {
    routers: string[];
    testingTokens?: string[];
  };

  kyberProxy?: {
    proxy: string;
    testingTokens?: string[];
  };

  kyberDmm?: {
    router: string;
    testingTokens?: string[];
  };

  oneInch?: {
    router: string;
    testingTokens?: string[];
  };

  kyberDmmV2?: {
    router: string;
    aggregationExecutor: string;
    testingTokens?: string[];
  };

  openOcean?: {
    router: string;
    testingTokens?: string[];
  };

  okx?: {
    router: string;
    okxTokenApprove: string;
    testingTokens?: string[];
  };

  kyberSwapV2?: {
    router: string;
    aggregationExecutor: string;
    testingTokens?: string[];
  };

  kyberSwapV3?: {
    router: string;
    testingTokens?: string[];
  };

  uniSwapV3Bsc?: {
    routers: string[];
    testingTokens?: string[];
  };

  uniswapV4?: {
    // Universal Router addresses (one per deployment)
    routers: string[];
    testingTokens?: string[];
  };

  velodrome?: {
    routers: Record<
      string,
      {
        address: string;
        testingTokens?: string[];
      }
    >;
    stablecoins: string[];
    customSelectors?: Record<
      string,
      {
        swapFromEth: string;
        swapToEth: string;
      }
    >;
  };

  // Compound or clones
  compound?: {
    compTroller: string;
    cNative: string;
    cTokens: string[];
  };

  aaveV1?: {
    poolV1: string;
    poolCoreV1: string;
    referralCode: number;
    tokens: string[];
  };

  aaveV2?: IAaveV2Config;

  aaveAMM?: IAaveV2Config;

  supportedWallets: string[];

  // Should always be interger
  nativeUsdRate: number;

  nft?: {
    enabled?: boolean;
    name: string;
    symbol: string;
    uri: string;
  };

  // For proxy admin
  proxyAdminMultisig?: string;
  // For managing the config and admin jobs
  adminMultisig?: string;
  // For maintaining, minting and some executing jobs
  maintainerMultisig?: string;

  // For staging contracts, which doesn't need a full settings
  disableProxy?: boolean;

  diabledFetchAaveDataWrapper?: boolean;
}

export const commonPlatformWallets = [
  '0xa1738F8DD7c42cd4175CcdCa79Af89b3EC7b68E9', // android
  '0x5250b8202AEBca35328E2c217C687E894d70Cd31', // ios
  '0x168E4c3AC8d89B00958B6bE6400B066f0347DDc9', // web
];

export const commonNftConfig = {
  enabled: true,
  name: 'Krystal Collectibles',
  symbol: 'KRYS',
  uri: 'https://api.krystal.app/ethereum/nft/',
};
