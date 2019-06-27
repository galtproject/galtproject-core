const Statements = artifacts.require('./Statements.sol');

const Web3 = require('web3');
const { initHelperWeb3 } = require('../helpers');

const web3 = new Web3(Statements.web3.currentProvider);

Statements.numberFormat = 'String';

initHelperWeb3(web3);

contract('Statements', accounts => {
  const [coreTeam, alice, bob] = accounts;

  beforeEach(async function() {
    this.statements = await Statements.new({ from: coreTeam });
  });

  it('should increment track account message count', async function() {
    assert.equal(await this.statements.getStatementCount(alice), 0);
    await this.statements.addStatement('foo', 'bar', { from: alice });
    assert.equal(await this.statements.getStatementCount(alice), 1);
    await this.statements.addStatement('foo', 'bar', { from: alice });
    assert.equal(await this.statements.getStatementCount(alice), 2);
    await this.statements.addStatement('foo', 'bar', { from: alice });
    assert.equal(await this.statements.getStatementCount(alice), 3);
  });

  it('should store data correctly', async function() {
    assert.equal(await this.statements.getStatementCount(alice), 0);

    let res = await this.statements.addStatement('foo', 'blah', { from: alice });
    assert.equal(res.logs[0].args.addr, alice);
    assert.equal(res.logs[0].args.id, 0);

    res = await this.statements.addStatement('hack', 'heck', { from: alice });
    assert.equal(res.logs[0].args.addr, alice);
    assert.equal(res.logs[0].args.id, 1);

    res = await this.statements.addStatement('bar', 'buzz', { from: bob });
    assert.equal(res.logs[0].args.addr, bob);
    assert.equal(res.logs[0].args.id, 0);

    res = await this.statements.getStatement(alice, 0);
    assert.equal(res.block.length > 0, true);
    assert.equal(res.subject, 'foo');
    assert.equal(res.statement, 'blah');

    res = await this.statements.getStatement(alice, 1);
    assert.equal(res.block.length > 0, true);
    assert.equal(res.subject, 'hack');
    assert.equal(res.statement, 'heck');

    res = await this.statements.getStatement(bob, 0);
    assert.equal(res.block.length > 0, true);
    assert.equal(res.subject, 'bar');
    assert.equal(res.statement, 'buzz');
  });
});
