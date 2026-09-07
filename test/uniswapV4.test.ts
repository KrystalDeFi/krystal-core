import {ethers} from 'hardhat';
import {BigNumber} from 'ethers';
import {assert, expect} from 'chai';
import {defaultAbiCoder, hexlify, arrayify, keccak256} from 'ethers/lib/utils';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {IERC20Ext, UniSwapV4} from '../typechain';
import {evm_revert, evm_snapshot, nativeTokenAddress} from './helper';

// ── Base mainnet addresses (available via hardhat fork) ──────────────────────
const UNIVERSAL_ROUTER = '0xFdf682F51FE81Aa4898F0AE2163d8A55c127fbC7';
const STATE_VIEW = '0xA3c0c9b65baD0b08107Aa264b0f3dB444b867A71';
const NFPM = '0x7c5f5a4bbd8fd63184577525326123b519429bdc';
const USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const USDbC_ADDRESS = '0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca';
const cbBTC_ADDRESS = '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf';
const ETH_V4 = '0x0000000000000000000000000000000000000000'; // V4 native ETH

// ── Pool parameters (verified on-chain via StateView) ───────────────────────
const DEFAULT_FEE = 3000;
const DEFAULT_TICK_SPACING = 60;

// ── Helpers ──────────────────────────────────────────────────────────────────

function computePoolId(c0: string, c1: string, fee: number, tickSpacing: number): string {
  const [t0, t1] = c0.toLowerCase() < c1.toLowerCase() ? [c0, c1] : [c1, c0];
  return keccak256(
    defaultAbiCoder.encode(['address', 'address', 'uint24', 'int24', 'address'], [t0, t1, fee, tickSpacing, ETH_V4])
  );
}

// fee/tickSpacing may be a single value applied to every hop, or a per-hop array (for multi-hop
// paths where hops live in different pools/fee tiers).
function buildExtraArgs(
  tradePath: string[],
  fee: number | number[] = DEFAULT_FEE,
  tickSpacing: number | number[] = DEFAULT_TICK_SPACING
): string {
  // header: <router 20B> — stateView/nfpm are bound to the router via routerConfigs, not extraArgs
  let args = hexlify(arrayify(UNIVERSAL_ROUTER));

  // per hop: <poolId 32B>
  for (let i = 0; i < tradePath.length - 1; i++) {
    const c0 = tradePath[i].toLowerCase() === nativeTokenAddress.toLowerCase() ? ETH_V4 : tradePath[i];
    const c1 = tradePath[i + 1].toLowerCase() === nativeTokenAddress.toLowerCase() ? ETH_V4 : tradePath[i + 1];
    const hopFee = Array.isArray(fee) ? fee[i] : fee;
    const hopTickSpacing = Array.isArray(tickSpacing) ? tickSpacing[i] : tickSpacing;
    const poolId = computePoolId(c0, c1, hopFee, hopTickSpacing);
    args += poolId.slice(2); // strip 0x
  }
  return args;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('UniSwapV4 — unit tests (Base mainnet fork)', async () => {
  let admin: SignerWithAddress;
  let user: SignerWithAddress;
  let uniSwapV4: UniSwapV4;
  let usdc: IERC20Ext;
  let usdbc: IERC20Ext;
  let cbbtc: IERC20Ext;
  let snapshotId: any;

  // $10 worth of ETH at ~$2000/ETH
  const ethAmountIn = ethers.utils.parseEther('0.005');
  // $10 worth of USDC
  const usdcAmountIn = BigNumber.from(10).mul(BigNumber.from(10).pow(6)); // 10 USDC (6 decimals)

  before(async () => {
    [admin, user] = await ethers.getSigners();

    // Deploy UniSwapV4 with admin as the proxy contract (bypasses onlyProxyContract)
    const factory = await ethers.getContractFactory('UniSwapV4');
    uniSwapV4 = (await factory.deploy(admin.address, [UNIVERSAL_ROUTER], [STATE_VIEW], [NFPM])) as UniSwapV4;
    await uniSwapV4.deployed();

    // Register admin as the proxy so we can call swap/quote functions directly
    await uniSwapV4.updateProxyContract(admin.address);

    usdc = (await ethers.getContractAt('IERC20Ext', USDC_ADDRESS)) as IERC20Ext;
    usdbc = (await ethers.getContractAt('IERC20Ext', USDbC_ADDRESS)) as IERC20Ext;
    cbbtc = (await ethers.getContractAt('IERC20Ext', cbBTC_ADDRESS)) as IERC20Ext;

    snapshotId = await evm_snapshot();
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  // ── getExpectedReturn ──────────────────────────────────────────────────────

  describe('getExpectedReturn', () => {
    it('ETH → USDC returns non-zero destAmount', async () => {
      const tradePath = [nativeTokenAddress, USDC_ADDRESS];
      const extraArgs = buildExtraArgs(tradePath);

      const destAmount = await uniSwapV4.getExpectedReturn({
        srcAmount: ethAmountIn,
        tradePath,
        feeBps: 0,
        extraArgs,
      });

      console.log(`  Quote: ${ethers.utils.formatEther(ethAmountIn)} ETH → ${destAmount} USDC (raw)`);
      assert(destAmount.gt(0), 'destAmount should be > 0');
      console.log(`  ETH → USDC: ${ethers.utils.formatEther(ethAmountIn)} ETH → ${destAmount} USDC (raw)`);
    });

    it('USDC → ETH returns non-zero destAmount', async () => {
      const tradePath = [USDC_ADDRESS, nativeTokenAddress];
      const extraArgs = buildExtraArgs(tradePath);

      const destAmount = await uniSwapV4.getExpectedReturn({
        srcAmount: usdcAmountIn,
        tradePath,
        feeBps: 0,
        extraArgs,
      });

      assert(destAmount.gt(0), 'destAmount should be > 0');
      console.log(`  USDC → ETH: ${usdcAmountIn} USDC → ${ethers.utils.formatEther(destAmount)} ETH`);
    });

    it('ETH → cbBTC returns non-zero destAmount', async () => {
      const tradePath = [nativeTokenAddress, cbBTC_ADDRESS];
      const extraArgs = buildExtraArgs(tradePath);

      const destAmount = await uniSwapV4.getExpectedReturn({
        srcAmount: ethAmountIn,
        tradePath,
        feeBps: 0,
        extraArgs,
      });

      assert(destAmount.gt(0), 'destAmount should be > 0');
      console.log(`  ETH → cbBTC: ${ethers.utils.formatEther(ethAmountIn)} ETH → ${destAmount} cbBTC (raw)`);
    });

    it('reverts with unsupported router', async () => {
      const fakeRouter = '0x000000000000000000000000000000000000dEaD';
      const badArgs =
        hexlify(arrayify(fakeRouter)) +
        computePoolId(ETH_V4, USDC_ADDRESS, DEFAULT_FEE, DEFAULT_TICK_SPACING).slice(2);

      await expect(
        uniSwapV4.getExpectedReturn({
          srcAmount: ethAmountIn,
          tradePath: [nativeTokenAddress, USDC_ADDRESS],
          feeBps: 0,
          extraArgs: badArgs,
        })
      ).to.be.revertedWith('unsupported router');
    });
  });

  // ── getExpectedReturnWithImpact ────────────────────────────────────────────

  describe('getExpectedReturnWithImpact', () => {
    it('ETH → USDC returns destAmount and valid priceImpact', async () => {
      const tradePath = [nativeTokenAddress, USDC_ADDRESS];
      const extraArgs = buildExtraArgs(tradePath);

      const [destAmount, priceImpact] = await uniSwapV4.getExpectedReturnWithImpact({
        srcAmount: ethAmountIn,
        tradePath,
        feeBps: 0,
        extraArgs,
      });

      assert(destAmount.gt(0), 'destAmount should be > 0');
      assert(priceImpact.gte(0), 'priceImpact should be >= 0');
      assert(priceImpact.lte(10000), 'priceImpact should be <= 10000 bps');
      console.log(`  priceImpact: ${priceImpact.toNumber() / 100}%`);
    });

    it('large ETH → USDC has higher price impact than small amount', async () => {
      const tradePath = [nativeTokenAddress, USDC_ADDRESS];
      const smallArgs = buildExtraArgs(tradePath);
      const largeArgs = buildExtraArgs(tradePath);
      const largeAmount = ethAmountIn.mul(5000); // 25 ETH

      const [, smallImpact] = await uniSwapV4.getExpectedReturnWithImpact({
        srcAmount: ethAmountIn,
        tradePath,
        feeBps: 0,
        extraArgs: smallArgs,
      });

      console.log(`  smallImpact: ${smallImpact.toNumber() / 100}%`);

      console.log(largeAmount.toString(), tradePath, largeArgs);

      const [, largeImpact] = await uniSwapV4.getExpectedReturnWithImpact({
        srcAmount: largeAmount,
        tradePath,
        feeBps: 0,
        extraArgs: largeArgs,
      });

      console.log(`  largeImpact: ${largeImpact.toNumber() / 100}%`);
      assert(largeImpact.gte(smallImpact), 'larger swap should have >= price impact');
    });
  });

  // ── getExpectedIn ──────────────────────────────────────────────────────────

  describe('getExpectedIn', () => {
    it('reverse-quotes ETH → USDC correctly', async () => {
      const tradePath = [nativeTokenAddress, USDC_ADDRESS];
      const extraArgs = buildExtraArgs(tradePath);

      // Forward quote first
      const destAmount = await uniSwapV4.getExpectedReturn({
        srcAmount: ethAmountIn,
        tradePath,
        feeBps: 0,
        extraArgs,
      });

      // Reverse quote: how much ETH to get destAmount USDC?
      const srcAmount = await uniSwapV4.getExpectedIn({
        destAmount,
        tradePath,
        feeBps: 0,
        extraArgs,
      });

      // Reverse quote should be within 1% of original amount (AMM math rounding)
      const diff = srcAmount.sub(ethAmountIn).abs();
      assert(diff.mul(100).lte(ethAmountIn), `getExpectedIn too far from original: ${srcAmount} vs ${ethAmountIn}`);
    });
  });

  // ── swap ──────────────────────────────────────────────────────────────────

  describe('swap', () => {
    it('swaps ETH → USDC and delivers USDC to recipient', async () => {
      const tradePath = [nativeTokenAddress, USDC_ADDRESS];
      const extraArgs = buildExtraArgs(tradePath);

      const destAmount = await uniSwapV4.getExpectedReturn({
        srcAmount: ethAmountIn,
        tradePath,
        feeBps: 0,
        extraArgs,
      });
      const minDestAmount = destAmount.mul(97).div(100); // 3% slippage

      const usdcBefore = await usdc.balanceOf(user.address);

      await uniSwapV4.swap(
        {
          srcAmount: ethAmountIn,
          minDestAmount,
          tradePath,
          recipient: user.address,
          feeBps: 0,
          feeReceiver: admin.address,
          extraArgs,
        },
        {value: ethAmountIn}
      );

      const usdcAfter = await usdc.balanceOf(user.address);
      const received = usdcAfter.sub(usdcBefore);
      assert(received.gte(minDestAmount), `received ${received} USDC < minDestAmount ${minDestAmount}`);
      console.log(`  Received: ${received} USDC`);
    });

    it('swaps USDC → ETH and delivers ETH to recipient', async () => {
      // Fund the UniSwapV4 contract with USDC first (proxy normally does this)
      // Get USDC by swapping ETH first
      const tradePath1 = [nativeTokenAddress, USDC_ADDRESS];
      const extraArgs1 = buildExtraArgs(tradePath1);
      const quote1 = await uniSwapV4.getExpectedReturn({
        srcAmount: ethAmountIn,
        tradePath: tradePath1,
        feeBps: 0,
        extraArgs: extraArgs1,
      });
      await uniSwapV4.swap(
        {
          srcAmount: ethAmountIn,
          minDestAmount: quote1.mul(97).div(100),
          tradePath: tradePath1,
          recipient: admin.address,
          feeBps: 0,
          feeReceiver: admin.address,
          extraArgs: extraArgs1,
        },
        {value: ethAmountIn}
      );

      const usdcBalance = await usdc.balanceOf(admin.address);
      assert(usdcBalance.gt(0), 'need USDC to test reverse swap');

      // Transfer USDC to the UniSwapV4 contract (proxy does this normally)
      await usdc.transfer(uniSwapV4.address, usdcBalance);

      const tradePath2 = [USDC_ADDRESS, nativeTokenAddress];
      const extraArgs2 = buildExtraArgs(tradePath2);
      const quote2 = await uniSwapV4.getExpectedReturn({
        srcAmount: usdcBalance,
        tradePath: tradePath2,
        feeBps: 0,
        extraArgs: extraArgs2,
      });

      const ethBefore = await ethers.provider.getBalance(user.address);

      await uniSwapV4.swap({
        srcAmount: usdcBalance,
        minDestAmount: quote2.mul(97).div(100),
        tradePath: tradePath2,
        recipient: user.address,
        feeBps: 0,
        feeReceiver: admin.address,
        extraArgs: extraArgs2,
      });

      const ethAfter = await ethers.provider.getBalance(user.address);
      assert(ethAfter.gt(ethBefore), 'user should receive ETH');
      console.log(`  Received: ${ethers.utils.formatEther(ethAfter.sub(ethBefore))} ETH`);
    });

    it('reverts when ETH value is insufficient', async () => {
      const tradePath = [nativeTokenAddress, USDC_ADDRESS];
      const extraArgs = buildExtraArgs(tradePath);

      await expect(
        uniSwapV4.swap(
          {
            srcAmount: ethAmountIn,
            minDestAmount: 1,
            tradePath,
            recipient: user.address,
            feeBps: 0,
            feeReceiver: admin.address,
            extraArgs,
          },
          {value: 0}
        )
      ).to.be.reverted;
    });

    it('reverts when output is below minDestAmount', async () => {
      const tradePath = [nativeTokenAddress, USDC_ADDRESS];
      const extraArgs = buildExtraArgs(tradePath);

      await expect(
        uniSwapV4.swap(
          {
            srcAmount: ethAmountIn,
            minDestAmount: ethers.constants.MaxUint256, // impossibly high
            tradePath,
            recipient: user.address,
            feeBps: 0,
            feeReceiver: admin.address,
            extraArgs,
          },
          {value: ethAmountIn}
        )
      ).to.be.reverted;
    });

    it('swaps USDC → USDbC and delivers USDbC to recipient', async () => {
      // USDC/USDbC pool lives at the 0.01% fee tier (tickSpacing 1) on Base
      const stableFee = 100;
      const stableTickSpacing = 1;

      // Acquire USDC first by swapping ETH → USDC
      const ethToUsdcPath = [nativeTokenAddress, USDC_ADDRESS];
      const ethToUsdcArgs = buildExtraArgs(ethToUsdcPath);
      const usdcQuote = await uniSwapV4.getExpectedReturn({
        srcAmount: ethAmountIn,
        tradePath: ethToUsdcPath,
        feeBps: 0,
        extraArgs: ethToUsdcArgs,
      });
      await uniSwapV4.swap(
        {
          srcAmount: ethAmountIn,
          minDestAmount: usdcQuote.mul(97).div(100),
          tradePath: ethToUsdcPath,
          recipient: admin.address,
          feeBps: 0,
          feeReceiver: admin.address,
          extraArgs: ethToUsdcArgs,
        },
        {value: ethAmountIn}
      );

      const usdcBalance = await usdc.balanceOf(admin.address);
      assert(usdcBalance.gt(0), 'need USDC to test USDC → USDbC swap');

      // Fund the UniSwapV4 contract with USDC (proxy does this normally)
      await usdc.transfer(uniSwapV4.address, usdcBalance);

      const tradePath = [USDC_ADDRESS, USDbC_ADDRESS];
      const extraArgs = buildExtraArgs(tradePath, stableFee, stableTickSpacing);

      const destAmount = await uniSwapV4.getExpectedReturn({
        srcAmount: usdcBalance,
        tradePath,
        feeBps: 0,
        extraArgs,
      });
      const minDestAmount = destAmount.mul(97).div(100); // 3% slippage

      const usdbcBefore = await usdbc.balanceOf(user.address);

      await uniSwapV4.swap({
        srcAmount: usdcBalance,
        minDestAmount,
        tradePath,
        recipient: user.address,
        feeBps: 0,
        feeReceiver: admin.address,
        extraArgs,
      });

      const usdbcAfter = await usdbc.balanceOf(user.address);
      const received = usdbcAfter.sub(usdbcBefore);
      assert(received.gte(minDestAmount), `received ${received} USDbC < minDestAmount ${minDestAmount}`);
      console.log(`  Received: ${received} USDbC`);
    });

    it('swaps USDbC → USDC and delivers USDC to recipient', async () => {
      // USDC/USDbC pool lives at the 0.01% fee tier (tickSpacing 1) on Base
      const stableFee = 100;
      const stableTickSpacing = 1;

      // Acquire USDC first by swapping ETH → USDC
      const ethToUsdcPath = [nativeTokenAddress, USDC_ADDRESS];
      const ethToUsdcArgs = buildExtraArgs(ethToUsdcPath);
      const usdcQuote = await uniSwapV4.getExpectedReturn({
        srcAmount: ethAmountIn,
        tradePath: ethToUsdcPath,
        feeBps: 0,
        extraArgs: ethToUsdcArgs,
      });
      await uniSwapV4.swap(
        {
          srcAmount: ethAmountIn,
          minDestAmount: usdcQuote.mul(97).div(100),
          tradePath: ethToUsdcPath,
          recipient: admin.address,
          feeBps: 0,
          feeReceiver: admin.address,
          extraArgs: ethToUsdcArgs,
        },
        {value: ethAmountIn}
      );

      // Convert that USDC into USDbC so we have USDbC to swap back
      const usdcBalance = await usdc.balanceOf(admin.address);
      assert(usdcBalance.gt(0), 'need USDC to seed USDbC balance');
      await usdc.transfer(uniSwapV4.address, usdcBalance);

      const usdcToUsdbcPath = [USDC_ADDRESS, USDbC_ADDRESS];
      const usdcToUsdbcArgs = buildExtraArgs(usdcToUsdbcPath, stableFee, stableTickSpacing);
      const usdbcQuote = await uniSwapV4.getExpectedReturn({
        srcAmount: usdcBalance,
        tradePath: usdcToUsdbcPath,
        feeBps: 0,
        extraArgs: usdcToUsdbcArgs,
      });
      await uniSwapV4.swap({
        srcAmount: usdcBalance,
        minDestAmount: usdbcQuote.mul(97).div(100),
        tradePath: usdcToUsdbcPath,
        recipient: admin.address,
        feeBps: 0,
        feeReceiver: admin.address,
        extraArgs: usdcToUsdbcArgs,
      });

      const usdbcBalance = await usdbc.balanceOf(admin.address);
      assert(usdbcBalance.gt(0), 'need USDbC to test USDbC → USDC swap');

      // Fund the UniSwapV4 contract with USDbC (proxy does this normally)
      await usdbc.transfer(uniSwapV4.address, usdbcBalance);

      const tradePath = [USDbC_ADDRESS, USDC_ADDRESS];
      const extraArgs = buildExtraArgs(tradePath, stableFee, stableTickSpacing);

      const destAmount = await uniSwapV4.getExpectedReturn({
        srcAmount: usdbcBalance,
        tradePath,
        feeBps: 0,
        extraArgs,
      });
      const minDestAmount = destAmount.mul(97).div(100); // 3% slippage

      const usdcBefore = await usdc.balanceOf(user.address);

      await uniSwapV4.swap({
        srcAmount: usdbcBalance,
        minDestAmount,
        tradePath,
        recipient: user.address,
        feeBps: 0,
        feeReceiver: admin.address,
        extraArgs,
      });

      const usdcAfter = await usdc.balanceOf(user.address);
      const received = usdcAfter.sub(usdcBefore);
      assert(received.gte(minDestAmount), `received ${received} USDC < minDestAmount ${minDestAmount}`);
      console.log(`  Received: ${received} USDC`);
    });

    it('swaps USDC → ETH → cbBTC (2 hops) and delivers cbBTC to recipient', async () => {
      // Both hops sit at the default 0.3% fee tier (tickSpacing 60) on Base.
      // Acquire USDC first by swapping ETH → USDC
      const ethToUsdcPath = [nativeTokenAddress, USDC_ADDRESS];
      const ethToUsdcArgs = buildExtraArgs(ethToUsdcPath);
      const usdcQuote = await uniSwapV4.getExpectedReturn({
        srcAmount: ethAmountIn,
        tradePath: ethToUsdcPath,
        feeBps: 0,
        extraArgs: ethToUsdcArgs,
      });
      await uniSwapV4.swap(
        {
          srcAmount: ethAmountIn,
          minDestAmount: usdcQuote.mul(97).div(100),
          tradePath: ethToUsdcPath,
          recipient: admin.address,
          feeBps: 0,
          feeReceiver: admin.address,
          extraArgs: ethToUsdcArgs,
        },
        {value: ethAmountIn}
      );

      const usdcBalance = await usdc.balanceOf(admin.address);
      assert(usdcBalance.gt(0), 'need USDC to test multi-hop swap');
      await usdc.transfer(uniSwapV4.address, usdcBalance);

      const tradePath = [USDC_ADDRESS, nativeTokenAddress, cbBTC_ADDRESS];
      const extraArgs = buildExtraArgs(tradePath); // both hops use the default fee/tickSpacing

      const destAmount = await uniSwapV4.getExpectedReturn({
        srcAmount: usdcBalance,
        tradePath,
        feeBps: 0,
        extraArgs,
      });
      const minDestAmount = destAmount.mul(97).div(100); // 3% slippage

      const cbbtcBefore = await cbbtc.balanceOf(user.address);

      await uniSwapV4.swap({
        srcAmount: usdcBalance,
        minDestAmount,
        tradePath,
        recipient: user.address,
        feeBps: 0,
        feeReceiver: admin.address,
        extraArgs,
      });

      const cbbtcAfter = await cbbtc.balanceOf(user.address);
      const received = cbbtcAfter.sub(cbbtcBefore);
      assert(received.gte(minDestAmount), `received ${received} cbBTC < minDestAmount ${minDestAmount}`);
      console.log(`  Received: ${received} cbBTC (raw)`);
    });

    it('swaps USDbC → USDC → ETH (2 hops) and delivers ETH to recipient', async () => {
      // USDbC/USDC hop sits at the 0.01% fee tier (tickSpacing 1); USDC/ETH hop uses the default tier.
      const hopFees = [100, DEFAULT_FEE];
      const hopTickSpacings = [1, DEFAULT_TICK_SPACING];

      // Acquire USDbC: ETH → USDC → USDbC
      const ethToUsdcPath = [nativeTokenAddress, USDC_ADDRESS];
      const ethToUsdcArgs = buildExtraArgs(ethToUsdcPath);
      const usdcQuote = await uniSwapV4.getExpectedReturn({
        srcAmount: ethAmountIn,
        tradePath: ethToUsdcPath,
        feeBps: 0,
        extraArgs: ethToUsdcArgs,
      });
      await uniSwapV4.swap(
        {
          srcAmount: ethAmountIn,
          minDestAmount: usdcQuote.mul(97).div(100),
          tradePath: ethToUsdcPath,
          recipient: admin.address,
          feeBps: 0,
          feeReceiver: admin.address,
          extraArgs: ethToUsdcArgs,
        },
        {value: ethAmountIn}
      );

      const usdcBalance = await usdc.balanceOf(admin.address);
      assert(usdcBalance.gt(0), 'need USDC to seed USDbC balance');
      await usdc.transfer(uniSwapV4.address, usdcBalance);

      const usdcToUsdbcPath = [USDC_ADDRESS, USDbC_ADDRESS];
      const usdcToUsdbcArgs = buildExtraArgs(usdcToUsdbcPath, 100, 1);
      const usdbcQuote = await uniSwapV4.getExpectedReturn({
        srcAmount: usdcBalance,
        tradePath: usdcToUsdbcPath,
        feeBps: 0,
        extraArgs: usdcToUsdbcArgs,
      });
      await uniSwapV4.swap({
        srcAmount: usdcBalance,
        minDestAmount: usdbcQuote.mul(97).div(100),
        tradePath: usdcToUsdbcPath,
        recipient: admin.address,
        feeBps: 0,
        feeReceiver: admin.address,
        extraArgs: usdcToUsdbcArgs,
      });

      const usdbcBalance = await usdbc.balanceOf(admin.address);
      assert(usdbcBalance.gt(0), 'need USDbC to test multi-hop swap');
      await usdbc.transfer(uniSwapV4.address, usdbcBalance);

      const tradePath = [USDbC_ADDRESS, USDC_ADDRESS, nativeTokenAddress];
      const extraArgs = buildExtraArgs(tradePath, hopFees, hopTickSpacings);

      const destAmount = await uniSwapV4.getExpectedReturn({
        srcAmount: usdbcBalance,
        tradePath,
        feeBps: 0,
        extraArgs,
      });
      const minDestAmount = destAmount.mul(97).div(100); // 3% slippage

      const ethBefore = await ethers.provider.getBalance(user.address);

      await uniSwapV4.swap({
        srcAmount: usdbcBalance,
        minDestAmount,
        tradePath,
        recipient: user.address,
        feeBps: 0,
        feeReceiver: admin.address,
        extraArgs,
      });

      const ethAfter = await ethers.provider.getBalance(user.address);
      const received = ethAfter.sub(ethBefore);
      assert(received.gte(minDestAmount), `received ${ethers.utils.formatEther(received)} ETH < minDestAmount`);
      console.log(`  Received: ${ethers.utils.formatEther(received)} ETH`);
    });

    it('swaps ETH → USDbC → USDC (2 hops) and delivers USDC to recipient', async () => {
      // ETH/USDbC hop uses the default fee tier; USDbC/USDC hop sits at the 0.01% fee tier (tickSpacing 1).
      const hopFees = [DEFAULT_FEE, 100];
      const hopTickSpacings = [DEFAULT_TICK_SPACING, 1];

      const tradePath = [nativeTokenAddress, USDbC_ADDRESS, USDC_ADDRESS];
      const extraArgs = buildExtraArgs(tradePath, hopFees, hopTickSpacings);

      const destAmount = await uniSwapV4.getExpectedReturn({
        srcAmount: ethAmountIn,
        tradePath,
        feeBps: 0,
        extraArgs,
      });
      const minDestAmount = destAmount.mul(97).div(100); // 3% slippage

      const usdcBefore = await usdc.balanceOf(user.address);

      await uniSwapV4.swap(
        {
          srcAmount: ethAmountIn,
          minDestAmount,
          tradePath,
          recipient: user.address,
          feeBps: 0,
          feeReceiver: admin.address,
          extraArgs,
        },
        {value: ethAmountIn}
      );

      const usdcAfter = await usdc.balanceOf(user.address);
      const received = usdcAfter.sub(usdcBefore);
      assert(received.gte(minDestAmount), `received ${received} USDC < minDestAmount ${minDestAmount}`);
      console.log(`  Received: ${received} USDC`);
    });
  });

  // ── admin ──────────────────────────────────────────────────────────────────

  describe('admin', () => {
    it('lists registered routers with their bound stateView/nfpm', async () => {
      const [routers, stateViews, nfpms] = await uniSwapV4.getAllUniRouters();
      assert.equal(routers.length, 1);
      assert.equal(routers[0].toLowerCase(), UNIVERSAL_ROUTER.toLowerCase());
      assert.equal(stateViews[0].toLowerCase(), STATE_VIEW.toLowerCase());
      assert.equal(nfpms[0].toLowerCase(), NFPM.toLowerCase());
    });

    it('allows admin to add and remove routers, binding stateView/nfpm per router', async () => {
      const newRouter = '0x1822946A4f1a625044d93a468DB6DB756d4f89Ff';
      await uniSwapV4.updateUniRouters([newRouter], [STATE_VIEW], [NFPM], true);
      let [routers, stateViews, nfpms] = await uniSwapV4.getAllUniRouters();
      assert(routers.map((r) => r.toLowerCase()).includes(newRouter.toLowerCase()), 'router should be added');
      const addedIdx = routers.map((r) => r.toLowerCase()).indexOf(newRouter.toLowerCase());
      assert.equal(stateViews[addedIdx].toLowerCase(), STATE_VIEW.toLowerCase());
      assert.equal(nfpms[addedIdx].toLowerCase(), NFPM.toLowerCase());

      const cfg = await uniSwapV4.routerConfigs(newRouter);
      assert.equal(cfg.stateView.toLowerCase(), STATE_VIEW.toLowerCase());
      assert.equal(cfg.nfpm.toLowerCase(), NFPM.toLowerCase());

      await uniSwapV4.updateUniRouters([newRouter], [STATE_VIEW], [NFPM], false);
      [routers] = await uniSwapV4.getAllUniRouters();
      assert(!routers.map((r) => r.toLowerCase()).includes(newRouter.toLowerCase()), 'router should be removed');

      const clearedCfg = await uniSwapV4.routerConfigs(newRouter);
      assert.equal(clearedCfg.stateView, ethers.constants.AddressZero);
      assert.equal(clearedCfg.nfpm, ethers.constants.AddressZero);
    });

    it('rejects adding a router with a zero stateView/nfpm', async () => {
      const newRouter = '0x1822946A4f1a625044d93a468DB6DB756d4f89Ff';
      await expect(
        uniSwapV4.updateUniRouters([newRouter], [ethers.constants.AddressZero], [NFPM], true)
      ).to.be.revertedWith('invalid router config');
    });

    it('rejects non-admin router update', async () => {
      await expect(uniSwapV4.connect(user).updateUniRouters([UNIVERSAL_ROUTER], [STATE_VIEW], [NFPM], false)).to.be
        .reverted;
    });

    it('rejects call to swap from non-proxy address', async () => {
      const tradePath = [nativeTokenAddress, USDC_ADDRESS];
      const extraArgs = buildExtraArgs(tradePath);
      await expect(
        uniSwapV4.connect(user).getExpectedReturn({
          srcAmount: ethAmountIn,
          tradePath,
          feeBps: 0,
          extraArgs,
        })
      ).to.be.revertedWith('only swap impl');
    });
  });
});
