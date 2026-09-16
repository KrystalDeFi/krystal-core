import {evm_revert} from './helper';
import {getInitialSetup, IInitialSetup} from './setup';
import {ethers} from 'hardhat';
import {assert} from 'chai';

describe('config test', async () => {
  let setup: IInitialSetup;

  before(async () => {
    setup = await getInitialSetup();
  });

  beforeEach(async () => {
    // await evm_revert(setup.postSetupSnapshotId);
  });

  it('tokens should exist', async () => {
    for (let {address} of Object.values(setup.network.tokens)) {
      await ethers.getContractAt('IERC20Ext', address);
    }
  });

  it('deployed contracts have code onchain', async () => {
    const flatten = (c: any): any[] => {
      let out: any[] = [];
      for (const k in c) {
        const v = c[k];
        if (!v) continue;
        if (v.address) out.push(v);
        else if (typeof v === 'object') out = out.concat(flatten(v));
      }
      return out;
    };
    for (const contract of flatten(setup.krystalContracts)) {
      const code = await ethers.provider.getCode(contract.address);
      assert.notEqual(code, '0x', `no code at ${contract.address}`);
    }
  });
});
