import {commonNftConfig, commonPlatformWallets, IConfig} from './config_utils';

export const EthConfig: Record<string, IConfig> = {
  eth_mainnet: {
    autoVerifyContract: true,

    tokens: {
      dai: {symbol: 'dai', address: '0x6b175474e89094c44da98b954eedeac495271d0f', usdRate: 1},
      usdc: {symbol: 'usdc', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', usdRate: 1},
      usdt: {symbol: 'usdt', address: '0xdac17f958d2ee523a2206206994597c13d831ec7', usdRate: 1},
      knc: {symbol: 'knc', address: '0xdefa4e8a7bcba345f687a2f1456f5edd9ce97202', usdRate: 2},
    },

    wNative: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',

    // Uniswap & clones
    uniswap: {
      routers: {
        univ2: {
          address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
          testingTokens: ['dai', 'usdt', 'usdc'],
        },
        sushiswap: {
          address: '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f',
        },
      },
    },

    uniswapV3: {
      routers: [
        '0xe592427a0aece92de3edee1f18e0157c05861564', // univ3
      ],
      testingTokens: ['dai', 'usdt', 'usdc'],
    },

    kyberDmm: {
      router: '0x1c87257f5e8609940bc751a07bb085bb7f8cdbe6',
      testingTokens: ['dai', 'usdt', 'usdc'],
    },

    oneInch: {
      router: '0x11111112542d85b3ef69ae05771c2dccff4faa26',
    },

    kyberDmmV2: {
      router: '0x1Fc3607fa67B58DedDB0fAf7a116F417a20C551c',
      aggregationExecutor: '0x276e31882AD6C784858CdE5770B21eE09d79b744',
    },

    kyberSwapV2: {
      router: '0xdf1a1b60f2d438842916c0adc43748768353ec25',
      aggregationExecutor: '0xd12bcdfb9a39be79da3bdf02557efdcd5ca59e77',
      testingTokens: ['usdc'],
    },

    openOcean: {
      router: '0x6352a56caadC4F1E25CD6c75970Fa768A3304e64',
    },

    kyberSwapV3: {
      router: '0x617Dee16B86534a5d792A4d7A62FB491B544111E',
      testingTokens: ['usdc'],
    },

    uniswapUniversalRouter: {
      swapProxy: '0x0000000085E102724e78eCd2F45DC9cA239Affad',
      universalRouter: '0x66a9893cC07D91D95644AEDD05D03f95e1dBA8Af',
    },

    // Compound
    compound: {
      compTroller: '0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b',
      cNative: '0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5',
      // empty array for the full market data
      cTokens: [
        '0x6c8c6b02e7b2be14d4fa6022dfd6d75921d90e4e', // cBAT
        '0x70e36f6bf80a52b3b46b3af8e106cc0ed743e8e4', // cCOMP
        '0x5d3a536e4d6dbd6114cc1ead35777bab948e3643', // cDAI
        '0x158079ee67fce2f58472a96584a73c7ab9ac95c1', // cREP
        '0xf5dce57282a584d2746faf1593d3121fcac444dc', // cSAI
        '0x35a18000230da775cac24873d00ff85bccded550', // cUNI
        '0x39aa39c021dfbae8fac545936693ac917d5e7563', // cUSDC
        '0xf650c3d88d12db855b8bf7d11be6c55a4e07dcc9', // cUSDT
        '0xc11b1268c1a384e55c48c2391d8d480264a3a7f4', // cWBTC
        '0xb3319f5d18bc0d84dd1b4825dcde5d5f7266d407', // cZRX
      ],
    },

    aaveV1: {
      poolV1: '0x398ec7346dcd622edc5ae82352f02be94c62d119',
      poolCoreV1: '0x3dfd23a6c5e8bbcfc9581d2e864a68feb6a076d3',
      referralCode: 157,
      tokens: [
        '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', // aave
        '0xba100000625a3754423978a60c9317c58a424e3d', // bal
        '0x0d8775f648430679a709e98d2b0cb6250d2887ef', // bat
        '0x4Fabb145d64652a948d72533023f6E7A623C7C53', // busd
        '0xD533a949740bb3306d119CC777fa900bA034cd52', // crv
        '0x6b175474e89094c44da98b954eedeac495271d0f', // dai
        '0xF629cBd94d3791C9250152BD8dfBDF380E2a3B9c', // enj
        '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd', // gusd
        '0xdd974d5c2e2928dea5f71b9825b8b646686bd200', // knc
        '0x514910771af9ca656af840dff83e8264ecf986ca', // link
        '0x0F5D2fB29fb7d3CFeE444a200298f468908cC942', // mana
        '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', // mkr
        '0x408e41876cCCDC0F92210600ef50372656052a38', // ren
        '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F', // snx
        '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51', // susd
        '0x0000000000085d4780B73119b644AE5ecd22b376', // tusd
        '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // uni
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // usdc
        '0xdAC17F958D2ee523a2206206994597C13D831ec7', // usdt
        '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // wbtc
        '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // weth
        '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e', // yfi
        '0xE41d2489571d322189246DaFA5ebDe1F4699F498', // zrx
        '0x80fB784B7eD66730e8b1DBd9820aFD29931aab03', // lend
      ],
    },

    aaveV2: {
      poolV2: '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9',
      provider: '0x057835ad21a177dbdd3090bb1cae03eacf78fc6d',
      weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      referralCode: 157,
      // empty array for the full market data
      tokens: [
        '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', // aave
        '0xba100000625a3754423978a60c9317c58a424e3d', // bal
        '0x0d8775f648430679a709e98d2b0cb6250d2887ef', // bat
        '0x4Fabb145d64652a948d72533023f6E7A623C7C53', // busd
        '0xD533a949740bb3306d119CC777fa900bA034cd52', // crv
        '0x6b175474e89094c44da98b954eedeac495271d0f', // dai
        '0xF629cBd94d3791C9250152BD8dfBDF380E2a3B9c', // enj
        '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd', // gusd
        '0xdd974d5c2e2928dea5f71b9825b8b646686bd200', // knc
        '0x514910771af9ca656af840dff83e8264ecf986ca', // link
        '0x0F5D2fB29fb7d3CFeE444a200298f468908cC942', // mana
        '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', // mkr
        '0x408e41876cCCDC0F92210600ef50372656052a38', // ren
        '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F', // snx
        '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51', // susd
        '0x0000000000085d4780B73119b644AE5ecd22b376', // tusd
        '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // uni
        '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // usdc
        '0xdAC17F958D2ee523a2206206994597C13D831ec7', // usdt
        '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // wbtc
        '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // weth
        '0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272', // xsushi
        '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e', // yfi
        '0xE41d2489571d322189246DaFA5ebDe1F4699F498', // zrx
      ],
    },

    // aaveAMM: {
    //   poolV2: '0x7937d4799803fbbe595ed57278bc4ca21f3bffcb',
    //   provider: '0xc443AD9DDE3cecfB9dfC5736578f447aFE3590ba',
    //   weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    //   referralCode: 157,
    //   tokens: [
    //     '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // weth
    //     '0x6B175474E89094C44Da98b954EedeAC495271d0F', // dai
    //     '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // usdc
    //     '0xdAC17F958D2ee523a2206206994597C13D831ec7', // usdt
    //     '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // wbtc
    //     '0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11', // uniDaiEth
    //     '0xBb2b8038a1640196FbE3e38816F3e67Cba72D940', // uniWbtcWeth
    //     '0xDFC14d2Af169B0D36C4EFF567Ada9b2E0CAE044f', // uniAaveWeth
    //     '0xB6909B960DbbE7392D405429eB2b3649752b4838', // uniBatWeth
    //     '0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5', // uniDaiUsdc
    //     '0x3dA1313aE46132A397D90d95B1424A9A7e3e0fCE', // uniCrvWeth
    //     '0xa2107FA5B38d9bbd2C461D6EDf11B11A50F6b974', // uniLinkWeth
    //     '0xC2aDdA861F89bBB333c90c492cB837741916A225', // uniMkrWeth
    //     '0x8Bd1661Da98EBDd3BD080F0bE4e6d9bE8cE9858c', // uniRenWeth
    //     '0x43AE24960e5534731Fc831386c07755A2dc33D47', // uniSnxWeth
    //     '0xd3d2E2692501A5c9Ca623199D38826e513033a17', // uniUniWeth
    //     '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc', // uniUsdcWeth
    //     '0x004375Dff511095CC5A197A54140a24eFEF3A416', // uniWbtcUsdc
    //     '0x2fDbAdf3C4D5A8666Bc06645B8358ab803996E28', // uniYfiWeth
    //     '0x1efF8aF5D577060BA4ac8A29A13525bb0Ee2A3D5', // bptWbtcWeth
    //     '0x59A19D8c652FA0284f44113D0ff9aBa70bd46fB4', // bptBalWeth
    //   ],
    // },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 3000,
  },

  eth_goerli: {
    autoVerifyContract: true,

    tokens: {
      usdc: {symbol: 'usdc', address: '0xA2025B15a1757311bfD68cb14eaeFCc237AF5b43', usdRate: 1},
    },

    wNative: '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',

    openOcean: {
      router: '0x6352a56caadC4F1E25CD6c75970Fa768A3304e64',
    },

    // Uniswap & clones
    uniswap: {
      routers: {
        univ2: {
          address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        },
      },
    },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 5, // swap 5 eth each for every token
  },

  eth_ropsten: {
    autoVerifyContract: true,

    tokens: {
      dai: {symbol: 'dai', address: '0xad6d458402f60fd3bd25163575031acdce07538d', usdRate: 1},
    },

    wNative: '0xc778417e063141139fce010982780140aa0cd5ab',

    // Uniswap & clones
    uniswap: {
      routers: {
        univ2: {
          address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        },
        sushiswap: {
          address: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
        },
      },
    },

    uniswapV3: {
      routers: [
        '0xe592427a0aece92de3edee1f18e0157c05861564', // univ3
      ],
    },

    kyberProxy: {
      proxy: '0xd719c34261e099Fdb33030ac8909d5788D3039C4',
    },

    kyberDmm: {
      router: '0x96E8B9E051c81661C36a18dF64ba45F86AC80Aae',
    },

    kyberSwapV2: {
      router: '0xdf1a1b60f2d438842916c0adc43748768353ec25',
      aggregationExecutor: '0xd12bcdfb9a39be79da3bdf02557efdcd5ca59e77',
      testingTokens: ['usdc'],
    },

    // Compound
    compound: {
      compTroller: '0xcfa7b0e37f5AC60f3ae25226F5e39ec59AD26152',
      cNative: '0x859e9d8a4edadfEDb5A2fF311243af80F85A91b8',
      // empty array for the full market data
      cTokens: [
        '0xaF50a5A6Af87418DAC1F28F9797CeB3bfB62750A', // cBAT
        '0x70014768996439F71C041179Ffddce973a83EEf2', // cCOMP
        '0xbc689667C13FB2a04f09272753760E38a95B998C', // cDAI
        '0x2862065D57749f1576F48eF4393eb81c45fC2d88', // cREP
        '0x7Ac65E0f6dBA0EcB8845f17d07bF0776842690f8', // cSAI
        '0x65280b21167BBD059221488B7cBE759F9fB18bB5', // cUNI
        '0x2973e69b20563bcc66dC63Bde153072c33eF37fe', // cUSDC
        '0xF6958Cf3127e62d3EB26c79F4f45d3F3b2CcdeD4', // cUSDT
        '0x541c9cB0E97b77F142684cc33E8AC9aC17B1990F', // cWBTC
        '0x6B8b0D7875B4182Fb126877023fB93b934dD302A', // cZRX
      ],
    },

    // aaveV1: {
    //   poolV1: '0x398ec7346dcd622edc5ae82352f02be94c62d119',
    //   poolCoreV1: '0x3dfd23a6c5e8bbcfc9581d2e864a68feb6a076d3',
    //   referralCode: 157,
    //   tokens: [
    //     '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', // aave
    //     '0xba100000625a3754423978a60c9317c58a424e3d', // bal
    //     '0x0d8775f648430679a709e98d2b0cb6250d2887ef', // bat
    //     '0x4Fabb145d64652a948d72533023f6E7A623C7C53', // busd
    //     '0xD533a949740bb3306d119CC777fa900bA034cd52', // crv
    //     '0x6b175474e89094c44da98b954eedeac495271d0f', // dai
    //     '0xF629cBd94d3791C9250152BD8dfBDF380E2a3B9c', // enj
    //     '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd', // gusd
    //     '0xdd974d5c2e2928dea5f71b9825b8b646686bd200', // knc
    //     '0x514910771af9ca656af840dff83e8264ecf986ca', // link
    //     '0x0F5D2fB29fb7d3CFeE444a200298f468908cC942', // mana
    //     '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', // mkr
    //     '0x408e41876cCCDC0F92210600ef50372656052a38', // ren
    //     '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F', // snx
    //     '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51', // susd
    //     '0x0000000000085d4780B73119b644AE5ecd22b376', // tusd
    //     '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // uni
    //     '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // usdc
    //     '0xdAC17F958D2ee523a2206206994597C13D831ec7', // usdt
    //     '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // wbtc
    //     '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // weth
    //     '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e', // yfi
    //     '0xE41d2489571d322189246DaFA5ebDe1F4699F498', // zrx
    //   ],
    // },

    // aaveV2: {
    //   poolV2: '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9',
    //   provider: '0x057835ad21a177dbdd3090bb1cae03eacf78fc6d',
    //   weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    //   referralCode: 157,
    //   // empty array for the full market data
    //   tokens: [
    //     '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', // aave
    //     '0xba100000625a3754423978a60c9317c58a424e3d', // bal
    //     '0x0d8775f648430679a709e98d2b0cb6250d2887ef', // bat
    //     '0x4Fabb145d64652a948d72533023f6E7A623C7C53', // busd
    //     '0xD533a949740bb3306d119CC777fa900bA034cd52', // crv
    //     '0x6b175474e89094c44da98b954eedeac495271d0f', // dai
    //     '0xF629cBd94d3791C9250152BD8dfBDF380E2a3B9c', // enj
    //     '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd', // gusd
    //     '0xdd974d5c2e2928dea5f71b9825b8b646686bd200', // knc
    //     '0x514910771af9ca656af840dff83e8264ecf986ca', // link
    //     '0x0F5D2fB29fb7d3CFeE444a200298f468908cC942', // mana
    //     '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', // mkr
    //     '0x408e41876cCCDC0F92210600ef50372656052a38', // ren
    //     '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F', // snx
    //     '0x57Ab1ec28D129707052df4dF418D58a2D46d5f51', // susd
    //     '0x0000000000085d4780B73119b644AE5ecd22b376', // tusd
    //     '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // uni
    //     '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // usdc
    //     '0xdAC17F958D2ee523a2206206994597C13D831ec7', // usdt
    //     '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', // wbtc
    //     '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // weth
    //     '0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272', // xsushi
    //     '0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e', // yfi
    //     '0xE41d2489571d322189246DaFA5ebDe1F4699F498', // zrx
    //   ],
    // },

    // aaveAMM: {
    //   poolV2: '0x7937d4799803fbbe595ed57278bc4ca21f3bffcb',
    //   provider: '0xc443AD9DDE3cecfB9dfC5736578f447aFE3590ba',
    //   weth: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    //   referralCode: 157,
    //   tokens: [
    //     '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // weth
    //     '0x6B175474E89094C44Da98b954EedeAC495271d0F', // dai
    //     '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // usdc
    //     '0xdAC17F958D2ee523a2206206994597C13D831ec7', // usdt
    //     '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // wbtc
    //     '0xA478c2975Ab1Ea89e8196811F51A7B7Ade33eB11', // uniDaiEth
    //     '0xBb2b8038a1640196FbE3e38816F3e67Cba72D940', // uniWbtcWeth
    //     '0xDFC14d2Af169B0D36C4EFF567Ada9b2E0CAE044f', // uniAaveWeth
    //     '0xB6909B960DbbE7392D405429eB2b3649752b4838', // uniBatWeth
    //     '0xAE461cA67B15dc8dc81CE7615e0320dA1A9aB8D5', // uniDaiUsdc
    //     '0x3dA1313aE46132A397D90d95B1424A9A7e3e0fCE', // uniCrvWeth
    //     '0xa2107FA5B38d9bbd2C461D6EDf11B11A50F6b974', // uniLinkWeth
    //     '0xC2aDdA861F89bBB333c90c492cB837741916A225', // uniMkrWeth
    //     '0x8Bd1661Da98EBDd3BD080F0bE4e6d9bE8cE9858c', // uniRenWeth
    //     '0x43AE24960e5534731Fc831386c07755A2dc33D47', // uniSnxWeth
    //     '0xd3d2E2692501A5c9Ca623199D38826e513033a17', // uniUniWeth
    //     '0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc', // uniUsdcWeth
    //     '0x004375Dff511095CC5A197A54140a24eFEF3A416', // uniWbtcUsdc
    //     '0x2fDbAdf3C4D5A8666Bc06645B8358ab803996E28', // uniYfiWeth
    //     '0x1efF8aF5D577060BA4ac8A29A13525bb0Ee2A3D5', // bptWbtcWeth
    //     '0x59A19D8c652FA0284f44113D0ff9aBa70bd46fB4', // bptBalWeth
    //   ],
    // },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 5, // swap 5 eth each for every token

    nft: {
      ...commonNftConfig,
      uri: 'https://dev-krystal-api.knstats.com/ropsten/nft/',
      name: 'Krystal Collectibles Test',
    },

    proxyAdminMultisig: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  },

  eth_rinkeby: {
    autoVerifyContract: true,

    tokens: {
      dai: {symbol: 'dai', address: '0x95b58a6bff3d14b7db2f5cb5f0ad413dc2940658', usdRate: 1},
    },

    wNative: '0xc778417e063141139fce010982780140aa0cd5ab',

    // Uniswap & clones
    uniswap: {
      routers: {
        univ2: {
          address: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        },
      },
    },

    supportedWallets: commonPlatformWallets,
    nativeUsdRate: 3000,

    nft: {
      ...commonNftConfig,
    },
  },
};
