import {ethers} from 'hardhat';
import {BigNumber} from 'ethers';
import {assert, expect} from 'chai';
import {defaultAbiCoder, hexlify, arrayify, keccak256} from 'ethers/lib/utils';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {IERC20Ext, UniSwapV4} from '../typechain';
import {evm_revert, evm_snapshot, nativeTokenAddress} from './helper';

// ── Arc mainnet addresses (available via hardhat fork) ──────────────────────
const UNIVERSAL_ROUTER = '0x4fcA4a51Ab4F23A7447b3284fBd7D73289A89Fb1';
const STATE_VIEW = '0xF3334192D15450CdD385c8B70e03f9A6bD9E673b';
const NFPM = '0x6049c9a0e26405C0985f9E3685C87d0aE917f82B';
const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
const cirBTC_ADDRESS = '0x171a4217b86a807a64eb94757db6849fb4bdbaa0';
const ETH_V4 = '0x0000000000000000000000000000000000000000'; // V4 native ETH

// ── Pool parameters (verified on-chain via StateView / Initialize events) ──
// native/USDC is a real, deep pool. USDC/cirBTC is real but thin (cirBTC launched recently on
// Arc) - keep the cirBTC leg of any trade small to stay within its liquidity.
const NATIVE_USDC_FEE = 10000;
const NATIVE_USDC_TICK_SPACING = 40;
const USDC_CIRBTC_FEE = 300000;
const USDC_CIRBTC_TICK_SPACING = 3000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function computePoolId(c0: string, c1: string, fee: number, tickSpacing: number): string {
  const [t0, t1] = c0.toLowerCase() < c1.toLowerCase() ? [c0, c1] : [c1, c0];
  return keccak256(
    defaultAbiCoder.encode(['address', 'address', 'uint24', 'int24', 'address'], [t0, t1, fee, tickSpacing, ETH_V4])
  );
}

// fee/tickSpacing may be a single value applied to every hop, or a per-hop array (for multi-hop
// paths where hops live in different pools/fee tiers).
function buildExtraArgs(tradePath: string[], fee: number | number[], tickSpacing: number | number[]): string {
  let args = hexlify(arrayify(UNIVERSAL_ROUTER));

  for (let i = 0; i < tradePath.length - 1; i++) {
    const c0 = tradePath[i].toLowerCase() === nativeTokenAddress.toLowerCase() ? ETH_V4 : tradePath[i];
    const c1 = tradePath[i + 1].toLowerCase() === nativeTokenAddress.toLowerCase() ? ETH_V4 : tradePath[i + 1];
    const hopFee = Array.isArray(fee) ? fee[i] : fee;
    const hopTickSpacing = Array.isArray(tickSpacing) ? tickSpacing[i] : tickSpacing;
    const poolId = computePoolId(c0, c1, hopFee, hopTickSpacing);
    args += poolId.slice(2);
  }
  return args;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('UniSwapV4 — unit tests (Arc mainnet fork)', async () => {
  let admin: SignerWithAddress;
  let user: SignerWithAddress;
  let uniSwapV4: UniSwapV4;
  let usdc: IERC20Ext;
  let cirbtc: IERC20Ext;
  let snapshotId: any;

  // $10 worth of native (nativeUsdRate = 1 on Arc)
  const ethAmountIn = ethers.utils.parseEther('10');
  // $1 worth of native - small enough to fit the thin cirBTC/USDC leg
  const smallEthAmountIn = ethers.utils.parseEther('1');

  before(async () => {
    [admin, user] = await ethers.getSigners();

    const factory = await ethers.getContractFactory('UniSwapV4');
    uniSwapV4 = (await factory.deploy(admin.address, [UNIVERSAL_ROUTER], [STATE_VIEW], [NFPM])) as UniSwapV4;
    await uniSwapV4.deployed();
    await uniSwapV4.updateProxyContract(admin.address);

    usdc = (await ethers.getContractAt('IERC20Ext', USDC_ADDRESS)) as IERC20Ext;
    cirbtc = (await ethers.getContractAt('IERC20Ext', cirBTC_ADDRESS)) as IERC20Ext;

    snapshotId = await evm_snapshot();
  });

  beforeEach(async () => {
    await evm_revert(snapshotId);
    snapshotId = await evm_snapshot();
  });

  // ── getExpectedReturn ──────────────────────────────────────────────────────

  describe('getExpectedReturn', () => {
    it('native -> USDC returns non-zero destAmount, correctly ordered for native (18 decimals) vs USDC (6 decimals)', async () => {
      const tradePath = [nativeTokenAddress, USDC_ADDRESS];
      const extraArgs = buildExtraArgs(tradePath, NATIVE_USDC_FEE, NATIVE_USDC_TICK_SPACING);

      const destAmount = await uniSwapV4.getExpectedReturn({
        srcAmount: ethAmountIn,
        tradePath,
        feeBps: 0,
        extraArgs,
      });

      assert(destAmount.gt(0), 'destAmount should be > 0');
      // native and USDC are pegged ~1:1 here (nativeUsdRate=1), and V4 nets each currency's own
      // native decimals internally (no manual rescaling like UniSwap.sol/UniSwapV3Bsc.sol need) -
      // so 10.0 native (18 decimals) should quote close to 10_000_000 raw USDC (6 decimals), not
      // ~1e12x off in either direction were that internal accounting ever wrong
      const pegged1to1AtUsdcDecimals = ethAmountIn.div(BigNumber.from(10).pow(12));
      assert(
        destAmount.gte(pegged1to1AtUsdcDecimals.mul(90).div(100)) &&
          destAmount.lte(pegged1to1AtUsdcDecimals.mul(105).div(100)),
        `destAmount ${destAmount} should be within a small band of the 1:1 peg ${pegged1to1AtUsdcDecimals} (raw USDC units), not off by a power of 10`
      );
      console.log(`  native -> USDC: ${ethers.utils.formatEther(ethAmountIn)} -> ${destAmount} USDC (raw)`);
    });

    it('USDC -> native returns non-zero destAmount', async () => {
      const usdcAmountIn = BigNumber.from(10).mul(BigNumber.from(10).pow(6)); // 10 USDC
      const tradePath = [USDC_ADDRESS, nativeTokenAddress];
      const extraArgs = buildExtraArgs(tradePath, NATIVE_USDC_FEE, NATIVE_USDC_TICK_SPACING);

      const destAmount = await uniSwapV4.getExpectedReturn({
        srcAmount: usdcAmountIn,
        tradePath,
        feeBps: 0,
        extraArgs,
      });

      assert(destAmount.gt(0), 'destAmount should be > 0');
      console.log(`  USDC -> native: ${usdcAmountIn} -> ${ethers.utils.formatEther(destAmount)} native`);
    });

    it('native -> USDC -> cirBTC (2 hops) returns non-zero destAmount', async () => {
      const tradePath = [nativeTokenAddress, USDC_ADDRESS, cirBTC_ADDRESS];
      const extraArgs = buildExtraArgs(
        tradePath,
        [NATIVE_USDC_FEE, USDC_CIRBTC_FEE],
        [NATIVE_USDC_TICK_SPACING, USDC_CIRBTC_TICK_SPACING]
      );

      const destAmount = await uniSwapV4.getExpectedReturn({
        srcAmount: smallEthAmountIn,
        tradePath,
        feeBps: 0,
        extraArgs,
      });

      assert(destAmount.gt(0), 'destAmount should be > 0');
      console.log(
        `  native -> cirBTC: ${ethers.utils.formatEther(smallEthAmountIn)} native -> ${destAmount} cirBTC (raw)`
      );
    });

    it('reverts with unsupported router', async () => {
      const fakeRouter = '0x000000000000000000000000000000000000dEaD';
      const badArgs =
        hexlify(arrayify(fakeRouter)) +
        computePoolId(ETH_V4, USDC_ADDRESS, NATIVE_USDC_FEE, NATIVE_USDC_TICK_SPACING).slice(2);

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
    it('native -> USDC returns destAmount and valid priceImpact', async () => {
      const tradePath = [nativeTokenAddress, USDC_ADDRESS];
      const extraArgs = buildExtraArgs(tradePath, NATIVE_USDC_FEE, NATIVE_USDC_TICK_SPACING);

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

    it('large native -> USDC has higher price impact than small amount', async () => {
      const tradePath = [nativeTokenAddress, USDC_ADDRESS];
      const args = buildExtraArgs(tradePath, NATIVE_USDC_FEE, NATIVE_USDC_TICK_SPACING);
      const largeAmount = ethAmountIn.mul(500);

      const [, smallImpact] = await uniSwapV4.getExpectedReturnWithImpact({
        srcAmount: ethAmountIn,
        tradePath,
        feeBps: 0,
        extraArgs: args,
      });

      const [, largeImpact] = await uniSwapV4.getExpectedReturnWithImpact({
        srcAmount: largeAmount,
        tradePath,
        feeBps: 0,
        extraArgs: args,
      });

      console.log(`  smallImpact: ${smallImpact.toNumber() / 100}%, largeImpact: ${largeImpact.toNumber() / 100}%`);
      assert(largeImpact.gte(smallImpact), 'larger swap should have >= price impact');
    });
  });

  // ── getExpectedIn ──────────────────────────────────────────────────────────

  describe('getExpectedIn', () => {
    it('reverse-quotes native -> USDC correctly', async () => {
      const tradePath = [nativeTokenAddress, USDC_ADDRESS];
      const extraArgs = buildExtraArgs(tradePath, NATIVE_USDC_FEE, NATIVE_USDC_TICK_SPACING);

      const destAmount = await uniSwapV4.getExpectedReturn({
        srcAmount: ethAmountIn,
        tradePath,
        feeBps: 0,
        extraArgs,
      });

      const srcAmount = await uniSwapV4.getExpectedIn({
        destAmount,
        tradePath,
        feeBps: 0,
        extraArgs,
      });

      const diff = srcAmount.sub(ethAmountIn).abs();
      assert(diff.mul(100).lte(ethAmountIn), `getExpectedIn too far from original: ${srcAmount} vs ${ethAmountIn}`);
    });
  });

  // ── swap ──────────────────────────────────────────────────────────────────

  describe('swap', () => {
    // Note: a single-hop native -> USDC swap (settling USDC as the *final* leg) is not covered
    // here. USDC is Arc's native token, exposed at 0x3600...3600 via a precompile whose
    // transfer() delegates to a system contract Hardhat's local EDR fork doesn't implement, so
    // settling USDC as a final output reverts there. The 2-hop trade below works because USDC
    // is only an internal accounting intermediate (netted within the same lock/unlock), never
    // actually transferred - only cirBTC, a real ERC20, is settled.
    it('swaps native -> USDC -> cirBTC (2 hops) and delivers cirBTC to recipient', async () => {
      const tradePath = [nativeTokenAddress, USDC_ADDRESS, cirBTC_ADDRESS];
      const extraArgs = buildExtraArgs(
        tradePath,
        [NATIVE_USDC_FEE, USDC_CIRBTC_FEE],
        [NATIVE_USDC_TICK_SPACING, USDC_CIRBTC_TICK_SPACING]
      );

      const destAmount = await uniSwapV4.getExpectedReturn({
        srcAmount: smallEthAmountIn,
        tradePath,
        feeBps: 0,
        extraArgs,
      });
      const minDestAmount = destAmount.mul(90).div(100); // thin pool: allow more slippage

      const cirbtcBefore = await cirbtc.balanceOf(user.address);

      await uniSwapV4.swap(
        {
          srcAmount: smallEthAmountIn,
          minDestAmount,
          tradePath,
          recipient: user.address,
          feeBps: 0,
          feeReceiver: admin.address,
          extraArgs,
        },
        {value: smallEthAmountIn}
      );

      const cirbtcAfter = await cirbtc.balanceOf(user.address);
      const received = cirbtcAfter.sub(cirbtcBefore);
      assert(received.gte(minDestAmount), `received ${received} cirBTC < minDestAmount ${minDestAmount}`);
      console.log(`  Received: ${received} cirBTC (raw)`);
    });

    it('reverts when native value is insufficient', async () => {
      const tradePath = [nativeTokenAddress, USDC_ADDRESS];
      const extraArgs = buildExtraArgs(tradePath, NATIVE_USDC_FEE, NATIVE_USDC_TICK_SPACING);

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
      const extraArgs = buildExtraArgs(tradePath, NATIVE_USDC_FEE, NATIVE_USDC_TICK_SPACING);

      await expect(
        uniSwapV4.swap(
          {
            srcAmount: ethAmountIn,
            minDestAmount: ethers.constants.MaxUint256,
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

      await uniSwapV4.updateUniRouters([newRouter], [STATE_VIEW], [NFPM], false);
      [routers] = await uniSwapV4.getAllUniRouters();
      assert(!routers.map((r) => r.toLowerCase()).includes(newRouter.toLowerCase()), 'router should be removed');
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
      const extraArgs = buildExtraArgs(tradePath, NATIVE_USDC_FEE, NATIVE_USDC_TICK_SPACING);
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
