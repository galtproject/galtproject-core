const lats = [1.2291728239506483, 1.2037726398557425, 1.2036009784787893, 1.227113390341401, 1.2291728239506483];
//             |                                  |
const lons = [104.51007032766938, 104.50989866629243, 104.53199403360486, 104.53336732462049, 104.51007032766938];

// get the average center point of the polygon
let latsSum = 0;
let lonsSum = 0;

for (let i = lats.length; i--; ) {
  latsSum += lats[i];
  lonsSum += lons[i];
}

const latOrigin = latsSum / lats.length;
const lonOrigin = lonsSum / lons.length;

// translate origin to (0,0) by shifting lat lons
// and calculate the standard angle of the point
const angles = new Array(lats.length);

for (let j = lats.length; j--; ) {
  lats[j] -= latOrigin;
  lons[j] -= lonOrigin;

  if (lons[j] >= 0 && lats[j] >= 0) {
    angles[j] = Math.abs((Math.atan(lats[j] / lons[j]) * 180) / Math.PI);
  } else if (lons[j] < 0 && lats[j] >= 0) {
    angles[j] = 90 + Math.abs((Math.atan(lats[j] / lons[j]) * 180) / Math.PI);
  } else if (lons[j] < 0 && lats[j] < 0) {
    angles[j] = 180 + Math.abs((Math.atan(lats[j] / lons[j]) * 180) / Math.PI);
  } else if (lons[j] >= 0 && lats[j] < 0) {
    angles[j] = 270 + Math.abs((Math.atan(lats[j] / lons[j]) * 180) / Math.PI);
  }
}

// re-arrange the points from least to greatest angle
let curAng;
let curLat;
let curLon;

for (let l = 0; l < angles.length; l++) {
  for (let k = 0; k < angles.length - 1; k++) {
    curAng = angles[k];
    curLat = lats[k];
    curLon = lons[k];

    if (curAng < angles[k + 1]) {
      angles[k] = angles[k + 1];
      lats[k] = lats[k + 1];
      lons[k] = lons[k + 1];

      angles[k + 1] = curAng;
      lats[k + 1] = curLat;
      lons[k + 1] = curLon;
    }
  }
}

// calculate area for irregular polygon
let sum1 = 0;
let sum2 = 0;

for (let t = 0; t < lats.length; t++) {
  if (t !== lats.length - 1) {
    sum1 += lats[t] * lons[t + 1];
    sum2 += lons[t] * lats[t + 1];
  } else {
    sum1 += lats[t] * lons[0];
    sum2 += lons[t] * lats[0];
  }
}

const area = (sum1 - sum2) / 2.0;

console.log(`Area: ${area}`);
