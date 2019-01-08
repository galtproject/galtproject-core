const LandUtils = artifacts.require('./utils/LandUtils.sol');
const MockLandUtils = artifacts.require('./mocks/MockLandUtils.sol');

const Web3 = require('web3');
const { assertRevert } = require('../helpers');

const web3 = new Web3(LandUtils.web3.currentProvider);

contract('LandUtils', ([deployer]) => {
  beforeEach(async function() {
    this.utils = await LandUtils.new({ from: deployer });
    this.utils3 = new web3.eth.Contract(this.utils.abi, this.utils.address);

    MockLandUtils.link('LandUtils', this.utils.address);
    this.mockLandUtils = await MockLandUtils.new({ from: deployer });
  });

  describe('#geohash5Precision()', () => {
    it('provide correct results', async function() {
      assert.equal(await this.utils3.methods.geohash5Precision('1').call(), 1);
      assert.equal(await this.utils3.methods.geohash5Precision('15').call(), 1);
      assert.equal(await this.utils3.methods.geohash5Precision('31').call(), 1);
      assert.equal(await this.utils3.methods.geohash5Precision('32').call(), 2);
      assert.equal(await this.utils3.methods.geohash5Precision('1023').call(), 2);
      assert.equal(await this.utils3.methods.geohash5Precision('1024').call(), 3);
      assert.equal(await this.utils3.methods.geohash5Precision('32767').call(), 3);
      assert.equal(await this.utils3.methods.geohash5Precision('32768').call(), 4);
      assert.equal(await this.utils3.methods.geohash5Precision('1048575').call(), 4);
      assert.equal(await this.utils3.methods.geohash5Precision('1048576').call(), 5);
      assert.equal(await this.utils3.methods.geohash5Precision('33554431').call(), 5);
      assert.equal(await this.utils3.methods.geohash5Precision('33554432').call(), 6);
      assert.equal(await this.utils3.methods.geohash5Precision('1073741823').call(), 6);
      assert.equal(await this.utils3.methods.geohash5Precision('1073741824').call(), 7);
      assert.equal(await this.utils3.methods.geohash5Precision('34359738367').call(), 7);
      assert.equal(await this.utils3.methods.geohash5Precision('34359738368').call(), 8);
      assert.equal(await this.utils3.methods.geohash5Precision('1099511627775').call(), 8);
      assert.equal(await this.utils3.methods.geohash5Precision('1099511627776').call(), 9);
      assert.equal(await this.utils3.methods.geohash5Precision('35184372088831').call(), 9);
      assert.equal(await this.utils3.methods.geohash5Precision('35184372088832').call(), 10);
      assert.equal(await this.utils3.methods.geohash5Precision('1125899906842623').call(), 10);
      assert.equal(await this.utils3.methods.geohash5Precision('1125899906842624').call(), 11);
      assert.equal(await this.utils3.methods.geohash5Precision('36028797018963967').call(), 11);
      assert.equal(await this.utils3.methods.geohash5Precision('36028797018963968').call(), 12);
      assert.equal(await this.utils3.methods.geohash5Precision('1152921504606846975').call(), 12);
    });

    it('should return 0 on 0 input', async function() {
      assert.equal(await this.utils3.methods.geohash5Precision('0').call(), 0);
    });

    it('should revert if a value is greater than max', async function() {
      // max is 1152921504606846975
      await assertRevert(this.utils3.methods.geohash5Precision('1152921504606846976').call());
    });
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
      const point = [1.1789703369140625, 104.51362609863281];

      const shouldBeUtm = toUtm(point[0], point[1]);

      // console.log('shouldBeUtm', shouldBeUtm);
      assert.equal(shouldBeUtm.zone, 48);
      assert.equal(shouldBeUtm.h, 'N');
      assert.equal(shouldBeUtm.x, 445889.489065);
      assert.equal(shouldBeUtm.y, 130316.555968);
      assert.equal(shouldBeUtm.convergence, -0.010007613);
      assert.equal(shouldBeUtm.scale, 0.999636244047);

      // assert.equal(true, false);
      // return;

      /**
 { zone: 48,
  h: 'N',
  x: 445889.489065,
  y: 130316.555968,
  convergence: -0.010007613,
  scale: 0.999636244047 }

         */

      const etherPoint = point.map(coor => web3.utils.toWei(coor.toString(), 'ether'));
      // console.log(etherPoint);

      const res = await this.mockLandUtils.latLonToUtm(etherPoint, {
        from: deployer
      });

      assert.equal(true, false);
      assert.deepEqual(res.logs[0].args.result.toString(10), shouldBeUtm);
    });
  });
});

function toUtm(_lat, _lon) {
  if (!(_lat >= -80 && _lat <= 84)) throw new Error('Outside UTM limits');

  const falseEasting = 500e3;

  const falseNorthing = 10000e3;

  let zone = Math.floor((_lon + 180) / 6) + 1; // longitudinal zone
  let λ0 = ((zone - 1) * 6 - 180 + 3).toRadians(); // longitude of central meridian

  // ---- handle Norway/Svalbard exceptions
  // grid zones are 8° tall; 0°N is offset 10 into latitude bands array
  const latBand = Math.floor(_lat / 8 + 10);
  // adjust zone & central meridian for Norway
  if (zone === 31 && latBand === 17 && _lon >= 3) {
    zone++;
    λ0 += (6).toRadians();
  }
  // adjust zone & central meridian for Svalbard
  if (zone === 32 && (latBand === 19 || latBand === 20) && _lon < 9) {
    zone--;
    λ0 -= (6).toRadians();
  }
  if (zone === 32 && (latBand === 19 || latBand === 20) && _lon >= 9) {
    zone++;
    λ0 += (6).toRadians();
  }
  if (zone === 34 && (latBand === 19 || latBand === 20) && _lon < 21) {
    zone--;
    λ0 -= (6).toRadians();
  }
  if (zone === 34 && (latBand === 19 || latBand === 20) && _lon >= 21) {
    zone++;
    λ0 += (6).toRadians();
  }
  if (zone === 36 && (latBand === 19 || latBand === 20) && _lon < 33) {
    zone--;
    λ0 -= (6).toRadians();
  }
  if (zone === 36 && (latBand === 19 || latBand === 20) && _lon >= 33) {
    zone++;
    λ0 += (6).toRadians();
  }

  const φ = _lat.toRadians(); // latitude ± from equator

  const λ = _lon.toRadians() - λ0; // longitude ± from central meridian

  const a = 6378137;

  const f = 1 / 298.257223563;
  // WGS 84: a = 6378137, b = 6356752.314245, f = 1/298.257223563;

  const k0 = 0.9996; // UTM scale on the central meridian

  // ---- easting, northing: Karney 2011 Eq 7-14, 29, 35:

  const e = Math.sqrt(f * (2 - f)); // eccentricity
  console.log('e', web3.utils.toWei(e.toString(), 'ether'));

  const cosλ = Math.cos(λ);

  const sinλ = Math.sin(λ);

  const tanλ = Math.tan(λ);

  const τ = Math.tan(φ); // τ ≡ tanφ, τʹ ≡ tanφʹ; prime (ʹ) indicates angles on the conformal sphere
  const σ = Math.sinh(e * Math.atanh((e * τ) / Math.sqrt(1 + τ * τ)));
  const τʹ = τ * Math.sqrt(1 + σ * σ) - σ * Math.sqrt(1 + τ * τ);

  const ξʹ = Math.atan2(τʹ, cosλ);
  const ηʹ = Math.asinh(sinλ / Math.sqrt(τʹ * τʹ + cosλ * cosλ));

  console.log('LogVar', 'τʹ', τʹ);
  console.log('LogVar', 'cosλ', cosλ);
  console.log('LogVar', 'ξʹ my_atan2', my_atan2(τʹ, cosλ));
  console.log('LogVar', 'ξʹ', ξʹ);
  console.log('LogVar', 'ηʹ', ηʹ);

  const A = 6367449.145823415; // 2πA is the circumference of a meridian

  console.log('A', web3.utils.toWei(A.toString(), 'ether'));
  const α = [
    null,
    837731820624470 / 10 ** 18,
    760852777357 / 10 ** 18,
    1197645503 / 10 ** 18,
    2429171 / 10 ** 18,
    5712 / 10 ** 18,
    15 / 10 ** 18
  ];

  let ξ = ξʹ;
  for (let j = 1; j <= 6; j++) ξ += α[j] * Math.sin(2 * j * ξʹ) * Math.cosh(2 * j * ηʹ);

  let η = ηʹ;
  for (let j = 1; j <= 6; j++) η += α[j] * Math.cos(2 * j * ξʹ) * Math.sinh(2 * j * ηʹ);

  let x = k0 * A * η;
  let y = k0 * A * ξ;

  // ---- convergence: Karney 2011 Eq 23, 24

  let pʹ = 1;
  for (let j = 1; j <= 6; j++) pʹ += 2 * j * α[j] * Math.cos(2 * j * ξʹ) * Math.cosh(2 * j * ηʹ);
  let qʹ = 0;
  for (let j = 1; j <= 6; j++) qʹ += 2 * j * α[j] * Math.sin(2 * j * ξʹ) * Math.sinh(2 * j * ηʹ);

  const γʹ = Math.atan((τʹ / Math.sqrt(1 + τʹ * τʹ)) * tanλ);
  const γʺ = Math.atan2(qʹ, pʹ);

  const γ = γʹ + γʺ;

  // ---- scale: Karney 2011 Eq 25

  const sinφ = Math.sin(φ);
  const kʹ = (Math.sqrt(1 - e * e * sinφ ** 2) * Math.sqrt(1 + τ * τ)) / Math.sqrt(τʹ * τʹ + cosλ * cosλ);
  const kʺ = (A / a) * Math.sqrt(pʹ * pʹ + qʹ * qʹ);

  const k = k0 * kʹ * kʺ;

  // ------------

  // shift x/y to false origins
  x += falseEasting; // make x relative to false easting
  if (y < 0) y += falseNorthing; // make y in southern hemisphere relative to false northing

  // round to reasonable precision
  x = Number(x.toFixed(6)); // nm precision
  y = Number(y.toFixed(6)); // nm precision
  const convergence = Number(γ.toDegrees().toFixed(9));
  const scale = Number(k.toFixed(12));

  const h = _lat >= 0 ? 'N' : 'S'; // hemisphere

  return {
    zone,
    h,
    x,
    y,
    convergence,
    scale
  };
}

if (typeof Number.prototype.toRadians === 'undefined') {
  Number.prototype.toRadians = function() {
    return (this * Math.PI) / 180;
  };
}

if (typeof Number.prototype.toDegrees === 'undefined') {
  Number.prototype.toDegrees = function() {
    return this * (180 / Math.PI);
  };
}

function log(x) {
  let LOG = 0;
  while (x >= 1500000) {
    LOG += 405465;
    x = (x * 2) / 3;
  }

  x -= 1000000;
  let y = x;
  let i = 1;

  while (i < 10) {
    LOG += y / i;
    i += 1;
    y = (y * x) / 1000000;
    LOG -= y / i;
    i += 1;
    y = (y * x) / 1000000;
  }
  return LOG;
}

function my_atan2(y, x) {
  console.log('atan input', y / x);
  console.log('atan output', Math.atan(y / x));
  console.log('my_atan output', my_atan(y / x));
  let u = Math.atan(y / x, 50);
  if (x < 0.0) {
    // 2nd, 3rd quadrant
    if (u > 0.0)
      // will go to 3rd quadrant
      u -= Math.PI;
    else u += Math.PI;
  }
  return u;
}

function my_atan(x) {
  const n = 50;
  let a = 0.0; // 1st term
  let sum = 0.0;

  // special cases
  if (x === 1.0) return Math.PI / 4.0;
  if (x === -1.0) return -Math.PI / 4.0;

  if (n > 0) {
    if (x < -1.0 || x > 1.0) {
      // constant term
      if (x > 1.0) sum = Math.PI / 2.0;
      else sum = -Math.PI / 2.0;
      // initial value of a
      a = -1.0 / x;
      for (let j = 1; j <= n; j++) {
        sum += a;
        a *= (-1.0 * (2.0 * j - 1)) / ((2.0 * j + 1) * x * x); // next term from last
      }
    } // -1 < x < 1
    else {
      // constant term
      sum = 0.0;
      // initial value of a
      a = x;
      for (let j = 1; j <= n; j++) {
        sum += a;
        a *= (-1.0 * (2.0 * j - 1) * x * x) / (2.0 * j + 1); // next term from last
      }
    }
  }

  return sum;
}
