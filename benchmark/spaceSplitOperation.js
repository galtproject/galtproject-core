const SpaceSplitOperation = artifacts.require('../contracts/SpaceSplitOperation.sol');
const SpaceToken = artifacts.require('../contracts/mocks/SpaceToken.sol');

const _ = require('lodash');
const pIteration = require('p-iteration');
const Web3 = require('web3');
const galt = require('@galtproject/utils');

const { BN } = Web3.utils;

const web3 = new Web3(SpaceSplitOperation.web3.currentProvider);

const {
  initHelperWeb3,
  initHelperArtifacts,
  zeroAddress,
  deploySplitMerge,
  clearLibCache
} = require('../test/helpers');

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

module.exports = async function(callback) {
  clearLibCache();

  const accounts = await web3.eth.getAccounts();
  const coreTeam = accounts[0];

  const spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
  let splitMerge;
  try {
    splitMerge = await deploySplitMerge();
  } catch (e) {
    console.error(e);
  }

  // const splitMergeWeb3 = new web3.eth.Contract(splitMerge.abi, splitMerge.address);

  await splitMerge.initialize(spaceToken.address, zeroAddress, { from: coreTeam });
  await spaceToken.initialize('SpaceToken', 'SPACE', { from: coreTeam });

  await spaceToken.addRoleTo(splitMerge.address, 'minter');
  await spaceToken.addRoleTo(splitMerge.address, 'burner');
  await spaceToken.addRoleTo(splitMerge.address, 'operator');

  await splitMerge.addRoleTo(coreTeam, 'geo_data_manager');

  const spaceTokenId = await mintSpaceTokenId(['w24qfpvbmnkt', 'w24qf5ju3pkx', 'w24qfejgkp2p', 'w24qfxqukn80']);
  await splitSpaceTokenByCrop(spaceTokenId, ['w24r42pt2n24', 'w24qfmpp2p00', 'w24qfuvb7zpg', 'w24r50dr2n0n'], true);

  callback();

  // Helpers

  async function splitSpaceTokenByCrop(_spaceTokenId, _cropGeohashContour, _cacheGeohashes = false) {
    const oldSpaceTokenContour = await getGeohashesContour(_spaceTokenId);

    if (_cacheGeohashes) {
      const geohashesForCache = _.uniq(_cropGeohashContour.concat(oldSpaceTokenContour));
      const res = await splitMerge.cacheGeohashListToLatLon(geohashesForCache.map(galt.geohashToNumber));
      console.log('      geohashToLatLonCache gasUsed', res.receipt.gasUsed);
      console.log('');
    }

    let res = await splitMerge.startSplitOperation(_spaceTokenId, _cropGeohashContour.map(galt.geohashToNumber));
    console.log('      startSplitOperation gasUsed', res.receipt.gasUsed);

    let totalGasUsed = res.receipt.gasUsed;

    const splitOperation = await SpaceSplitOperation.at(res.logs[0].args.splitOperation);
    res = await splitOperation.prepareAndInitAllPolygons();
    console.log('      prepareAndInitAllPolygons gasUsed', res.receipt.gasUsed);
    totalGasUsed += res.receipt.gasUsed;
    res = await splitOperation.addAllPolygonsSegments();
    console.log('      addAllPolygonsSegments gasUsed', res.receipt.gasUsed);
    totalGasUsed += res.receipt.gasUsed;

    totalGasUsed += await processMartinezRueda(splitOperation);

    res = await splitOperation.processWeilerAtherton();
    console.log('      processWeilerAtherton gasUsed', res.receipt.gasUsed);
    totalGasUsed += res.receipt.gasUsed;
    res = await splitOperation.finishAllPolygons();
    console.log('      finishAllPolygons gasUsed', res.receipt.gasUsed);
    totalGasUsed += res.receipt.gasUsed;
    res = await splitMerge.finishSplitOperation(_spaceTokenId);
    console.log('      finishSplitOperation gasUsed', res.receipt.gasUsed);
    totalGasUsed += res.receipt.gasUsed;
    console.log('      totalGasUsed', totalGasUsed);
    console.log('');

    const newSpaceTokenContour = await getGeohashesContour(_spaceTokenId);
    console.log('      spaceToken changed:');
    console.log('      ', JSON.stringify(oldSpaceTokenContour), '=>', JSON.stringify(newSpaceTokenContour));
    const croppedContours = await pIteration.mapSeries(res.logs, log => getGeohashesContour(log.args.id));
    console.log('      cropped spaceTokens:');
    croppedContours.forEach(croppedContour => {
      console.log('      ', JSON.stringify(croppedContour));
    });
    return croppedContours;
  }

  async function getGeohashesContour(_spaceTokenId) {
    return (await splitMerge.getPackageContour(_spaceTokenId)).map(geohash =>
      galt.numberToGeohash(geohash.toString(10))
    );
  }

  async function processMartinezRueda(splitOperation) {
    const doneStage = await splitOperation.doneStage();
    if (doneStage >= 5) {
      return 0;
    }
    const res = await splitOperation.processMartinezRueda();
    console.log('      processMartinezRueda gasUsed', res.receipt.gasUsed);

    return res.receipt.gasUsed + (await processMartinezRueda(splitOperation));
  }

  async function mintSpaceTokenId(geohashContour) {
    const res = await splitMerge.initPackage(coreTeam);
    const tokenId = new BN(res.logs[0].args.id.replace('0x', ''), 'hex').toString(10);

    await splitMerge.setPackageContour(tokenId, geohashContour.map(galt.geohashToNumber));
    await splitMerge.setPackageHeights(tokenId, geohashContour.map(() => 10), {
      from: coreTeam
    });
    return tokenId;
  }

  // Helpers end
};
