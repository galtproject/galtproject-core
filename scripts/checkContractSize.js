const fs = require('fs');

console.log('\nSize limit is about', 24577, '\n');
checkSize('PlotManager');
checkSize('PlotClarificationManager');
checkSize('SplitMerge');
checkSize('SpaceToken');
checkSize('GaltToken');
checkSize('GaltDex');
checkSize('Validators');
console.log('\n');

function checkSize(contract) {
  let abi;
  try {
    abi = JSON.parse(fs.readFileSync(`build/contracts/${contract}.json`));
  } catch (e) {
    return;
  }
  console.log(contract, Buffer.byteLength(abi.deployedBytecode, 'utf8') / 2, 'bytes');
}
