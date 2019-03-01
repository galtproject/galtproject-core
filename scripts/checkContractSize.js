const fs = require('fs');
const Table = require('cli-table');

const table = new Table({
  head: ['Contract', 'Size (bytes)'],
  colWidths: [50, 10]
});

const testFolder = './build/contracts/';

const contracts = [];

fs.readdirSync(testFolder).forEach(file => {
  contracts.push([file.substring(0, file.length - 5), getSize(file)]);
});

contracts.sort(function(a, b) {
  return a[1] - b[1];
});

contracts.forEach(value => {
  table.push(value);
});

console.log(table.toString());
console.log('\n Size cap is about', 24577, '\n');

/**
 * Get contract size in bytes
 *
 * @param contract
 * @returns {number}
 */
function getSize(contract) {
  let abi;
  try {
    abi = JSON.parse(fs.readFileSync(`build/contracts/${contract}`));
    return Buffer.byteLength(abi.deployedBytecode, 'utf8') / 2;
  } catch (e) {
    return 0;
  }
}
