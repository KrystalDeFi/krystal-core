import {network, ethers, run} from 'hardhat';
import {TransactionResponse} from '@ethersproject/abstract-provider';
import {NetworkConfig} from './config';
import {
  // FetchTokenBalances,
  SmartWalletImplementation,
  SmartWalletProxy,
  UniSwap,
  CompoundLending,
  UniSwapV3,
  KyberProxy,
  KyberDmm,
  AaveV1Lending,
  AaveV2Lending,
  FetchAaveDataWrapper,
  KrystalCollectibles,
  KrystalCollectiblesImpl,
  OneInch,
  KyberDmmV2,
  KyberSwapV2,
  KyberSwapV3,
  Velodrome,
  UniSwapV3Bsc,
  OpenOcean,
  Okx,
} from '../typechain';
import {Contract} from '@ethersproject/contracts';
import {IAaveV2Config} from './config_utils';
import {equalHex, sleep, zeroAddress} from '../test/helper';
import {PopulatedTransaction} from 'ethers';
import {TransactionRequest} from '@ethersproject/abstract-provider';
import {multisig} from '../hardhat.config';
import {EthersAdapter} from '@gnosis.pm/safe-core-sdk';
import {OperationType} from '@gnosis.pm/safe-core-sdk-types';
import Safe from '@gnosis.pm/safe-core-sdk';
import {ok} from 'assert';

const gasLimit = 3000000;

const networkConfig = NetworkConfig[network.name];
if (!networkConfig) {
  throw new Error(`Missing deploy config for ${network.name}`);
}

export interface KrystalContracts {
  smartWalletImplementation?: SmartWalletImplementation;
  smartWalletProxy?: SmartWalletProxy;
  // fetchTokenBalances?: FetchTokenBalances;
  fetchAaveDataWrapper?: FetchAaveDataWrapper;
  swapContracts?: {
    uniSwap?: UniSwap;
    uniSwapV3?: UniSwapV3;
    kyberProxy?: KyberProxy;
    kyberDmm?: KyberDmm;
    oneInch?: OneInch;
    kyberDmmV2?: KyberDmmV2;
    kyberSwapV2?: KyberSwapV2;
    kyberSwapV3?: KyberSwapV3;
    velodrome?: Velodrome;
    uniSwapV3Bsc?: UniSwapV3Bsc;
    openOcean?: OpenOcean;
    okx?: Okx;
  };
  lendingContracts?: {
    compoundLending?: CompoundLending;
    aaveV1?: AaveV1Lending;
    aaveV2?: AaveV2Lending;
    aaveAMM?: AaveV2Lending;
  };

  nft?: KrystalCollectibles;
  nftImplementation?: KrystalCollectiblesImpl;
}

export const deploy = async (
  existingContract: Record<string, any> | undefined = undefined,
  extraArgs: {from?: string} = {}
): Promise<KrystalContracts> => {
  const [deployer] = await ethers.getSigners();

  const deployerAddress = await deployer.getAddress();

  log(0, 'Start deploying Krystal contracts');
  log(0, '======================\n');
  let deployedContracts = await deployContracts(existingContract, multisig || deployerAddress);

  // Initialization
  // log(0, 'Updating proxy data');
  // log(0, '======================\n');
  // await updateProxy(deployedContracts, extraArgs);

  log(0, 'Updating swaps/lendings linking');
  log(0, '======================\n');
  await updateChildContracts(deployedContracts, extraArgs);

  log(0, 'Updating uniswap/clones config');
  log(0, '======================\n');
  await updateUniSwap(deployedContracts.swapContracts?.uniSwap, extraArgs);

  log(0, 'Updating uniswapV3/clones config');
  log(0, '======================\n');
  await updateUniSwapV3(deployedContracts.swapContracts?.uniSwapV3, extraArgs);
  await updateUniSwapV3(deployedContracts.swapContracts?.uniSwapV3Bsc, extraArgs);

  log(0, 'Updating kyberProxy config');
  log(0, '======================\n');
  await updateKyberProxy(deployedContracts.swapContracts?.kyberProxy, extraArgs);

  log(0, 'Updating kyberDmm config');
  log(0, '======================\n');
  await updateKyberDmm(deployedContracts.swapContracts?.kyberDmm, extraArgs);

  log(0, 'Updating oneInch config');
  log(0, '======================\n');
  await updateOneInch(deployedContracts.swapContracts?.oneInch, extraArgs);

  log(0, 'Updating openOcean config');
  log(0, '======================\n');
  await updateOpenOcean(deployedContracts.swapContracts?.openOcean, extraArgs);

  log(0, 'Updating OKX config');
  log(0, '======================\n');
  await updateOkx(deployedContracts.swapContracts?.okx, extraArgs);

  log(0, 'Updating kyberDmm config');
  log(0, '======================\n');
  await updateKyberDmmV2(deployedContracts.swapContracts?.kyberDmmV2, extraArgs);

  log(0, 'Updating kyberSwapv2 config');
  log(0, '======================\n');
  await updateKyberSwapV2(deployedContracts.swapContracts?.kyberSwapV2, extraArgs);

  log(0, 'Updating kyberSwapv3 config');
  log(0, '======================\n');
  await updateKyberSwapV3(deployedContracts.swapContracts?.kyberSwapV3, extraArgs);

  log(0, 'Updating velodrome config');
  log(0, '======================\n');
  await updateVelodrome(deployedContracts.swapContracts?.velodrome, extraArgs);

  // log(0, 'Updating compound/clones config');
  // log(0, '======================\n');
  // await updateCompoundLending(deployedContracts.lendingContracts?.compoundLending, extraArgs);

  // log(0, 'Updating aave V1 config');
  // log(0, '======================\n');
  // await updateAaveV1Lending(deployedContracts.lendingContracts?.aaveV1, extraArgs);

  // log(0, 'Updating aave V2 config');
  // log(0, '======================\n');
  // await updateAaveV2Lending(deployedContracts.lendingContracts?.aaveV2, networkConfig.aaveV2, extraArgs);

  // log(0, 'Updating aave AMM config');
  // log(0, '======================\n');
  // await updateAaveV2Lending(deployedContracts.lendingContracts?.aaveAMM, networkConfig.aaveAMM, extraArgs);

  // log(0, 'Updating NFT proxy data');
  // log(0, '======================\n');
  // await updateNftProxy(deployedContracts, extraArgs);

  // Summary
  log(0, 'Summary');
  log(0, '=======\n');

  log(0, JSON.stringify(convertToAddressObject(deployedContracts), null, 2));

  console.log('\nDeployment complete!');
  return deployedContracts;
};

deploy.dependencies = ['VerifyContracts'];

async function deployContracts(
  existingContract: Record<string, any> | undefined = undefined,
  contractAdmin: string
): Promise<KrystalContracts> {
  let step = 0;

  let smartWalletImplementation,
    smartWalletProxy,
    // fetchTokenBalances,
    fetchAaveDataWrapper,
    swapContracts,
    lendingContracts;

  if (!networkConfig.disableProxy) {
    smartWalletImplementation = (await deployContract(
      ++step,
      networkConfig.autoVerifyContract,
      'SmartWalletImplementation',
      existingContract?.['smartWalletImplementation'],
      undefined,
      contractAdmin
    )) as SmartWalletImplementation;

    // fetchTokenBalances = (await deployContract(
    //   ++step,
    //   networkConfig.autoVerifyContract,
    //   'FetchTokenBalances',
    //   existingContract?.['fetchTokenBalances'],
    //   undefined,
    //   contractAdmin
    // )) as FetchTokenBalances;

    if (!networkConfig.diabledFetchAaveDataWrapper) {
      fetchAaveDataWrapper = (await deployContract(
        ++step,
        networkConfig.autoVerifyContract,
        'FetchAaveDataWrapper',
        existingContract?.['fetchAaveDataWrapper'],
        undefined,
        contractAdmin
      )) as FetchAaveDataWrapper;
    }

    swapContracts = {
      uniSwap: !networkConfig.uniswap
        ? undefined
        : ((await deployContract(
            ++step,
            networkConfig.autoVerifyContract,
            'UniSwap',
            existingContract?.['swapContracts']?.['uniSwap'],
            undefined,
            contractAdmin,
            Object.values(networkConfig.uniswap.routers).map((c) => c.address),
            networkConfig.wNative
          )) as UniSwap),
      uniSwapV3: !networkConfig.uniswapV3
        ? undefined
        : ((await deployContract(
            ++step,
            networkConfig.autoVerifyContract,
            'UniSwapV3',
            existingContract?.['swapContracts']?.['uniSwapV3'],
            undefined,
            contractAdmin,
            networkConfig.uniswapV3.routers
          )) as UniSwapV3),
      uniSwapV3Bsc: !networkConfig.uniSwapV3Bsc
        ? undefined
        : ((await deployContract(
            ++step,
            networkConfig.autoVerifyContract,
            'UniSwapV3Bsc',
            existingContract?.['swapContracts']?.['uniSwapV3Bsc'],
            undefined,
            contractAdmin,
            networkConfig.uniSwapV3Bsc.routers
          )) as UniSwapV3Bsc),
      kyberProxy: !networkConfig.kyberProxy
        ? undefined
        : ((await deployContract(
            ++step,
            networkConfig.autoVerifyContract,
            'KyberProxy',
            existingContract?.['swapContracts']?.['kyberProxy'],
            undefined,
            contractAdmin,
            networkConfig.kyberProxy.proxy
          )) as KyberProxy),
      kyberDmm: !networkConfig.kyberDmm
        ? undefined
        : ((await deployContract(
            ++step,
            networkConfig.autoVerifyContract,
            'KyberDmm',
            existingContract?.['swapContracts']?.['kyberDmm'],
            undefined,
            contractAdmin,
            networkConfig.kyberDmm.router
          )) as KyberDmm),
      oneInch: !networkConfig.oneInch
        ? undefined
        : ((await deployContract(
            ++step,
            networkConfig.autoVerifyContract,
            'OneInch',
            existingContract?.['swapContracts']?.['oneInch'],
            undefined,
            contractAdmin,
            networkConfig.oneInch.router
          )) as OneInch),

      openOcean: !networkConfig.openOcean
        ? undefined
        : ((await deployContract(
            ++step,
            networkConfig.autoVerifyContract,
            'OpenOcean',
            existingContract?.['swapContracts']?.['openOcean'],
            undefined,
            contractAdmin,
            networkConfig.openOcean.router
          )) as OpenOcean),

      okx: !networkConfig.okx
        ? undefined
        : ((await deployContract(
            ++step,
            networkConfig.autoVerifyContract,
            'Okx',
            existingContract?.['swapContracts']?.['okx'],
            undefined,
            contractAdmin,
            networkConfig.okx.router,
            networkConfig.okx.okxTokenApprove
          )) as Okx),

      kyberDmmV2: !networkConfig.kyberDmmV2
        ? undefined
        : ((await deployContract(
            ++step,
            networkConfig.autoVerifyContract,
            'KyberDmmV2',
            existingContract?.['swapContracts']?.['kyberDmmV2'],
            undefined,
            contractAdmin,
            networkConfig.kyberDmmV2.router
          )) as KyberDmmV2),
      kyberSwapV2: !networkConfig.kyberSwapV2
        ? undefined
        : ((await deployContract(
            ++step,
            networkConfig.autoVerifyContract,
            'KyberSwapV2',
            existingContract?.['swapContracts']?.['kyberSwapV2'],
            undefined,
            contractAdmin,
            networkConfig.kyberSwapV2.router
          )) as KyberSwapV2),
      kyberSwapV3: !networkConfig.kyberSwapV3
        ? undefined
        : ((await deployContract(
            ++step,
            networkConfig.autoVerifyContract,
            'KyberSwapV3',
            existingContract?.['swapContracts']?.['kyberSwapV3'],
            undefined,
            contractAdmin,
            networkConfig.kyberSwapV3.router
          )) as KyberSwapV3),
      velodrome: !networkConfig.velodrome
        ? undefined
        : ((await deployContract(
            ++step,
            networkConfig.autoVerifyContract,
            'Velodrome',
            existingContract?.['swapContracts']?.['velodrome'],
            undefined,
            contractAdmin,
            Object.values(networkConfig.velodrome.routers).map((c) => c.address),
            Object.values(networkConfig.velodrome.stablecoins).map((c) => c),
            networkConfig.wNative
          )) as Velodrome),
    };

    lendingContracts = {
      compoundLending: (!networkConfig.compound
        ? undefined
        : await deployContract(
            ++step,
            networkConfig.autoVerifyContract,
            'CompoundLending',
            existingContract?.['lendingContracts']?.['compoundLending'],
            undefined,
            contractAdmin
          )) as CompoundLending,

      aaveV1: (!networkConfig.aaveV1
        ? undefined
        : await deployContract(
            ++step,
            networkConfig.autoVerifyContract,
            'AaveV1Lending',
            existingContract?.['lendingContracts']?.['aaveV1'],
            undefined,
            contractAdmin
          )) as AaveV1Lending,

      aaveV2: (!networkConfig.aaveV2
        ? undefined
        : await deployContract(
            ++step,
            networkConfig.autoVerifyContract,
            'AaveV2Lending',
            existingContract?.['lendingContracts']?.['aaveV2'],
            undefined,
            contractAdmin
          )) as AaveV2Lending,

      aaveAMM: (!networkConfig.aaveAMM
        ? undefined
        : await deployContract(
            ++step,
            networkConfig.autoVerifyContract,
            'AaveV2Lending',
            existingContract?.['lendingContracts']?.['aaveAMM'],
            undefined,
            contractAdmin
          )) as AaveV2Lending,
    };

    smartWalletProxy = (await deployContract(
      ++step,
      networkConfig.autoVerifyContract,
      'SmartWalletProxy',
      existingContract?.['smartWalletProxy'],
      undefined,
      contractAdmin,
      smartWalletImplementation.address,
      networkConfig.supportedWallets,
      Object.values(swapContracts)
        .filter((c) => c)
        .map((c?: Contract) => c!.address),
      Object.values(lendingContracts)
        .filter((c) => c)
        .map((c: Contract) => c.address)
    )) as SmartWalletProxy;
  }

  let nft, nftImplementation;
  if (networkConfig.nft?.enabled) {
    nftImplementation = (await deployContract(
      ++step,
      networkConfig.autoVerifyContract,
      'KrystalCollectiblesImpl',
      existingContract?.['nftImplementation'],
      undefined
    )) as KrystalCollectiblesImpl;

    let initData =
      (
        await nftImplementation.populateTransaction['initialize(string,string,string)'](
          networkConfig.nft.name,
          networkConfig.nft.symbol,
          networkConfig.nft.uri
        )
      ).data?.toString() ?? '0x';
    nft = (await deployContract(
      ++step,
      networkConfig.autoVerifyContract,
      'KrystalCollectibles',
      existingContract?.['nft'],
      'contracts/nft/KrystalCollectibles.sol:KrystalCollectibles',
      nftImplementation.address,
      networkConfig.proxyAdminMultisig ?? contractAdmin,
      initData
    )) as KrystalCollectibles;
  }

  return {
    smartWalletImplementation,
    smartWalletProxy,
    // fetchTokenBalances,
    fetchAaveDataWrapper,
    swapContracts,
    lendingContracts,
    nft,
    nftImplementation,
  };
}

async function deployContract(
  step: number,
  autoVerify: boolean,
  contractName: string,
  contractAddress: string | undefined,
  contractLocation: string | undefined,
  ...args: any[]
): Promise<Contract> {
  log(1, `${step}. Deploying '${contractName}'`);
  log(1, '------------------------------------');

  log(1, 'wait to get contract name');
  const factory = await ethers.getContractFactory(contractName);

  let contract;

  if (contractAddress) {
    log(2, `> contract already exists`);
    log(2, `> address:\t${contractAddress}`);
    // TODO: Transfer admin if needed
    contract = factory.attach(contractAddress);
  } else {
    log(1, 'wait for factory deploy');
    contract = await factory.deploy(...args);
    log(1, 'wait for contract deploy');
    const tx = await contract.deployed();
    await printInfo(tx.deployTransaction);
    log(2, `> address:\t${contract.address}`);
  }

  // Only verify new contract to save time
  if (autoVerify && !contractAddress) {
    // if (autoVerify) {
    try {
      log(3, '>> sleep first, wait for contract data to be propagated');
      await sleep(5000);
      log(3, '>> start verifying');
      await run('verify:verify', {
        address: contract.address,
        constructorArguments: args,
        contract: contractLocation,
      });
      log(3, '>> done verifying');
    } catch (e) {
      log(2, 'failed to verify contract', e);
    }
  }

  return contract;
}

async function updateProxy(
  {smartWalletProxy, smartWalletImplementation, swapContracts, lendingContracts}: KrystalContracts,
  extraArgs: {from?: string}
) {
  log(1, 'Update impl contract');
  if (!smartWalletProxy || !smartWalletImplementation) {
    log(2, 'Proxy not supported');
    return;
  }
  let currentImpl = await smartWalletProxy.implementation();
  if (currentImpl.toLowerCase() === smartWalletImplementation.address.toLowerCase()) {
    log(2, `Impl contract is already up-to-date at ${smartWalletImplementation.address}`);
  } else {
    const tx = await executeTxnOnBehalfOf(
      await smartWalletProxy.populateTransaction.updateNewImplementation(smartWalletImplementation.address, {
        gasLimit,
        ...extraArgs,
      })
    );
    await printInfo(tx);
    log(2, `Impl contract is updated from ${currentImpl} to  ${smartWalletImplementation.address}`);
  }

  log(1, 'update supported platform wallets');
  let existing = (await smartWalletProxy.getAllSupportedPlatformWallets()).map((r) => r.toLowerCase());
  let configWallets = networkConfig.supportedWallets.map((r) => r.toLowerCase());
  let toBeRemoved = existing.filter((add) => !configWallets.includes(add));
  let toBeAdded = configWallets.filter((add) => !existing.includes(add));
  await updateAddressSet(
    smartWalletProxy.populateTransaction.updateSupportedPlatformWallets,
    toBeRemoved,
    toBeAdded,
    extraArgs
  );

  log(1, 'update supported swaps');
  existing = (await smartWalletProxy.getAllSupportedSwaps()).map((r) => r.toLowerCase());
  let swaps: string[] = Object.values(swapContracts ?? {})
    .filter((c) => c)
    .map((c) => c!.address.toLowerCase());
  toBeRemoved = existing.filter((add) => !swaps.includes(add));
  toBeAdded = swaps.filter((add) => !existing.includes(add));
  await updateAddressSet(smartWalletProxy.populateTransaction.updateSupportedSwaps, toBeRemoved, toBeAdded, extraArgs);

  log(1, 'update supported lendings');
  existing = (await smartWalletProxy.getAllSupportedLendings()).map((r) => r.toLowerCase());
  let lendings: string[] = Object.values(lendingContracts ?? {})
    .filter((c) => c)
    .map((c) => c!.address.toLowerCase());
  toBeRemoved = existing.filter((add) => !lendings.includes(add));
  toBeAdded = lendings.filter((add) => !existing.includes(add));
  await updateAddressSet(
    smartWalletProxy.populateTransaction.updateSupportedLendings,
    toBeRemoved,
    toBeAdded,
    extraArgs
  );
}

async function updateNftProxy({nft, nftImplementation}: KrystalContracts, extraArgs: {from?: string}) {
  log(1, 'Update impl contract');
  if (!nft || !nftImplementation) {
    log(2, `NFT not supported`);
    return;
  }

  // Read directly from the slots. Pls refer to TransparentUpgradeableProxy
  let currentImpl = await ethers.provider.getStorageAt(
    nft.address,
    '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc'
  );
  let currentAdmin = await ethers.provider.getStorageAt(
    nft.address,
    '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103'
  );

  log(2, `currentImpl = ${currentImpl}`);
  log(2, `currentAdmin = ${currentAdmin}`);

  // bytes32 to address
  currentImpl = '0x' + currentImpl.slice(26, 66);

  if (currentImpl.toLowerCase() === nftImplementation.address.toLowerCase()) {
    log(2, `Impl contract is already up-to-date at ${nftImplementation.address}`);
  } else {
    const tx = await executeTxnOnBehalfOf(
      await nft.populateTransaction.upgradeTo(nftImplementation.address, {
        gasLimit,
        ...extraArgs,
      }),
      networkConfig.proxyAdminMultisig
    );
    await printInfo(tx);
    log(2, `Impl contract is updated from ${currentImpl} to  ${nftImplementation.address}`);
  }
}

async function updateChildContracts(
  {smartWalletProxy, swapContracts, lendingContracts}: KrystalContracts,
  extraArgs: {from?: string}
) {
  log(1, 'Linking swap contracts to proxy');
  if (!smartWalletProxy) {
    log(2, `Proxy not supported`);
    return;
  }
  let merged = {...swapContracts, ...lendingContracts};
  for (let contractName in merged) {
    // @ts-ignore maping to UniSwap to get function list
    let contract: UniSwap | undefined = merged[contractName];
    if (contract) {
      log(2, `Updating ${contractName} ${contract.address}`);
      if ((await contract.proxyContract()).toLowerCase() == smartWalletProxy.address.toLowerCase()) {
        log(2, `> Proxy contract is already up-to-date at ${smartWalletProxy.address}`);
      } else {
        const tx = await executeTxnOnBehalfOf(
          await contract.populateTransaction.updateProxyContract(smartWalletProxy.address, {
            gasLimit,
            ...extraArgs,
          })
        );
        log(2, `> Linking to proxy ${smartWalletProxy.address}`);
        await printInfo(tx);
      }
    }
  }
}

async function updateUniSwap(uniSwap: UniSwap | undefined, extraArgs: {from?: string}) {
  if (!uniSwap || !networkConfig.uniswap) {
    log(1, 'protocol not supported on this env');
    return;
  }
  log(1, 'update supported routers');
  let existing = (await uniSwap.getAllUniRouters()).map((r) => r.toLowerCase());
  let configRouters = Object.values(networkConfig.uniswap!.routers).map((r) => r.address.toLowerCase());
  let toBeRemoved = existing.filter((add) => !configRouters.includes(add));
  let toBeAdded = configRouters.filter((add) => !existing.includes(add));
  await updateAddressSet(uniSwap.populateTransaction.updateUniRouters, toBeRemoved, toBeAdded, extraArgs);

  log(1, 'update custom selectors');
  for (const [router, {swapFromEth, swapToEth}] of Object.entries(networkConfig.uniswap.customSelectors ?? {})) {
    let swapFromEthSelector = ethers.utils.solidityKeccak256(['string'], [swapFromEth]).slice(0, 10);
    let swapToEthSelector = ethers.utils.solidityKeccak256(['string'], [swapToEth]).slice(0, 10);

    let selector1 = await uniSwap.customSwapFromEth(router);
    let selector2 = await uniSwap.customSwapToEth(router);

    if (!equalHex(selector1, swapFromEthSelector) || !equalHex(selector2, swapToEthSelector)) {
      const tx = await executeTxnOnBehalfOf(
        await uniSwap.populateTransaction.updateCustomSwapSelector(router, swapFromEthSelector, swapToEthSelector)
      );
      log(2, '> Updating selectors:', router, swapFromEthSelector, swapToEthSelector);
      await printInfo(tx);
    }
  }
}

async function updateUniSwapV3(uniSwapV3: UniSwapV3 | undefined, extraArgs: {from?: string}) {
  if (!uniSwapV3 || !networkConfig.uniswapV3) {
    log(1, 'protocol not supported on this env');
    return;
  }
  log(1, 'update supported routers');
  let existing = (await uniSwapV3.getAllUniRouters()).map((r) => r.toLowerCase());
  let configRouters = networkConfig.uniswapV3!.routers.map((r) => r.toLowerCase());
  let toBeRemoved = existing.filter((add) => !configRouters.includes(add));
  let toBeAdded = configRouters.filter((add) => !existing.includes(add));
  await updateAddressSet(uniSwapV3.populateTransaction.updateUniRouters, toBeRemoved, toBeAdded, extraArgs);
}

async function updateKyberProxy(kyberProxy: KyberProxy | undefined, extraArgs: {from?: string}) {
  if (!kyberProxy || !networkConfig.kyberProxy) {
    log(1, 'protocol not supported on this env');
    return;
  }
  log(1, 'update proxy');

  if ((await kyberProxy.kyberProxy()).toLowerCase() === networkConfig.kyberProxy.proxy.toLowerCase()) {
    log(2, `kyberProxy already up-to-date at ${networkConfig.kyberProxy.proxy}`);
  } else {
    const tx = await executeTxnOnBehalfOf(
      await kyberProxy.populateTransaction.updateKyberProxy(networkConfig.kyberProxy.proxy)
    );
    log(2, '> updated kyberProxy', JSON.stringify(networkConfig.kyberProxy, null, 2));
    await printInfo(tx);
  }
}

async function updateKyberDmm(kyberDmm: KyberDmm | undefined, extraArgs: {from?: string}) {
  if (!kyberDmm || !networkConfig.kyberDmm) {
    log(1, 'protocol not supported on this env');
    return;
  }
  log(1, 'update proxy');

  if ((await kyberDmm.dmmRouter()).toLowerCase() === networkConfig.kyberDmm.router.toLowerCase()) {
    log(2, `dmmRouter already up-to-date at ${networkConfig.kyberDmm.router}`);
  } else {
    const tx = await executeTxnOnBehalfOf(
      await kyberDmm.populateTransaction.updateDmmRouter(networkConfig.kyberDmm.router)
    );
    log(2, '> updated dmmRouter', JSON.stringify(networkConfig.kyberDmm, null, 2));
    await printInfo(tx);
  }
}

async function updateOneInch(oneInch: OneInch | undefined, extraArgs: {from?: string}) {
  if (!oneInch || !networkConfig.oneInch) {
    log(1, 'protocol not supported on this env');
    return;
  }
  log(1, 'update proxy');

  if ((await oneInch.router()).toLowerCase() === networkConfig.oneInch.router.toLowerCase()) {
    log(2, `oneInch already up-to-date at ${networkConfig.oneInch.router}`);
  } else {
    const tx = await executeTxnOnBehalfOf(
      await oneInch.populateTransaction.updateAggregationRouter(networkConfig.oneInch.router)
    );
    log(2, '> updated oneInch', JSON.stringify(networkConfig.oneInch, null, 2));
    await printInfo(tx);
  }
}

async function updateOpenOcean(openOcean: OpenOcean | undefined, extraArgs: {from?: string}) {
  if (!openOcean || !networkConfig.openOcean) {
    log(1, 'protocol not supported on this env');
    return;
  }
  log(1, 'update proxy');

  if ((await openOcean.router()).toLowerCase() === networkConfig.openOcean.router.toLowerCase()) {
    log(2, `openOcean already up-to-date at ${networkConfig.openOcean.router}`);
  } else {
    const tx = await executeTxnOnBehalfOf(
      await openOcean.populateTransaction.updateAggregationRouter(networkConfig.openOcean.router)
    );
    log(2, '> updated openOcean', JSON.stringify(networkConfig.openOcean, null, 2));
    await printInfo(tx);
  }
}

async function updateOkx(okx: Okx | undefined, extraArgs: {from?: string}) {
  if (!okx || !networkConfig.okx) {
    log(1, 'protocol not supported on this env');
    return;
  }
  log(1, 'update proxy');

  if ((await okx.router()).toLowerCase() === networkConfig.okx.router.toLowerCase()) {
    log(2, `OKX already up-to-date at ${networkConfig.okx.router}`);
  } else {
    const tx = await executeTxnOnBehalfOf(
      await okx.populateTransaction.updateAggregationRouter(networkConfig.okx.router)
    );
    log(2, '> updated OKX', JSON.stringify(networkConfig.okx, null, 2));
    await printInfo(tx);
  }
}

async function updateKyberDmmV2(kyberDmmV2: KyberDmmV2 | undefined, extraArgs: {from?: string}) {
  if (!kyberDmmV2 || !networkConfig.kyberDmmV2) {
    log(1, 'protocol not supported on this env');
    return;
  }
  log(1, 'update proxy');

  if ((await kyberDmmV2.router()).toLowerCase() === networkConfig.kyberDmmV2.router.toLowerCase()) {
    log(2, `kyberDmmV2 already up-to-date at ${networkConfig.kyberDmmV2.router}`);
  } else {
    const tx = await executeTxnOnBehalfOf(
      await kyberDmmV2.populateTransaction.updateAggregationRouter(networkConfig.kyberDmmV2.router)
    );
    log(2, '> updated kyberDmmV2', JSON.stringify(networkConfig.kyberDmmV2, null, 2));
    await printInfo(tx);
  }
}

async function updateKyberSwapV2(kyberSwapV2: KyberSwapV2 | undefined, extraArgs: {from?: string}) {
  if (!kyberSwapV2 || !networkConfig.kyberSwapV2) {
    log(1, 'protocol not supported on this env');
    return;
  }
  log(1, 'update proxy');

  if ((await kyberSwapV2.router()).toLowerCase() === networkConfig.kyberSwapV2.router.toLowerCase()) {
    log(2, `kyberSwapV2 already up-to-date at ${networkConfig.kyberSwapV2.router}`);
  } else {
    const tx = await executeTxnOnBehalfOf(
      await kyberSwapV2.populateTransaction.updateAggregationRouter(networkConfig.kyberSwapV2.router)
    );
    log(2, '> updated kyberSwapV2', JSON.stringify(networkConfig.kyberSwapV2, null, 2));
    await printInfo(tx);
  }
}

async function updateKyberSwapV3(kyberSwapV3: KyberSwapV3 | undefined, extraArgs: {from?: string}) {
  if (!kyberSwapV3 || !networkConfig.kyberSwapV3) {
    log(1, 'protocol not supported on this env');
    return;
  }
  log(1, 'update proxy');

  if ((await kyberSwapV3.router()).toLowerCase() === networkConfig.kyberSwapV3.router.toLowerCase()) {
    log(2, `kyberSwapV3 already up-to-date at ${networkConfig.kyberSwapV3.router}`);
  } else {
    const tx = await executeTxnOnBehalfOf(
      await kyberSwapV3.populateTransaction.updateAggregationRouter(networkConfig.kyberSwapV3.router)
    );
    log(2, '> updated kyberSwapV3', JSON.stringify(networkConfig.kyberSwapV3, null, 2));
    await printInfo(tx);
  }
}

async function updateVelodrome(velodrome: Velodrome | undefined, extraArgs: {from?: string}) {
  if (!velodrome || !networkConfig.velodrome) {
    log(1, 'protocol not supported on this env');
    return;
  }
  log(1, 'update supported routers');
  let existingRouters = (await velodrome.getAllVelodromeRouters()).map((r) => r.toLowerCase());
  let configRouters = Object.values(networkConfig.velodrome!.routers).map((r) => r.address.toLowerCase());
  let toBeRemovedRouters = existingRouters.filter((add) => !configRouters.includes(add));
  let toBeAddedRouters = configRouters.filter((add) => !existingRouters.includes(add));
  await updateAddressSet(
    velodrome.populateTransaction.updateVelodromeRouters,
    toBeRemovedRouters,
    toBeAddedRouters,
    extraArgs
  );

  log(1, 'update supported stablecoins');
  let existingStablecoins = (await velodrome.getAllVelodromeStablecoins()).map((r) => r.toLowerCase());
  let configStablecoins = Object.values(networkConfig.velodrome!.stablecoins).map((r) => r.toLowerCase());
  let toBeRemovedStablecoins = existingStablecoins.filter((add) => !configStablecoins.includes(add));
  let toBeAddedStablecoins = configStablecoins.filter((add) => !existingStablecoins.includes(add));
  await updateAddressSet(
    velodrome.populateTransaction.updateVelodromeStablecoins,
    toBeRemovedStablecoins,
    toBeAddedStablecoins,
    extraArgs
  );

  log(1, 'update custom selectors');
  for (const [router, {swapFromEth, swapToEth}] of Object.entries(networkConfig.velodrome.customSelectors ?? {})) {
    let swapFromEthSelector = ethers.utils.solidityKeccak256(['string'], [swapFromEth]).slice(0, 10);
    let swapToEthSelector = ethers.utils.solidityKeccak256(['string'], [swapToEth]).slice(0, 10);

    let selector1 = await velodrome.customSwapFromEth(router);
    let selector2 = await velodrome.customSwapToEth(router);

    if (!equalHex(selector1, swapFromEthSelector) || !equalHex(selector2, swapToEthSelector)) {
      const tx = await executeTxnOnBehalfOf(
        await velodrome.populateTransaction.updateCustomSwapSelector(router, swapFromEthSelector, swapToEthSelector)
      );
      log(2, '> Updating selectors:', router, swapFromEthSelector, swapToEthSelector);
      await printInfo(tx);
    }
  }
}

async function updateCompoundLending(compoundLending: CompoundLending | undefined, extraArgs: {from?: string}) {
  if (!compoundLending || !networkConfig.compound) {
    log(1, 'protocol not supported on this env');
    return;
  }

  log(1, 'update compound data');
  let compoundData = await compoundLending.compoundData();
  // comptroller is at the first 20 bytes
  if (compoundData.toLowerCase() === networkConfig.compound.compTroller.toLowerCase()) {
    log(2, `comptroller already up-to-date at ${networkConfig.compound.compTroller}`);
  } else {
    const tx = await executeTxnOnBehalfOf(
      await compoundLending.populateTransaction.updateCompoundData(
        networkConfig.compound.compTroller,
        networkConfig.compound.cNative,
        networkConfig.compound.cTokens
      )
    );
    log(2, '> updated compound', JSON.stringify(networkConfig.compound, null, 2));
    await printInfo(tx);
  }
}

async function updateAaveV1Lending(aaveV1Lending: AaveV1Lending | undefined, extraArgs: {from?: string}) {
  if (!aaveV1Lending || !networkConfig.aaveV1) {
    log(1, 'protocol not supported on this env');
    return;
  }

  log(1, 'update aave v1 data');
  let aaveData = await aaveV1Lending.aaveData();
  if (networkConfig.aaveV1.poolV1.toLowerCase() === aaveData.lendingPoolV1.toLowerCase()) {
    log(2, `aave pool already up-to-date at ${networkConfig.aaveV1.poolV1}`);
  } else {
    const tx = await executeTxnOnBehalfOf(
      await aaveV1Lending.populateTransaction.updateAaveData(
        networkConfig.aaveV1.poolV1,
        networkConfig.aaveV1.poolCoreV1,
        networkConfig.aaveV1.referralCode,
        networkConfig.aaveV1.tokens
      )
    );
    log(2, '> updated aave v1', JSON.stringify(networkConfig.aaveV1, null, 2));
    await printInfo(tx);
  }
}

async function updateAaveV2Lending(
  aaveV2Lending: AaveV2Lending | undefined,
  aaveV2Config: IAaveV2Config | undefined,
  _extraArgs: {from?: string}
) {
  if (!aaveV2Lending || !aaveV2Config) {
    log(1, 'protocol not supported on this env');
    return;
  }

  log(1, 'update aave v2 data');
  let aaveData = await aaveV2Lending.aaveData();
  if (
    aaveV2Config.poolV2.toLowerCase() === aaveData.lendingPoolV2.toLowerCase() &&
    aaveV2Config.provider.toLowerCase() === aaveData.provider.toLowerCase()
  ) {
    log(2, `aave pool and provider already up-to-date`);
  } else {
    const tx = await executeTxnOnBehalfOf(
      await aaveV2Lending.populateTransaction.updateAaveData(
        aaveV2Config.provider,
        aaveV2Config.poolV2,
        aaveV2Config.referralCode,
        aaveV2Config.weth,
        aaveV2Config.tokens
      )
    );
    log(2, '> updated aave v2', JSON.stringify(networkConfig.aaveV2, null, 2));
    await printInfo(tx);
  }
}

async function updateAddressSet(
  populateFunc: any,
  toBeRemoved: string[],
  toBeAdded: string[],
  extraArgs: {from?: string}
) {
  if (toBeRemoved.length) {
    // const tx = await executeTxn(
    //   await populateFunc(toBeRemoved, false, {
    //     gasLimit,
    //     ...extraArgs,
    //   })
    // );
    log(2, '> skip removing wallets', toBeRemoved);
    // await printInfo(tx);
  } else {
    log(2, '> nothing to be removed');
  }
  console.log('\n');
  if (toBeAdded.length) {
    const tx = await executeTxnOnBehalfOf(
      await populateFunc(toBeAdded, true, {
        gasLimit,
        ...extraArgs,
      })
    );
    log(2, '> added wallets', toBeAdded);
    await printInfo(tx);
  } else {
    log(2, '> nothing to be added');
  }
}

async function printInfo(tx: TransactionResponse) {
  const receipt = await tx.wait(1);

  log(2, `> tx hash:\t${tx.hash}`);
  log(2, `> gas price:\t${tx.gasPrice.toString()}`);
  log(2, `> gas used:\t${receipt.gasUsed.toString()}`);
}

export function convertToAddressObject(obj: Record<string, any> | Array<any> | Contract): any {
  if (obj === undefined) return obj;
  if (obj instanceof Contract) {
    return obj.address;
  } else if (Array.isArray(obj)) {
    return obj.map((k) => convertToAddressObject(obj[k]));
  } else {
    let ret = {};
    for (let k in obj) {
      // @ts-ignore
      ret[k] = convertToAddressObject(obj[k]);
    }
    return ret;
  }
}

let prevLevel: number;
function log(level: number, ...args: any[]) {
  if (prevLevel != undefined && prevLevel > level) {
    console.log('\n');
  }
  prevLevel = level;

  let prefix = '';
  for (let i = 0; i < level; i++) {
    prefix += '    ';
  }
  console.log(`${prefix}`, ...args);
}

async function executeTxnOnBehalfOf(
  txn: TransactionRequest | PopulatedTransaction,
  customMultisig?: string
): Promise<TransactionResponse> {
  let tx;
  let m = customMultisig || multisig;
  if (m) {
    const signer = (await ethers.getSigners())[0];
    const ethAdapter = new EthersAdapter({
      ethers,
      signer,
    });
    const safeSdk: Safe = await Safe.create({ethAdapter, safeAddress: m});
    const safeTransaction = await safeSdk.createTransaction({
      to: txn.to ?? zeroAddress,
      value: txn.value?.toString() ?? '0',
      data: txn.data!.toString(),
      operation: OperationType.Call,
    });
    tx = (await safeSdk.executeTransaction(safeTransaction)).transactionResponse!;
  } else {
    const signer = (await ethers.getSigners())[0];
    tx = await signer.sendTransaction(txn);
  }
  return tx;
}
