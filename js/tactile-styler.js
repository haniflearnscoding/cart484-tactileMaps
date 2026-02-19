// Stage 4: Tactile Styler
// Attaches _tactile_spec to each feature's properties
// Specs follow ProBlind Standard v4 for embossed tactile maps

var TactileStyler = (function () {

  // Tactile specification table (all measurements in mm for SVG viewBox units)
  var SPECS = {
    building: {
      strokeWidth: 0.8,
      strokeColor: '#1a1a1a',
      fillColor: 'none',
      dashArray: null,
      radius: null,
      label: 'High-relief solid boundary'
    },
    path: {
      strokeWidth: 0.8,
      strokeColor: '#256fba',
      fillColor: 'none',
      dashArray: [3, 3],
      radius: null,
      label: 'Raised dashed path'
    },
    entrance: {
      strokeWidth: 0.5,
      strokeColor: '#e05c5c',
      fillColor: '#e05c5c',
      dashArray: null,
      radius: 1,        // 1mm radius = 2mm diameter filled circle
      label: 'Raised circle POI'
    },
    majorStreet: {
      strokeWidth: 1.2,
      strokeColor: '#555555',
      fillColor: 'none',
      dashArray: null,
      radius: null,
      label: 'Major street'
    },
    street: {
      strokeWidth: 0.3,
      strokeColor: '#cccccc',
      fillColor: 'none',
      dashArray: null,
      radius: null,
      label: 'Minor street'
    }
  };

  function run(simplified) {
    var result = {
      buildings: [],
      paths: [],
      majorStreets: [],
      streets: [],
      entrances: []
    };

    simplified.buildings.forEach(function (f) {
      result.buildings.push(attachSpec(f, 'building'));
    });

    (simplified.majorStreets || []).forEach(function (f) {
      result.majorStreets.push(attachSpec(f, 'majorStreet'));
    });

    simplified.paths.forEach(function (f) {
      result.paths.push(attachSpec(f, 'path'));
    });

    simplified.streets.forEach(function (f) {
      result.streets.push(attachSpec(f, 'street'));
    });

    simplified.entrances.forEach(function (f) {
      result.entrances.push(attachSpec(f, 'entrance'));
    });

    return result;
  }

  function attachSpec(feature, specKey) {
    var spec = SPECS[specKey];
    if (!spec) {
      console.warn('TactileStyler: unknown spec key "' + specKey + '"');
      return feature;
    }

    var styled = {
      type: 'Feature',
      properties: Object.assign({}, feature.properties, {
        _tactile_spec: {
          type: specKey,
          strokeWidth: spec.strokeWidth,
          strokeColor: spec.strokeColor,
          fillColor: spec.fillColor,
          dashArray: spec.dashArray,
          radius: spec.radius,
          label: spec.label
        }
      }),
      geometry: feature.geometry
    };

    return styled;
  }

  function getSpecs() {
    return JSON.parse(JSON.stringify(SPECS));
  }

  return { run: run, getSpecs: getSpecs };

}());
