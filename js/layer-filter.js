// Stage 2: Layer Filter
// Splits a FeatureCollection into categorised layer buckets
// Also extracts entrance Point features from building properties

var LayerFilter = (function () {

  function run(fc) {
    var buildings = [];
    var paths = [];
    var streets = [];
    var majorStreets = [];
    var entrances = [];

    fc.features.forEach(function (f) {
      var p = f.properties || {};
      var layer = p.layer || '';
      var type = p.type || '';
      var tag = p.tag || '';

      if (layer === 'footprints' && tag === 'campus_structure') {
        buildings.push(f);

        // Extract entrance coordinates from building properties
        if (Array.isArray(p.entrances)) {
          p.entrances.forEach(function (coords, idx) {
            if (Array.isArray(coords) && coords.length >= 2) {
              entrances.push({
                type: 'Feature',
                properties: {
                  name: (p.name || 'Building') + ' — Entrance ' + (idx + 1),
                  layer: 'entrances',
                  parentBuilding: p.id || p.name || 'unknown'
                },
                geometry: {
                  type: 'Point',
                  coordinates: [coords[0], coords[1]]
                }
              });
            }
          });
        }

      } else if (layer === 'entrances' && f.geometry && f.geometry.type === 'Point') {
        entrances.push(f);

      } else if (layer === 'thoroughfares' && type === 'pedestrian_link') {
        paths.push(f);

      } else if (layer === 'streets' && type === 'major_street_grid') {
        majorStreets.push(f);

      } else if (layer === 'streets' && type === 'street_grid') {
        streets.push(f);
      }
    });

    return {
      buildings: buildings,
      paths: paths,
      majorStreets: majorStreets,
      streets: streets,
      entrances: entrances
    };
  }

  function summarise(filtered) {
    return {
      buildings: filtered.buildings.length,
      paths: filtered.paths.length,
      majorStreets: filtered.majorStreets.length,
      streets: filtered.streets.length,
      entrances: filtered.entrances.length,
      total: filtered.buildings.length + filtered.paths.length +
             filtered.majorStreets.length + filtered.streets.length +
             filtered.entrances.length
    };
  }

  return { run: run, summarise: summarise };

}());
