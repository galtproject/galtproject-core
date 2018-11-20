const PointRedBlackTree = artifacts.require('../contracts/collections/PointRedBlackTree.sol');
const SegmentRedBlackTree = artifacts.require('../contracts/collections/SegmentRedBlackTree.sol');
const ArrayUtils = artifacts.require('../contracts/utils/ArrayUtils.sol');
const LandUtils = artifacts.require('../contracts/utils/LandUtils.sol');
const PolygonUtils = artifacts.require('../contracts/utils/PolygonUtils.sol');
const BentleyOttman = artifacts.require('../contracts/utils/BentleyOttman.sol');
const WeilerAtherton = artifacts.require('../contracts/utils/WeilerAtherton.sol');
const SplitMerge = artifacts.require('../contracts/mocks/SplitMerge.sol');
const SpaceSplitOperation = artifacts.require('../contracts/SpaceSplitOperation.sol');
const SpaceToken = artifacts.require('../contracts/mocks/SpaceToken.sol');

const pIteration = require('p-iteration');
const Web3 = require('web3');
const galt = require('@galtproject/utils');

const { BN } = Web3.utils;

const web3 = new Web3(SplitMerge.web3.currentProvider);

const { initHelperWeb3, zeroAddress, ether } = require('../test/helpers');

initHelperWeb3(web3);

module.exports = async function(callback) {
  const accounts = await web3.eth.getAccounts();
  const coreTeam = accounts[0];
  const landUtils = await LandUtils.new({ from: coreTeam });
  const arrayUtils = await ArrayUtils.new({ from: coreTeam });
  PolygonUtils.link('LandUtils', landUtils.address);
  const polygonUtils = await PolygonUtils.new({ from: coreTeam });

  const pointRedBlackTree = await PointRedBlackTree.new({ from: coreTeam });
  BentleyOttman.link('PointRedBlackTree', pointRedBlackTree.address);

  const segmentRedBlackTree = await SegmentRedBlackTree.new({ from: coreTeam });
  BentleyOttman.link('SegmentRedBlackTree', segmentRedBlackTree.address);

  const bentleyOttman = await BentleyOttman.new({ from: coreTeam });

  WeilerAtherton.link('BentleyOttman', bentleyOttman.address);
  WeilerAtherton.link('PolygonUtils', polygonUtils.address);

  const weilerAtherton = await WeilerAtherton.new({ from: coreTeam });

  SplitMerge.link('LandUtils', landUtils.address);
  SplitMerge.link('ArrayUtils', arrayUtils.address);
  SplitMerge.link('PolygonUtils', polygonUtils.address);
  SplitMerge.link('WeilerAtherton', weilerAtherton.address);

  const spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
  const splitMerge = await SplitMerge.new({ from: coreTeam });

  const splitMergeWeb3 = new web3.eth.Contract(splitMerge.abi, splitMerge.address);

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
      let totalGasUsedForCache = 0;
      await pIteration.forEach(oldSpaceTokenContour, async geohash => {
        const res = await splitMerge.cacheGeohashToLatLon(galt.geohashToNumber(geohash).toString(10));
        totalGasUsedForCache = res.receipt.gasUsed;
      });
      await pIteration.forEach(_cropGeohashContour, async geohash => {
        const res = await splitMerge.cacheGeohashToLatLon(galt.geohashToNumber(geohash).toString(10));
        totalGasUsedForCache = res.receipt.gasUsed;
      });
      console.log('');
      console.log('      totalGasUsedForCache', totalGasUsedForCache);
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

    totalGasUsed += await processBentleyOttman(splitOperation);

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

  async function processBentleyOttman(splitOperation) {
    const doneStage = await splitOperation.doneStage();
    if (doneStage >= 5) {
      return 0;
    }
    const res = await splitOperation.processBentleyOttman();
    console.log('      processBentleyOttman gasUsed', res.receipt.gasUsed);

    return res.receipt.gasUsed + (await processBentleyOttman(splitOperation));
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
