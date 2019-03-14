const Migrations = artifacts.require('./Migrations.sol');
const Web3 = require('web3');

const web3 = new Web3(Migrations.web3.currentProvider);
console.log('web3', web3.version.toString());

module.exports = function(deployer) {
  deployer.deploy(Migrations);
};
