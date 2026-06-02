import {ethers} from 'hardhat';
import {defaultAbiCoder, keccak256} from 'ethers/lib/utils';

const STATE_VIEW = '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71';
const ETH = '0x0000000000000000000000000000000000000000';
const WETH = '0x4200000000000000000000000000000000000006';
const HOOKS_ZERO = '0x0000000000000000000000000000000000000000';

const TOKENS: Record<string, string> = {
  USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  cbBTC: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',
};

const FEE_TIERS = [
  {fee: 100, tickSpacing: 1},
  {fee: 500, tickSpacing: 10},
  {fee: 2500, tickSpacing: 50},
  {fee: 3000, tickSpacing: 60},
  {fee: 10000, tickSpacing: 200},
];

function poolId(c0: string, c1: string, fee: number, tickSpacing: number, hooks = HOOKS_ZERO): string {
  const [t0, t1] = c0.toLowerCase() < c1.toLowerCase() ? [c0, c1] : [c1, c0];
  return keccak256(
    defaultAbiCoder.encode(['address', 'address', 'uint24', 'int24', 'address'], [t0, t1, fee, tickSpacing, hooks])
  );
}

async function main() {
  const iface = new ethers.utils.Interface([
    'function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee)',
  ]);
  const stateView = new ethers.Contract(STATE_VIEW, iface, ethers.provider);

  // Sanity check: verify stateView has code
  const code = await ethers.provider.getCode(STATE_VIEW);
  console.log(`StateView code length: ${code.length} bytes`);

  for (const [symbol, addr] of Object.entries(TOKENS)) {
    for (const nativeCurrency of [
      {label: 'ETH(addr0)', addr: ETH},
      {label: 'WETH', addr: WETH},
    ]) {
      console.log(`\n=== ${nativeCurrency.label} / ${symbol} ===`);
      for (const {fee, tickSpacing} of FEE_TIERS) {
        const id = poolId(nativeCurrency.addr, addr, fee, tickSpacing);
        try {
          const [sqrtPrice, tick, , lpFee] = await stateView.getSlot0(id);
          const exists = !sqrtPrice.isZero();
          if (exists) {
            console.log(
              `  fee=${fee} tickSpacing=${tickSpacing}: EXISTS sqrtPriceX96=${sqrtPrice} tick=${tick} lpFee=${lpFee}`
            );
          } else {
            console.log(`  fee=${fee} tickSpacing=${tickSpacing}: not initialized (sqrtPrice=0)`);
          }
        } catch (e: any) {
          console.log(`  fee=${fee} tickSpacing=${tickSpacing}: REVERT - ${e.message?.slice(0, 80)}`);
        }
      }
    }
  }
}

main().catch(console.error);
