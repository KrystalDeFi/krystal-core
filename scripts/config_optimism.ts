import {commonNftConfig, commonPlatformWallets, IConfig} from './config_utils';

export const OptimismConfig: Record<string, IConfig> = {
  optimism_mainnet: {
    autoVerifyContract: true,

    tokens: {
      usdc: {symbol: 'usdc', address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', usdRate: 1},
      dai: {symbol: 'dai', address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', usdRate: 1},
      op: {symbol: 'op', address: '0x4200000000000000000000000000000000000042', usdRate: 2},
      weth: {symbol: 'weth', address: '0x4200000000000000000000000000000000000006', usdRate: 1500},
    },

    wNative: '0x4200000000000000000000000000000000000006',

    velodrome: {
      routers: {
        velodrome: {
          address: '0x9c12939390052919aF3155f41Bf4160Fd3666A6f',
          testingTokens: ['usdc', 'dai', 'op', 'weth'],
        },
      },
      stablecoins: [
        '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', // usdt
        '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', // usdc
        '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', // dai
        '0x8c6f28f2F1A3C87F0f938b96d27520d9751ec8d9', // susd
        '0x8aE125E8653821E851F12A49F7765db9a9ce7384', // dola
        '0x73cb180bf0521828d8849bc8CF2B920918e23032', // usdplus
        '0xdFA46478F9e5EA86d57387849598dbFB2e964b02', // mai
        '0xbfD291DA8A403DAAF7e5E9DC1ec0aCEaCd4848B9', // usx
        '0xc40F949F8a4e094D1b49a23ea9241D289B7b2819', // lusd
        '0x2E3D870790dC77A83DD1d18184Acc7439A53f475', // frax
        '0xCB8FA9a76b8e203D8C3797bF438d8FB81Ea3326A', // alusd
        '0x9485aca5bbBE1667AD97c7fE7C4531a624C8b1ED', // ageur
        '0xB0B195aEFA3650A6908f15CdaC7D92F8a5791B0B', // bob
      ],
    },

    openOcean: {
      router: '0x6352a56caadC4F1E25CD6c75970Fa768A3304e64',
    },

    okx: {
      router: '0xDd5E9B947c99Aa60bab00ca4631Dce63b49983E7',
      okxTokenApprove: '0x68D6B739D2020067D1e2F713b999dA97E4d54812',
    },

    kyberSwapV3: {
      router: '0x617Dee16B86534a5d792A4d7A62FB491B544111E',
    },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 1500,
  },
};
