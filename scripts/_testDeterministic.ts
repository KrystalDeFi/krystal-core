import {ethers, network} from 'hardhat';
import {deploy} from './deployLogic';

async function main() {
  console.log('=== network:', network.name, '===');
  const [signer] = await ethers.getSigners();

  console.log('\n\n########## FIRST DEPLOY (expect real CREATE2 deployments) ##########\n');
  const first = await deploy(undefined, {from: signer.address});

  console.log('\n\n########## SECOND DEPLOY, same chain, no existingContract map ##########');
  console.log('########## (expect every contract to be detected as already deployed and skipped) ##########\n');
  const second = await deploy(undefined, {from: signer.address});

  console.log('\n\n=== RESULT ===');
  const flatten = (c: any, prefix = ''): Record<string, string> => {
    let out: Record<string, string> = {};
    for (const k in c) {
      const v = c[k];
      if (!v) continue;
      if (v.address) out[prefix + k] = v.address;
      else if (typeof v === 'object') Object.assign(out, flatten(v, prefix + k + '.'));
    }
    return out;
  };
  const a = flatten(first);
  const b = flatten(second);
  let allMatch = true;
  for (const k of Object.keys(a)) {
    const same = a[k] === b[k];
    if (!same) allMatch = false;
    console.log(`${k}: ${a[k]} === ${b[k]} -> ${same}`);
  }
  console.log('\nAll addresses identical across both deploy() calls:', allMatch);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
