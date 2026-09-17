import {expect} from 'chai';
import {BigNumber} from 'ethers';
import {FeeMode, BPS} from './helper';
import {apiMock} from './api_helper';
import hre from 'hardhat';
import {SmartWalletImplementation, SmartWalletProxy, IERC20Ext} from '../typechain';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/signers';
import {loadFixture} from 'ethereum-waffle';
import axios from 'axios';

// This tests (swaps) can only run with forked Ethereum mainnet at certain block
// (because of liquidity/pricing/slippage condition)
// MAINNET_FORK_BLOCK=15319272
describe('KyberSwapV3', async function () {
  let signers: SignerWithAddress[];
  let admin: SignerWithAddress;
  let platformFee = 8;

  // TODO refactor this hardcode
  let platformWallet = '0x5250b8202AEBca35328E2c217C687E894d70Cd31'; // iOS wallet
  let receiver = '0x320849EC0aDffCd6fb0212B59a2EC936cdEF5fCa'; // receive fund after swap
  let ETHAddr = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
  let USDTAddr = '0xdac17f958d2ee523a2206206994597c13d831ec7';
  let USDCAddr = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
  let USDCHolderAddr = '0x55FE002aefF02F77364de339a1292923A15844B8';
  let slippage = 50; // in BPS unit, which is 0.5%
  let usdcContract: IERC20Ext;
  let usdcDecimals = 6;

  // TODO: refactor this hardcoded address
  const krystalProxyAddr = '0x70270C228c5B4279d1578799926873aa72446CcD';
  let krystalProxy: SmartWalletImplementation;

  // TODO: refactor this hardcoded address
  const kyberRouterAddr = '0x00555513Acf282B42882420E5e5bA87b44D8fA6E';

  async function deployKyberSwapV3() {
    // ========================================================================
    // Prepare to deploy & update swap contract KyberSwap V3

    const KyberSwapV3 = await hre.ethers.getContractFactory('KyberSwapV3');
    const kyberSwapV3 = await KyberSwapV3.deploy(
      admin.address,
      kyberRouterAddr,
      hre.ethers.constants.AddressZero,
      false
    );

    // update proxy
    await kyberSwapV3.updateProxyContract(krystalProxyAddr);

    // update swap contract
    let proxy = (await hre.ethers.getContractAt('SmartWalletProxy', krystalProxyAddr)) as SmartWalletProxy;
    const krystalAdminAddr = await proxy.admin();
    const krystalAdmin = await hre.ethers.getImpersonatedSigner(krystalAdminAddr);

    await admin.sendTransaction({
      to: krystalAdmin.address,
      value: hre.ethers.utils.parseEther('1.0'),
    });
    await proxy.connect(krystalAdmin).updateSupportedSwaps([kyberSwapV3.address], true);

    return {kyberSwapV3};
  }

  before(async function () {
    signers = await hre.ethers.getSigners();
    admin = signers[0];

    krystalProxy = (await hre.ethers.getContractAt(
      'SmartWalletImplementation',
      krystalProxyAddr
    )) as SmartWalletImplementation;

    usdcContract = (await hre.ethers.getContractAt('IERC20Ext', USDCAddr)) as IERC20Ext;

    const usdcHolder = await hre.ethers.getImpersonatedSigner(USDCHolderAddr);
    await usdcContract.connect(usdcHolder).transfer(admin.address, hre.ethers.utils.parseUnits('1000000.0', 6));
  });

  it('Should revert with getExpectedReturn_notSupported', async function () {
    const {kyberSwapV3} = await loadFixture(deployKyberSwapV3);

    await expect(
      krystalProxy.getExpectedReturn({
        swapContract: kyberSwapV3.address,
        srcAmount: BigNumber.from(1),
        tradePath: [],
        feeMode: FeeMode.FROM_SOURCE,
        feeBps: platformFee,
        extraArgs: '0x',
      })
    ).to.be.revertedWith('getExpectedReturn_notSupported');
  });

  it('Should revert with getExpectedReturnWithImpact_notSupported', async function () {
    const {kyberSwapV3} = await loadFixture(deployKyberSwapV3);

    await expect(
      krystalProxy.getExpectedReturnWithImpact({
        swapContract: kyberSwapV3.address,
        srcAmount: BigNumber.from(1),
        tradePath: [],
        feeMode: FeeMode.FROM_SOURCE,
        feeBps: platformFee,
        extraArgs: '0x',
      })
    ).to.be.revertedWith('getExpectedReturnWithImpact_notSupported');
  });

  it('Should swap native to token successfully (ETH -> USDT)', async function () {
    const {kyberSwapV3} = await loadFixture(deployKyberSwapV3);

    const srcAmount = hre.ethers.utils.parseEther('1.0'); // 1 ETH
    const amount = srcAmount.mul(BPS.sub(platformFee)).div(BPS); // amount to KyberSwap contract, fee deducted

    const data = await getKyberSwapData(ETHAddr, USDTAddr, amount, slippage, receiver);

    // TODO refactor this expect, it might need to check the received amount too :D
    await expect(
      await krystalProxy.swap(
        {
          swapContract: kyberSwapV3.address,
          srcAmount: srcAmount,
          minDestAmount: BigNumber.from(data.outputAmount).mul(BPS.sub(slippage)).div(BPS),
          tradePath: [ETHAddr, USDTAddr],
          feeMode: FeeMode.FROM_SOURCE,
          feeBps: platformFee,
          platformWallet: platformWallet,
          extraArgs: data.encodedSwapData,
        },
        {
          value: srcAmount,
        }
      )
    ).to.changeEtherBalance(admin, (-srcAmount).toString());
  });

  it('Should swap token to token successfully (USDC -> USDT)', async function () {
    const {kyberSwapV3} = await loadFixture(deployKyberSwapV3);

    const srcAmount = hre.ethers.utils.parseUnits('1000.0', usdcDecimals);
    const amount = srcAmount.mul(BPS.sub(platformFee)).div(BPS);

    const data = await getKyberSwapData(USDCAddr, USDTAddr, amount, slippage, receiver);

    // approve
    await usdcContract.approve(krystalProxy.address, srcAmount);

    // TODO refactor this expect, it might need to check the received amount too :D
    await expect(() =>
      krystalProxy.swap({
        swapContract: kyberSwapV3.address,
        srcAmount: srcAmount,
        minDestAmount: BigNumber.from(data.outputAmount).mul(BPS.sub(slippage)).div(BPS),
        tradePath: [USDCAddr, USDTAddr],
        feeMode: FeeMode.FROM_SOURCE,
        feeBps: platformFee,
        platformWallet: platformWallet,
        extraArgs: data.encodedSwapData,
      })
    ).to.changeTokenBalance(usdcContract, admin, -srcAmount);
  });

  it('Should swap token to native successfully (USDC -> ETH)', async function () {
    const {kyberSwapV3} = await loadFixture(deployKyberSwapV3);

    const srcAmount = hre.ethers.utils.parseUnits('1000.0', usdcDecimals);
    const amount = srcAmount.mul(BPS.sub(platformFee)).div(BPS);

    const data = await getKyberSwapData(USDCAddr, ETHAddr, amount, slippage, receiver);

    // approve
    await usdcContract.approve(krystalProxy.address, srcAmount);

    // TODO refactor this expect, it might need to check the received amount too :D
    await expect(() =>
      krystalProxy.swap({
        swapContract: kyberSwapV3.address,
        srcAmount: srcAmount,
        minDestAmount: BigNumber.from(data.outputAmount).mul(BPS.sub(slippage)).div(BPS),
        tradePath: [USDCAddr, ETHAddr],
        feeMode: FeeMode.FROM_SOURCE,
        feeBps: platformFee,
        platformWallet: platformWallet,
        extraArgs: data.encodedSwapData,
      })
    ).to.changeTokenBalance(usdcContract, admin, -srcAmount);
  });
});

async function getKyberSwapData(
  tokenIn: string,
  tokenOut: string,
  srcAmount: BigNumber,
  slippage: number,
  receiver: string
) {
  const url = `https://aggregator-api.kyberswap.com/ethereum/route/encode?tokenIn=${tokenIn}&tokenOut=${tokenOut}&amountIn=${srcAmount}&slippageTolerance=${slippage}&to=${receiver}`;
  return await getMockData(url);
}

async function getMockData(url: string) {
  let data = apiMock[url];
  if (data == null) {
    console.log(`missing  mock data for ${url}`);

    // TODO:
    // - should refactor this on/off by a flag, like --capture
    // - should find a way to save it into apiMock automatically
    // e.g: save the data into a json file

    const resp = await axios.get(url);
    if (resp.status == 200) {
      data = resp.data;
      console.log('received data: ');
      console.log(JSON.stringify(data));
    }
  }

  return data;
}
