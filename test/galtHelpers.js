const galtUtils = require('@galtproject/utils');

const Helpers = {
  addElevationToContour(height, contour) {
    const resultingContour = [];
    for (let i = 0; i < contour.length; i++) {
      resultingContour[i] = galtUtils.geohash5ToGeohash5z(height, contour[i]);
    }
    return resultingContour;
  },

  addElevationToGeohash5(height, geohash5) {
    return galtUtils.geohash5ToGeohash5z(height, galtUtils.geohashToNumber(geohash5).toString(10));
  }
};

Object.freeze(Helpers.applicationStatus);

module.exports = Helpers;
