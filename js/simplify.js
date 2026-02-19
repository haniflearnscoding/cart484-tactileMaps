// Stage 3: Simplifier
// Applies Douglas-Peucker simplification via Turf.js (or pure-JS fallback)
// toleranceMetres is converted to decimal degrees using Montreal's longitude scale

var Simplifier = (function () {

  // Montreal latitude ~45.5°: 1 degree longitude ≈ 78,710m
  var METRES_PER_DEGREE = 78710;

  function run(filtered, toleranceMetres) {
    var tol = (toleranceMetres || 2) / METRES_PER_DEGREE;

    var result = {
      buildings: [],
      paths: [],
      streetLabels: filtered.streetLabels.slice(), // Points — pass through
      entrances:    filtered.entrances.slice()     // Points — pass through
    };

    var stats = {
      before: 0,
      after: 0,
      byLayer: {
        buildings: { before: 0, after: 0 },
        paths:     { before: 0, after: 0 }
      }
    };

    ['buildings', 'paths'].forEach(function (layerKey) {
      filtered[layerKey].forEach(function (feature) {
        var beforeCount = countCoords(feature.geometry);
        stats.before += beforeCount;
        stats.byLayer[layerKey].before += beforeCount;

        var simplified = simplifyFeature(feature, tol);
        var afterCount = countCoords(simplified.geometry);
        stats.after += afterCount;
        stats.byLayer[layerKey].after += afterCount;

        // Attach reduction metadata
        var reduction = beforeCount > 0
          ? Math.round((1 - afterCount / beforeCount) * 100)
          : 0;
        simplified.properties = Object.assign({}, simplified.properties, {
          _simplify_reduction: reduction,
          _simplify_before: beforeCount,
          _simplify_after: afterCount
        });

        result[layerKey].push(simplified);
      });
    });

    stats.totalReduction = stats.before > 0
      ? Math.round((1 - stats.after / stats.before) * 100)
      : 0;

    return { simplified: result, stats: stats };
  }

  // --- Simplification dispatch ---

  function simplifyFeature(feature, tol) {
    // Try Turf.js first
    if (window.turf && typeof window.turf.simplify === 'function') {
      try {
        return window.turf.simplify(feature, { tolerance: tol, highQuality: true, mutate: false });
      } catch (e) {
        // fall through to pure-JS fallback
      }
    }
    // Pure-JS fallback: Douglas-Peucker per ring/linestring
    return simplifyFallback(feature, tol);
  }

  function simplifyFallback(feature, tol) {
    var geom = feature.geometry;
    var newGeom = Object.assign({}, geom);

    if (geom.type === 'LineString') {
      newGeom.coordinates = dpSimplify(geom.coordinates, tol);
    } else if (geom.type === 'Polygon') {
      newGeom.coordinates = geom.coordinates.map(function (ring) {
        var simplified = dpSimplify(ring, tol);
        // Ensure ring closure and minimum 4 points
        if (simplified.length < 4) return ring;
        return simplified;
      });
    } else if (geom.type === 'MultiLineString') {
      newGeom.coordinates = geom.coordinates.map(function (line) {
        return dpSimplify(line, tol);
      });
    } else if (geom.type === 'MultiPolygon') {
      newGeom.coordinates = geom.coordinates.map(function (poly) {
        return poly.map(function (ring) {
          var simplified = dpSimplify(ring, tol);
          return simplified.length < 4 ? ring : simplified;
        });
      });
    }
    // Points pass through unchanged

    return {
      type: 'Feature',
      properties: Object.assign({}, feature.properties),
      geometry: newGeom
    };
  }

  // Douglas-Peucker algorithm on a flat coordinate array [[lng,lat], ...]
  function dpSimplify(points, epsilon) {
    if (points.length <= 2) return points.slice();

    // Find the point with the maximum distance from the line start→end
    var maxDist = 0;
    var maxIdx = 0;
    var start = points[0];
    var end = points[points.length - 1];

    for (var i = 1; i < points.length - 1; i++) {
      var d = perpendicularDistance(points[i], start, end);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }

    if (maxDist > epsilon) {
      var left = dpSimplify(points.slice(0, maxIdx + 1), epsilon);
      var right = dpSimplify(points.slice(maxIdx), epsilon);
      // Remove duplicate at junction
      return left.slice(0, left.length - 1).concat(right);
    } else {
      return [start, end];
    }
  }

  // Perpendicular distance from point P to line segment (A, B)
  function perpendicularDistance(p, a, b) {
    var dx = b[0] - a[0];
    var dy = b[1] - a[1];
    var len2 = dx * dx + dy * dy;
    if (len2 === 0) {
      var ex = p[0] - a[0], ey = p[1] - a[1];
      return Math.sqrt(ex * ex + ey * ey);
    }
    var t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    var fx = a[0] + t * dx - p[0];
    var fy = a[1] + t * dy - p[1];
    return Math.sqrt(fx * fx + fy * fy);
  }

  // Count coordinate vertices in a geometry
  function countCoords(geometry) {
    if (!geometry) return 0;
    switch (geometry.type) {
      case 'Point': return 1;
      case 'LineString': case 'MultiPoint': return geometry.coordinates.length;
      case 'Polygon': case 'MultiLineString':
        return geometry.coordinates.reduce(function (s, r) { return s + r.length; }, 0);
      case 'MultiPolygon':
        return geometry.coordinates.reduce(function (s, p) {
          return s + p.reduce(function (s2, r) { return s2 + r.length; }, 0);
        }, 0);
      default: return 0;
    }
  }

  return { run: run };

}());
