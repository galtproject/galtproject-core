const PolygonUtils = artifacts.require('./utils/PolygonUtils.sol');
const LandUtils = artifacts.require('./utils/LandUtils.sol');
const TrigonometryUtils = artifacts.require('./utils/TrigonometryUtils.sol');
const MockPolygonUtils = artifacts.require('./mocks/MockPolygonUtils.sol');

const pIteration = require('p-iteration');
const Web3 = require('web3');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const chaiBigNumber = require('chai-bignumber')(Web3.utils.BN);
const { initHelperWeb3, ether } = require('../helpers');

const web3 = new Web3(MockPolygonUtils.web3.currentProvider);

initHelperWeb3(web3);

// TODO: move to helpers
Web3.utils.BN.prototype.equal = Web3.utils.BN.prototype.eq;
Web3.utils.BN.prototype.equals = Web3.utils.BN.prototype.eq;

chai.use(chaiAsPromised);
chai.use(chaiBigNumber);
chai.should();

contract('PolygonUtils', ([coreTeam]) => {
  beforeEach(async function() {
    this.trigonometryUtils = await TrigonometryUtils.new({ from: coreTeam });
    PolygonUtils.link('TrigonometryUtils', this.trigonometryUtils.address);
    this.landUtils = await LandUtils.new({ from: coreTeam });
    PolygonUtils.link('LandUtils', this.landUtils.address);
    MockPolygonUtils.link('LandUtils', this.landUtils.address);
    this.polygonUtils = await PolygonUtils.new({ from: coreTeam });
    MockPolygonUtils.link('PolygonUtils', this.polygonUtils.address);
    this.mockPolygonUtils = await MockPolygonUtils.new({ from: coreTeam });
  });

  describe.only('#getArea()', () => {
    it('should correctly get area', async function() {
      const contour = [
        [1.2291728239506483, 104.51007032766938],
        [1.2037726398557425, 104.50989866629243],
        [1.2036009784787893, 104.53199403360486],
        [1.227113390341401, 104.53336732462049]
      ];

      const utmContour = contour.map(point => {
        const utmObject = toUtm(point[0], point[1]);
        return [utmObject.x, utmObject.y, utmObject.scale, utmObject.zone];
      });

      const etherContour = contour.map(point => point.map(c => ether(Math.round(c * 10 ** 12) / 10 ** 12)));
      await pIteration.forEachSeries(etherContour, async point => {
        await this.mockPolygonUtils.addPoint(point);
      });

      const res = await this.mockPolygonUtils.getArea();

      console.log('Javascript', getUtmArea(utmContour));
      console.log('Solidity', res.logs[0].args.result.toFixed() / 10 ** 18);
      assert.isBelow(Math.abs(res.logs[0].args.result.toFixed() / 10 ** 18 - 1727367.5744677314), 0.00001);
    });
  });
});

function getUtmArea(polygon) {
  let area = 0; // Accumulates area in the loop
  let j = polygon.length - 1; // The last vertex is the 'previous' one to the first

  for (let i = 0; i < polygon.length; i++) {
    area += (polygon[j][0] + polygon[i][0]) * (polygon[j][1] - polygon[i][1]);
    j = i; // j is previous vertex to i
  }
  return area / 2;
}

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
  // console.log('e', web3.utils.toWei(e.toString(), 'ether'));

  const cosλ = Math.cos(λ);

  const sinλ = Math.sin(λ);

  const tanλ = Math.tan(λ);

  const τ = Math.tan(φ); // τ ≡ tanφ, τʹ ≡ tanφʹ; prime (ʹ) indicates angles on the conformal sphere
  const σ = Math.sinh(e * Math.atanh((e * τ) / Math.sqrt(1 + τ * τ)));
  const τʹ = τ * Math.sqrt(1 + σ * σ) - σ * Math.sqrt(1 + τ * τ);

  const ξʹ = Math.atan2(τʹ, cosλ);
  const ηʹ = Math.asinh(sinλ / Math.sqrt(τʹ * τʹ + cosλ * cosλ));
  //
  // console.log('LogVar', 'τʹ', τʹ);
  // console.log('LogVar', 'cosλ', cosλ);
  // console.log('LogVar', 'ξʹ my_atan2', my_atan2(τʹ, cosλ));
  // console.log('LogVar', 'ξi', ξʹ);
  // console.log('LogVar', 'ηi', ηʹ);

  const A = 6367449.145823415; // 2πA is the circumference of a meridian

  // console.log('A', web3.utils.toWei(A.toString(), 'ether'));
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
  for (let j = 1; j <= 6; j++) {
    // console.log("a[uint(j)]", a[j]);
    // console.log("2 * j * variables[7]", 2 * j * variables[7]);
    // console.log("TrigonometryUtils.sin(2 * j * variables[7])", TrigonometryUtils.sin(2 * j * variables[7]));
    // console.log("TrigonometryUtils.cosh(2 * j * variables[7])", TrigonometryUtils.cosh(2 * j * variables[7]));
    // console.log('LogVar', 'ξ', ξ);
    ξ += α[j] * Math.sin(2 * j * ξʹ) * Math.cosh(2 * j * ηʹ);
  }
  // console.log('LogVar', 'E', ξ);

  let η = ηʹ;
  for (let j = 1; j <= 6; j++) η += α[j] * Math.cos(2 * j * ξʹ) * Math.sinh(2 * j * ηʹ);

  // console.log('LogVar', 'n', η);
  let x = k0 * A * η;
  let y = k0 * A * ξ;
  // console.log('Javascript:');
  // console.log('LogVar', 'x', x);
  // console.log('LogVar', 'y', y);

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
