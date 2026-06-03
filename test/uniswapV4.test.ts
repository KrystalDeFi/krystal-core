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

function buildExtraArgs(tradePath: string[], fee = DEFAULT_FEE, tickSpacing = DEFAULT_TICK_SPACING): string {
  // header: <router 20B><stateView 20B><nfpm 20B>
  let args =
    hexlify(arrayify(UNIVERSAL_ROUTER)) +
    arrayify(STATE_VIEW).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '') +
    arrayify(NFPM).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '');

  // per hop: <poolId 32B>
  for (let i = 0; i < tradePath.length - 1; i++) {
    const c0 = tradePath[i].toLowerCase() === nativeTokenAddress.toLowerCase() ? ETH_V4 : tradePath[i];
    const c1 = tradePath[i + 1].toLowerCase() === nativeTokenAddress.toLowerCase() ? ETH_V4 : tradePath[i + 1];
    const poolId = computePoolId(c0, c1, fee, tickSpacing);
    console.log(`Hop ${i}: ${tradePath[i]} → ${tradePath[i + 1]}, poolId: ${poolId}`);
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
  let snapshotId: any;

  // $10 worth of ETH at ~$2000/ETH
  const ethAmountIn = ethers.utils.parseEther('0.005');
  // $10 worth of USDC
  const usdcAmountIn = BigNumber.from(10).mul(BigNumber.from(10).pow(6)); // 10 USDC (6 decimals)

  before(async () => {
    [admin, user] = await ethers.getSigners();

    // Deploy UniSwapV4 with admin as the proxy contract (bypasses onlyProxyContract)
    const factory = await ethers.getContractFactory('UniSwapV4');
    uniSwapV4 = (await factory.deploy(admin.address, [UNIVERSAL_ROUTER])) as UniSwapV4;
    await uniSwapV4.deployed();

    // Register admin as the proxy so we can call swap/quote functions directly
    await uniSwapV4.updateProxyContract(admin.address);

    usdc = (await ethers.getContractAt('IERC20Ext', USDC_ADDRESS)) as IERC20Ext;

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
        arrayify(STATE_VIEW).reduce((s, b) => s + b.toString(16).padStart(2, '0'), '') +
        computePoolId(ETH_V4, USDC_ADDRESS, DEFAULT_FEE, DEFAULT_TICK_SPACING).slice(2) +
        (DEFAULT_TICK_SPACING & 0xffffff).toString(16).padStart(6, '0');

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
  });

  // ── admin ──────────────────────────────────────────────────────────────────

  describe('admin', () => {
    it('lists registered routers', async () => {
      const routers = await uniSwapV4.getAllUniRouters();
      assert.equal(routers.length, 1);
      assert.equal(routers[0].toLowerCase(), UNIVERSAL_ROUTER.toLowerCase());
    });

    it('allows admin to add and remove routers', async () => {
      const newRouter = '0x1822946A4f1a625044d93a468DB6DB756d4f89Ff';
      await uniSwapV4.updateUniRouters([newRouter], true);
      let routers = await uniSwapV4.getAllUniRouters();
      assert(routers.map((r) => r.toLowerCase()).includes(newRouter.toLowerCase()), 'router should be added');

      await uniSwapV4.updateUniRouters([newRouter], false);
      routers = await uniSwapV4.getAllUniRouters();
      assert(!routers.map((r) => r.toLowerCase()).includes(newRouter.toLowerCase()), 'router should be removed');
    });

    it('rejects non-admin router update', async () => {
      await expect(uniSwapV4.connect(user).updateUniRouters([UNIVERSAL_ROUTER], false)).to.be.reverted;
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
