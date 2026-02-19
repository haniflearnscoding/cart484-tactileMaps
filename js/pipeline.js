// Pipeline Master Controller
// Wires all stage modules together, manages state, drives UI updates

var Pipeline = (function () {

  // Shared mutable state
  var state = {
    rawGeoJSON: null,
    filtered: null,
    simplified: null,
    simplifyStats: null,
    styled: null,
    svgElement: null
  };

  var svgContainer = null;
  var logEl = null;
  var toleranceSlider = null;

  // ---------------------------------------------------------------
  // Stage implementations
  // ---------------------------------------------------------------

  function _stage1_load() {
    setStageStatus(1, 'active');
    log('Stage 1: Loading GeoJSON data…');

    return GeoJSONLoader.load()
      .then(function (fc) {
        state.rawGeoJSON = fc;
        var summary = GeoJSONLoader.summarise(fc);

        var metaLines = [
          'Features loaded: ' + summary.total,
          'Total vertices: ' + summary.totalVertices
        ];
        Object.keys(summary.byLayer).forEach(function (layer) {
          var l = summary.byLayer[layer];
          metaLines.push('  ' + layer + ': ' + l.count + ' features, ' + l.vertices + ' verts');
        });

        setStageStatus(1, 'complete');
        setMeta(1, metaLines.join('\n'));
        log('Stage 1 complete — ' + summary.total + ' features, ' + summary.totalVertices + ' vertices', 'success');

        return state.rawGeoJSON;
      })
      .catch(function (err) {
        setStageStatus(1, 'error');
        log('Stage 1 ERROR: ' + err.message, 'error');
        throw err;
      });
  }

  function _stage2_filter() {
    if (!state.rawGeoJSON) {
      return Promise.reject(new Error('No GeoJSON loaded. Run Stage 1 first.'));
    }

    setStageStatus(2, 'active');
    log('Stage 2: Filtering layers…');

    return new Promise(function (resolve, reject) {
      try {
        state.filtered = LayerFilter.run(state.rawGeoJSON);
        var summary = LayerFilter.summarise(state.filtered);

        var metaLines = [
          'Buildings: ' + summary.buildings,
          'Pedestrian paths: ' + summary.paths,
          'Major streets: ' + summary.majorStreets,
          'Minor streets: ' + summary.streets,
          'Entrances extracted: ' + summary.entrances
        ];

        setStageStatus(2, 'complete');
        setMeta(2, metaLines.join('\n'));
        log('Stage 2 complete — ' + summary.total + ' features across 4 layers', 'success');

        resolve(state.filtered);
      } catch (err) {
        setStageStatus(2, 'error');
        log('Stage 2 ERROR: ' + err.message, 'error');
        reject(err);
      }
    });
  }

  function _stage3_simplify() {
    if (!state.filtered) {
      return Promise.reject(new Error('No filtered data. Run Stage 2 first.'));
    }

    setStageStatus(3, 'active');
    var toleranceMetres = toleranceSlider ? parseFloat(toleranceSlider.value) : 2;
    log('Stage 3: Simplifying (tolerance: ' + toleranceMetres + 'm)…');

    return new Promise(function (resolve, reject) {
      try {
        var result = Simplifier.run(state.filtered, toleranceMetres);
        state.simplified = result.simplified;
        state.simplifyStats = result.stats;

        var s = result.stats;
        var metaLines = [
          'Tolerance: ' + toleranceMetres + 'm',
          'Vertices before: ' + s.before,
          'Vertices after: ' + s.after,
          'Reduction: ' + s.totalReduction + '%',
          '  Buildings: ' + s.byLayer.buildings.before + ' → ' + s.byLayer.buildings.after,
          '  Paths: ' + s.byLayer.paths.before + ' → ' + s.byLayer.paths.after,
          '  Streets: ' + s.byLayer.streets.before + ' → ' + s.byLayer.streets.after
        ];

        setStageStatus(3, 'complete');
        setMeta(3, metaLines.join('\n'));
        log('Stage 3 complete — ' + s.totalReduction + '% vertex reduction', 'success');

        resolve(state.simplified);
      } catch (err) {
        setStageStatus(3, 'error');
        log('Stage 3 ERROR: ' + err.message, 'error');
        reject(err);
      }
    });
  }

  function _stage4_style() {
    if (!state.simplified) {
      return Promise.reject(new Error('No simplified data. Run Stage 3 first.'));
    }

    setStageStatus(4, 'active');
    log('Stage 4: Applying tactile styles…');

    return new Promise(function (resolve, reject) {
      try {
        state.styled = TactileStyler.run(state.simplified);

        var specs = TactileStyler.getSpecs();
        var metaLines = Object.keys(specs).map(function (k) {
          var s = specs[k];
          var dash = s.dashArray ? s.dashArray.join('/') + 'mm dash' : 'solid';
          return k + ': ' + s.strokeWidth + 'mm stroke, ' + dash;
        });

        setStageStatus(4, 'complete');
        setMeta(4, metaLines.join('\n'));
        log('Stage 4 complete — tactile specs applied to all layers', 'success');

        resolve(state.styled);
      } catch (err) {
        setStageStatus(4, 'error');
        log('Stage 4 ERROR: ' + err.message, 'error');
        reject(err);
      }
    });
  }

  function _stage5_render() {
    if (!state.styled) {
      return Promise.reject(new Error('No styled data. Run Stage 4 first.'));
    }

    setStageStatus(5, 'active');
    log('Stage 5: Rendering SVG…');

    return new Promise(function (resolve, reject) {
      try {
        var svg = SVGRenderer.render(state.styled, svgContainer);
        if (!svg) {
          throw new Error('SVGRenderer returned null — no features rendered');
        }
        state.svgElement = svg;

        var totalFeatures = Object.keys(state.styled).reduce(function (sum, key) {
          return sum + state.styled[key].length;
        }, 0);

        var metaLines = [
          'ViewBox: 297×210mm (A4 landscape)',
          'Features rendered: ' + totalFeatures,
          'Layers: background / midground / foreground / poi',
          'SVG ready for export'
        ];

        setStageStatus(5, 'complete');
        setMeta(5, metaLines.join('\n'));
        log('Stage 5 complete — SVG rendered to canvas', 'success');

        resolve(svg);
      } catch (err) {
        setStageStatus(5, 'error');
        log('Stage 5 ERROR: ' + err.message, 'error');
        reject(err);
      }
    });
  }

  // ---------------------------------------------------------------
  // Run all stages in sequence
  // ---------------------------------------------------------------

  function runAll() {
    log('--- Running full pipeline ---');

    var delay = function (ms) {
      return new Promise(function (res) { setTimeout(res, ms); });
    };

    _stage1_load()
      .then(function () { return delay(300); })
      .then(function () { return _stage2_filter(); })
      .then(function () { return delay(300); })
      .then(function () { return _stage3_simplify(); })
      .then(function () { return delay(300); })
      .then(function () { return _stage4_style(); })
      .then(function () { return delay(300); })
      .then(function () { return _stage5_render(); })
      .then(function () {
        log('--- Pipeline complete ---', 'success');
      })
      .catch(function (err) {
        log('Pipeline halted: ' + err.message, 'error');
      });
  }

  // ---------------------------------------------------------------
  // Export button handler
  // ---------------------------------------------------------------

  function doExport() {
    if (!state.svgElement) {
      log('Export failed: render SVG first (run Stage 5)', 'error');
      return;
    }
    try {
      var result = SVGExporter.export(state.svgElement);
      log('Exported: ' + result.filename + ' (' + result.size + ' bytes)', 'success');
    } catch (err) {
      log('Export ERROR: ' + err.message, 'error');
    }
  }

  // ---------------------------------------------------------------
  // UI helpers
  // ---------------------------------------------------------------

  function setStageStatus(stageNum, status) {
    var el = document.getElementById('stage-' + stageNum);
    if (!el) return;
    el.classList.remove('active', 'complete', 'error');
    el.classList.add(status);

    var badge = el.querySelector('.stage-badge');
    if (badge) {
      badge.textContent = status === 'complete' ? '✓'
        : status === 'error' ? '✗'
        : status === 'active' ? '…'
        : (stageNum + '');
    }
  }

  function setMeta(stageNum, text) {
    var el = document.getElementById('meta-' + stageNum);
    if (el) el.textContent = text;
  }

  function log(msg, level) {
    if (!logEl) return;
    var ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    var line = document.createElement('div');
    line.className = 'log-line' + (level ? ' log-' + level : '');
    line.textContent = '[' + ts + '] ' + msg;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  // ---------------------------------------------------------------
  // Boot: wire buttons on DOMContentLoaded
  // ---------------------------------------------------------------

  document.addEventListener('DOMContentLoaded', function () {
    svgContainer    = document.getElementById('svg-canvas');
    logEl           = document.getElementById('log-console');
    toleranceSlider = document.getElementById('tolerance-slider');

    // Tolerance slider label
    var toleranceLabel = document.getElementById('tolerance-value');
    if (toleranceSlider && toleranceLabel) {
      toleranceSlider.addEventListener('input', function () {
        toleranceLabel.textContent = toleranceSlider.value + 'm';
      });
    }

    // Individual stage run buttons
    var stageHandlers = {
      'btn-stage-1': _stage1_load,
      'btn-stage-2': _stage2_filter,
      'btn-stage-3': _stage3_simplify,
      'btn-stage-4': _stage4_style,
      'btn-stage-5': _stage5_render
    };

    Object.keys(stageHandlers).forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', function () {
          stageHandlers[id]().catch(function () {});
        });
      }
    });

    // Run full pipeline button
    var btnAll = document.getElementById('btn-run-all');
    if (btnAll) {
      btnAll.addEventListener('click', runAll);
    }

    // Export button
    var btnExport = document.getElementById('btn-export');
    if (btnExport) {
      btnExport.addEventListener('click', doExport);
    }

    log('Pipeline controller ready. Click "Run Full Pipeline" to start.');
  });

  return {
    state: state,
    runAll: runAll,
    stage1: _stage1_load,
    stage2: _stage2_filter,
    stage3: _stage3_simplify,
    stage4: _stage4_style,
    stage5: _stage5_render,
    export: doExport,
    log: log
  };

}());
