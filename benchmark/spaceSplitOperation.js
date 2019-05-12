const SpaceSplitOperation = artifacts.require('../contracts/SpaceSplitOperation.sol');
const SpaceToken = artifacts.require('../contracts/mocks/SpaceToken.sol');
const Geodesic = artifacts.require('../contracts/mocks/Geodesic.sol');

const _ = require('lodash');
const pIteration = require('p-iteration');
const Web3 = require('web3');
const galt = require('@galtproject/utils');

const { BN } = Web3.utils;

const web3 = new Web3(SpaceSplitOperation.web3.currentProvider);

const { initHelperWeb3, initHelperArtifacts, deploySpaceGeoData, clearLibCache } = require('../test/helpers');

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

module.exports = async function(callback) {
  clearLibCache();

  const accounts = await web3.eth.getAccounts();
  const coreTeam = accounts[0];

  const spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
  const spaceGeoData = await deploySpaceGeoData(spaceToken.address);

  await spaceGeoData.initialize(spaceToken.address, { from: coreTeam });

  const geodesic = Geodesic.at(await spaceGeoData.geodesic());

  await spaceToken.addRoleTo(spaceGeoData.address, 'minter');
  await spaceToken.addRoleTo(spaceGeoData.address, 'burner');

  await spaceGeoData.addRoleTo(coreTeam, await spaceGeoData.GEO_DATA_MANAGER());

  const spaceTokenId = await mintSpaceTokenId(['w24qfpvbmnkt', 'w24qf5ju3pkx', 'w24qfejgkp2p', 'w24qfxqukn80']);
  await splitSpaceTokenByClipping(spaceTokenId, ['w24r42pt2n24', 'w24qfmpp2p00', 'w24qfuvb7zpg', 'w24r50dr2n0n'], true);

  callback();

  // Helpers

  async function splitSpaceTokenByClipping(_spaceTokenId, _clippingGeohashContour, _cacheGeohashes = false) {
    const oldSpaceTokenContour = await getGeohashesContour(_spaceTokenId);

    if (_cacheGeohashes) {
      const geohashesForCache = _.uniq(_clippingGeohashContour.concat(oldSpaceTokenContour));
      const res = await geodesic.cacheGeohashListToLatLon(geohashesForCache.map(galt.geohashToNumber));
      console.log('      geohashToLatLonCache gasUsed', res.receipt.gasUsed);
      console.log('');
    }

    await spaceToken.approve(spaceGeoData.address, _spaceTokenId);

    let res = await spaceGeoData.startSplitOperation(_spaceTokenId, _clippingGeohashContour.map(galt.geohashToNumber));
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
    res = await spaceGeoData.finishSplitOperation(_spaceTokenId);
    console.log('      finishSplitOperation gasUsed', res.receipt.gasUsed);
    totalGasUsed += res.receipt.gasUsed;
    console.log('      totalGasUsed', totalGasUsed);
    console.log('');

    const newSpaceTokenContour = await getGeohashesContour(_spaceTokenId);
    console.log('      spaceToken changed:');
    console.log('      ', JSON.stringify(oldSpaceTokenContour), '=>', JSON.stringify(newSpaceTokenContour));
    const clippingpedContours = await pIteration.mapSeries(res.logs, log => getGeohashesContour(log.args.id));
    console.log('      clippingped spaceTokens:');
    clippingpedContours.forEach(clippingpedContour => {
      console.log('      ', JSON.stringify(clippingpedContour));
    });
    return clippingpedContours;
  }

  async function getGeohashesContour(_spaceTokenId) {
    return (await spaceGeoData.getSpaceTokenContour(_spaceTokenId)).map(geohash =>
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
    const res = await spaceGeoData.initSpaceToken(coreTeam);
    const tokenId = new BN(res.logs[0].args.id.replace('0x', ''), 'hex').toString(10);

    await spaceGeoData.setSpaceTokenContour(tokenId, geohashContour.map(galt.geohashToNumber));
    await spaceGeoData.setSpaceTokenHeights(tokenId, geohashContour.map(() => 10));
    return tokenId;
  }

  // Helpers end
};
