// Stage 2: Layer Filter
// Splits a FeatureCollection into categorised layer buckets

var LayerFilter = (function () {

  function run(fc) {
    var buildings    = [];
    var paths        = [];
    var streetLabels = [];
    var entrances    = [];

    fc.features.forEach(function (f) {
      var p     = f.properties || {};
      var layer = p.layer || '';
      var type  = p.type  || '';
      var tag   = p.tag   || '';

      if (layer === 'footprints' && tag === 'campus_structure') {
        buildings.push(f);

        // Legacy: extract entrance coords from building properties array
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
                geometry: { type: 'Point', coordinates: [coords[0], coords[1]] }
              });
            }
          });
        }

      } else if (layer === 'entrances' && f.geometry && f.geometry.type === 'Point') {
        entrances.push(f);

      } else if (layer === 'thoroughfares' && type === 'pedestrian_link') {
        paths.push(f);

      } else if (layer === 'street_labels' && f.geometry && f.geometry.type === 'Point') {
        streetLabels.push(f);
      }
    });

    return { buildings: buildings, paths: paths, streetLabels: streetLabels, entrances: entrances };
  }

  function summarise(filtered) {
    return {
      buildings:    filtered.buildings.length,
      paths:        filtered.paths.length,
      streetLabels: filtered.streetLabels.length,
      entrances:    filtered.entrances.length,
      total: filtered.buildings.length + filtered.paths.length +
             filtered.streetLabels.length + filtered.entrances.length
    };
  }

  return { run: run, summarise: summarise };

}());
