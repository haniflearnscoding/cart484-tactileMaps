// Stage 1: GeoJSON Loader
// Reads window.SGW_CAMPUS_DATA (injected by data/sgw-campus-mock.js)
// No fetch needed — avoids file:// CORS restrictions

var GeoJSONLoader = (function () {

  function load() {
    return new Promise(function (resolve, reject) {
      var data = window.SGW_CAMPUS_DATA;

      if (!data) {
        reject(new Error('SGW_CAMPUS_DATA not found. Ensure data/sgw-campus-mock.js loaded before this script.'));
        return;
      }

      if (data.type !== 'FeatureCollection') {
        reject(new Error('Expected a GeoJSON FeatureCollection, got: ' + data.type));
        return;
      }

      if (!Array.isArray(data.features)) {
        reject(new Error('FeatureCollection.features must be an array.'));
        return;
      }

      // Basic per-feature validation
      var invalid = [];
      data.features.forEach(function (f, i) {
        if (!f || f.type !== 'Feature') {
          invalid.push('Index ' + i + ': not a Feature');
        } else if (!f.geometry || !f.geometry.type) {
          invalid.push('Index ' + i + ': missing geometry');
        } else if (!f.properties) {
          invalid.push('Index ' + i + ': missing properties');
        }
      });

      if (invalid.length > 0) {
        reject(new Error('Invalid features found:\n' + invalid.join('\n')));
        return;
      }

      resolve(data);
    });
  }

  function summarise(fc) {
    var byLayer = {};
    var totalVertices = 0;

    fc.features.forEach(function (f) {
      var layer = (f.properties && f.properties.layer) ? f.properties.layer : 'unknown';

      if (!byLayer[layer]) {
        byLayer[layer] = { count: 0, vertices: 0 };
      }
      byLayer[layer].count++;

      // Count coordinate vertices
      var verts = countVertices(f.geometry);
      byLayer[layer].vertices += verts;
      totalVertices += verts;
    });

    return {
      total: fc.features.length,
      byLayer: byLayer,
      totalVertices: totalVertices
    };
  }

  function countVertices(geometry) {
    if (!geometry) return 0;
    switch (geometry.type) {
      case 'Point':
        return 1;
      case 'MultiPoint':
      case 'LineString':
        return geometry.coordinates.length;
      case 'MultiLineString':
      case 'Polygon':
        return geometry.coordinates.reduce(function (s, ring) { return s + ring.length; }, 0);
      case 'MultiPolygon':
        return geometry.coordinates.reduce(function (s, poly) {
          return s + poly.reduce(function (s2, ring) { return s2 + ring.length; }, 0);
        }, 0);
      case 'GeometryCollection':
        return geometry.geometries.reduce(function (s, g) { return s + countVertices(g); }, 0);
      default:
        return 0;
    }
  }

  return { load: load, summarise: summarise };

}());
