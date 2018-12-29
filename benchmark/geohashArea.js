const SpaceToken = artifacts.require('./SpaceToken.sol');
const MockPolygonUtils = artifacts.require('./mocks/MockPolygonUtils.sol');

const galt = require('@galtproject/utils');
const Web3 = require('web3');
const { initHelperWeb3, initHelperArtifacts, deploySplitMerge } = require('../test/helpers');

const web3 = new Web3(MockPolygonUtils.web3.currentProvider);

initHelperWeb3(web3);
initHelperArtifacts(artifacts);

module.exports = async function(callback) {
  const accounts = await web3.eth.getAccounts();
  const coreTeam = accounts[0];
  let spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
  let splitMerge = await deploySplitMerge(spaceToken.address);

  await calculateArea(['w9cx71g9s1', 'w9cwg7dkdr', 'w9cwfqk3f0', 'w9cx63zs88', 'w9cx71gk90']);

  await redeploy();

  await calculateArea(['w9cx71g9s1', 'w9cwg7dkdr', 'w9cwfqk3f0', 'w9cx63zs88', 'w9cx71gk90'], true);

  callback();

  // Helpers
  async function calculateArea(contour, preCaching = false) {
    const uintContour = contour.map(galt.geohashToGeohash5);
    if (preCaching) {
      await splitMerge.cacheGeohashListToLatLon(uintContour);
    }
    const res = await splitMerge.calculateContourArea(uintContour);
    console.log(
      `      gasUsed for ${contour.length} contour${preCaching ? ' with precaching' : ''}`,
      res.receipt.gasUsed
    );
  }

  async function redeploy() {
    spaceToken = await SpaceToken.new('Space Token', 'SPACE', { from: coreTeam });
    splitMerge = await deploySplitMerge(spaceToken.address);
  }
  // Helpers end
};
