const LandUtils = artifacts.require('./utils/LandUtils.sol');
const MockLandUtils = artifacts.require('./mocks/MockLandUtils.sol');

const pIteration = require('p-iteration');
const Web3 = require('web3');

const web3 = new Web3(LandUtils.web3.currentProvider);

contract('LandUtils', ([deployer]) => {
  beforeEach(async function() {
    this.utils = await LandUtils.new({ from: deployer });

    MockLandUtils.link('LandUtils', this.utils.address);
    this.mockLandUtils = await MockLandUtils.new({ from: deployer });
  });

  describe('#geohash5ToLatLonArr()', () => {
    it('should correctly convert geohash5 to lat lon', async function() {
      const res = await this.mockLandUtils.geohash5ToLatLonArr(30136808136, {
        from: deployer
      });

      assert.deepEqual(res.logs[0].args.result.map(coor => coor.toString(10)), [
        '1178970336914062500',
        '104513626098632812500'
      ]);
    });
  });

  describe('#latLonToGeohash5()', () => {
    it('should correctly convert lat lon to geohash5', async function() {
      const res = await this.mockLandUtils.latLonToGeohash5(['1178970336914062500', '104513626098632812500'], 7, {
        from: deployer
      });

      assert.deepEqual(res.logs[0].args.result.toString(10), '30136808136');
    });
  });

  describe('#latLonToUtm()', () => {
    it('should correctly convert lat lon to utm', async function() {
      const latLonToCheck = [
        [-74.0550677213, -90.318972094],
        [25.5888986977, -125.9639064827],
        [11.9419456134, 30.6196556841],
        [66.9375384427, -9.6290061374],
        [-1.9773564645, 134.3986143967]
      ];

      const shouldBeUtmByIndex = [
        { zone: 15, h: 'S', x: 582184.914156, y: 1779969.098105, convergence: -2.578020654, scale: 0.99968257906 },
        { zone: 10, h: 'N', x: 202270.551102, y: 2833486.274605, convergence: -1.281088775, scale: 1.000694737455 },
        { zone: 36, h: 'N', x: 240753.909523, y: 1321248.884905, convergence: -0.492818697, scale: 1.000431591336 },
        { zone: 29, h: 'N', x: 472503.837058, y: 7424555.961089, convergence: -0.578738506, scale: 0.999609252979 },
        { zone: 53, h: 'S', x: 433119.186937, y: 9781429.716413, convergence: 0.020751304, scale: 0.999655369864 }
      ];

      await pIteration.forEach(latLonToCheck, async (point, index) => {
        const shouldBeUtm = shouldBeUtmByIndex[index];

        const etherPoint = point.map(coor => web3.utils.toWei(coor.toString(), 'ether'));

        const res = await this.mockLandUtils.latLonToUtm(etherPoint, {
          from: deployer
        });

        const result = res.logs[0].args;
        const xResult = result.x / 10 ** 18;
        const yResult = result.y / 10 ** 18;
        const scaleResult = result.scale / 10 ** 18;
        // const convergenceResult = result.convergence / 10 ** 18;

        // console.log('xDiff', Math.abs(xResult - shouldBeUtm.x));
        // console.log('yDiff', Math.abs(yResult - shouldBeUtm.y));
        // console.log('scaleDiff', Math.abs(scaleResult - shouldBeUtm.scale));
        // console.log('convergenceDiff', Math.abs(convergenceResult - shouldBeUtm.convergence));
        //
        // console.log('gasUsed', res.receipt.gasUsed);

        assert.isBelow(Math.abs(xResult - shouldBeUtm.x), 0.007);
        assert.isBelow(Math.abs(yResult - shouldBeUtm.y), 0.007);
        assert.isBelow(Math.abs(scaleResult - shouldBeUtm.scale), 0.001);
        // assert.isBelow(Math.abs(convergenceResult - shouldBeUtm.convergence), 0.001);
        assert.equal(result.zone.toString(10), shouldBeUtm.zone.toString(10));
        assert.equal(result.isNorth ? 'N' : 'S', shouldBeUtm.h);
      });
    });
  });
});
