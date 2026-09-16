import {ethers} from 'hardhat';
import {BigNumber} from 'ethers';
import {assert} from 'chai';
import {hexlify, arrayify} from 'ethers/lib/utils';
import {SignerWithAddress} from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import {MockERC20, MockUniV2Router, UniSwap} from '../typechain';
import {nativeTokenAddress} from './helper';

// ── nativeIsErc20 decimal rescaling ──────────────────────────────────────────
// On a chain like Arc, the native sentinel's amounts are always denoted in 18 decimals (the
// standard native-currency convention msg.value uses), but the real ERC20 backing it (Arc's
// USDC precompile) uses only 6. UniSwap.sol must rescale before treating that ERC20 as the
// trade token, or it silently tries to move ~1e12x more (or fewer) units than it actually holds.
//
// This runs entirely on a plain local Hardhat network (no forking) against mock contracts, since
// Arc's real native/USDC precompile can't have its transfer()/transferFrom() exercised on the
// local EDR fork (see uniswapV3Arc.test.ts / uniswapV4Arc.test.ts) - the mocks let this assert on
// the exact rescaled amount deterministically instead of relying on real (unreachable) liquidity.
describe('UniSwap — native/ERC20 decimal rescaling (nativeIsErc20)', async () => {
  let admin: SignerWithAddress;
  let recipient: SignerWithAddress;
  let uniSwap: UniSwap;
  let nativeErc20: MockERC20; // 6 decimals - stands in for Arc's wNative/USDC precompile
  let cirBTCMock: MockERC20; // 8 decimals - stands in for cirBTC
  let router: MockUniV2Router;

  const FIXED_OUT = BigNumber.from(12345); // arbitrary fixed payout the mock router always pays

  function extraArgsFor(routerAddr: string): string {
    return hexlify(arrayify(routerAddr));
  }

  beforeEach(async () => {
    [admin, recipient] = await ethers.getSigners();

    const erc20Factory = await ethers.getContractFactory('MockERC20');
    nativeErc20 = (await erc20Factory.deploy('Native USDC', 'nUSDC', 6)) as MockERC20;
    cirBTCMock = (await erc20Factory.deploy('cirBTC', 'cirBTC', 8)) as MockERC20;

    const routerFactory = await ethers.getContractFactory('MockUniV2Router');
    router = (await routerFactory.deploy(FIXED_OUT)) as MockUniV2Router;

    const uniSwapFactory = await ethers.getContractFactory('UniSwap');
    uniSwap = (await uniSwapFactory.deploy(
      admin.address,
      [router.address],
      nativeErc20.address,
      true // nativeIsErc20
    )) as UniSwap;
    await uniSwap.updateProxyContract(admin.address);
  });

  it('rescales a native (18-decimal) srcAmount down to the real ERC20 (6-decimal) amount', async () => {
    const nativeAmountIn = ethers.utils.parseEther('123.456789'); // 18-decimal "native" amount
    const expectedErc20AmountIn = nativeAmountIn.div(BigNumber.from(10).pow(12)); // -> 6 decimals

    // simulate the native value having already been forwarded and credited as an ERC20 balance,
    // as SmartWalletImplementation does for a real native-sentinel swap (on Arc, sending native
    // currency to an address already *is* an ERC20 balance increase for that same address)
    await nativeErc20.mint(uniSwap.address, expectedErc20AmountIn);
    await cirBTCMock.mint(router.address, FIXED_OUT);

    const cirbtcBefore = await cirBTCMock.balanceOf(recipient.address);

    const destAmount = await uniSwap.callStatic.swap({
      srcAmount: nativeAmountIn,
      minDestAmount: 0,
      tradePath: [nativeTokenAddress, cirBTCMock.address],
      recipient: recipient.address,
      feeBps: 0,
      feeReceiver: admin.address,
      extraArgs: extraArgsFor(router.address),
    });
    await uniSwap.swap({
      srcAmount: nativeAmountIn,
      minDestAmount: 0,
      tradePath: [nativeTokenAddress, cirBTCMock.address],
      recipient: recipient.address,
      feeBps: 0,
      feeReceiver: admin.address,
      extraArgs: extraArgsFor(router.address),
    });

    assert(
      (await router.lastAmountIn()).eq(expectedErc20AmountIn),
      `router should have received the rescaled amount: got ${await router.lastAmountIn()}, expected ${expectedErc20AmountIn}`
    );
    assert(destAmount.eq(FIXED_OUT), `destAmount should equal the mock payout: got ${destAmount}`);
    const cirbtcAfter = await cirBTCMock.balanceOf(recipient.address);
    assert(cirbtcAfter.sub(cirbtcBefore).eq(FIXED_OUT), 'recipient should receive the full payout');
  });

  it('rescales a native (18-decimal) minDestAmount down to the real ERC20 (6-decimal) amount', async () => {
    const cirbtcAmountIn = BigNumber.from(10).pow(8); // 1.0 cirBTC (8 decimals)
    // denominated as "native" (18 decimals): only valid once rescaled down to <= FIXED_OUT (6
    // decimals) - the pre-fix code would pass this 1e12x too large and the mock would revert
    const minDestAmountNative = ethers.utils.parseEther('0.00001'); // -> 1e13 wei -> 1e1 rescaled
    const expectedMinDestAmountErc20 = minDestAmountNative.div(BigNumber.from(10).pow(12));
    assert(expectedMinDestAmountErc20.lte(FIXED_OUT), 'test setup: rescaled min must fit the fixed payout');

    // simulate the src token (a real ERC20, no rescaling involved) already being funded into the
    // swap contract, as SmartWalletImplementation does before calling into a swap adapter
    await cirBTCMock.mint(uniSwap.address, cirbtcAmountIn);
    await nativeErc20.mint(router.address, FIXED_OUT);

    await uniSwap.swap({
      srcAmount: cirbtcAmountIn,
      minDestAmount: minDestAmountNative,
      tradePath: [cirBTCMock.address, nativeTokenAddress],
      recipient: recipient.address,
      feeBps: 0,
      feeReceiver: admin.address,
      extraArgs: extraArgsFor(router.address),
    });

    assert(
      (await router.lastAmountOutMin()).eq(expectedMinDestAmountErc20),
      `router should have been given the rescaled minDestAmount: got ${await router.lastAmountOutMin()}, expected ${expectedMinDestAmountErc20}`
    );
    assert(
      (await nativeErc20.balanceOf(recipient.address)).eq(FIXED_OUT),
      'recipient should receive the full ERC20 payout'
    );
  });

  it('does not rescale amounts for a real ERC20 <-> ERC20 trade', async () => {
    const daiMock = (await (await ethers.getContractFactory('MockERC20')).deploy('DAI', 'DAI', 18)) as MockERC20;
    const srcAmount = BigNumber.from(10).pow(18); // 1.0 DAI (18 decimals) - not the native sentinel

    await daiMock.mint(uniSwap.address, srcAmount);
    await cirBTCMock.mint(router.address, FIXED_OUT);

    await uniSwap.swap({
      srcAmount,
      minDestAmount: 0,
      tradePath: [daiMock.address, cirBTCMock.address],
      recipient: recipient.address,
      feeBps: 0,
      feeReceiver: admin.address,
      extraArgs: extraArgsFor(router.address),
    });

    assert((await router.lastAmountIn()).eq(srcAmount), 'non-native amounts must pass through unscaled');
  });
});
