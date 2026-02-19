// Stage 5: SVG Renderer
// Projects WGS84 coordinates to SVG mm space (A4 landscape: 297x210mm)
// Linear scale with aspect-ratio-correct fit into 277x190mm usable area (10mm margins)

var SVGRenderer = (function () {

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var VIEWBOX_W = 297;   // A4 landscape width in mm
  var VIEWBOX_H = 210;   // A4 landscape height in mm
  var MARGIN = 10;       // mm

  function render(styledLayers, containerEl) {
    // 1. Collect all features into a flat array for bbox calculation
    var allFeatures = []
      .concat(styledLayers.buildings || [])
      .concat(styledLayers.paths || [])
      .concat(styledLayers.streets || [])
      .concat(styledLayers.entrances || []);

    if (allFeatures.length === 0) {
      console.warn('SVGRenderer: no features to render');
      return null;
    }

    // 2. Compute bounding box [minLng, minLat, maxLng, maxLat]
    var bbox = computeBbox(allFeatures);
    if (!bbox) {
      console.warn('SVGRenderer: could not compute bounding box');
      return null;
    }

    // 3. Build linear projection (aspect-ratio corrected)
    var proj = buildProjection(bbox);

    // 4. Create SVG element
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('xmlns', SVG_NS);
    svg.setAttribute('viewBox', '0 0 ' + VIEWBOX_W + ' ' + VIEWBOX_H);
    svg.setAttribute('width', VIEWBOX_W + 'mm');
    svg.setAttribute('height', VIEWBOX_H + 'mm');
    svg.setAttribute('data-tactile-pipeline', 'cart484');

    // Background rectangle
    var bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('width', VIEWBOX_W);
    bg.setAttribute('height', VIEWBOX_H);
    bg.setAttribute('fill', '#ffffff');
    svg.appendChild(bg);

    // 5. Create layer groups in z-order: streets → major streets → paths → buildings → poi → labels → legend
    var groupBackground  = createGroup(svg, 'background',    'Minor street grid');
    var groupMajor       = createGroup(svg, 'major-streets', 'Major streets');
    var groupLabels      = createGroup(svg, 'street-labels', 'Street names');
    var groupMidground   = createGroup(svg, 'midground',     'Pedestrian paths');
    var groupForeground  = createGroup(svg, 'foreground',    'Building footprints');
    var groupPoi         = createGroup(svg, 'poi',           'Entrances');

    // 6. Render each layer
    renderFeatures(styledLayers.streets      || [], groupBackground, proj);
    renderFeatures(styledLayers.majorStreets || [], groupMajor,      proj);
    renderStreetLabels(styledLayers.majorStreets || [], groupLabels, proj);
    renderFeatures(styledLayers.paths        || [], groupMidground,  proj);
    renderFeatures(styledLayers.buildings    || [], groupForeground, proj);
    renderFeatures(styledLayers.entrances    || [], groupPoi,        proj);

    // 7. Insert into container
    containerEl.innerHTML = '';
    containerEl.appendChild(svg);

    return svg;
  }

  // --- Projection helpers ---

  function computeBbox(features) {
    var minLng = Infinity, minLat = Infinity;
    var maxLng = -Infinity, maxLat = -Infinity;

    features.forEach(function (f) {
      visitCoords(f.geometry, function (lng, lat) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });
    });

    if (!isFinite(minLng)) return null;
    return [minLng, minLat, maxLng, maxLat];
  }

  function buildProjection(bbox) {
    var minLng = bbox[0], minLat = bbox[1], maxLng = bbox[2], maxLat = bbox[3];

    var usableW = VIEWBOX_W - MARGIN * 2;
    var usableH = VIEWBOX_H - MARGIN * 2;

    var lngRange = maxLng - minLng;
    var latRange = maxLat - minLat;

    // Avoid divide-by-zero for degenerate data
    if (lngRange === 0) lngRange = 0.001;
    if (latRange === 0) latRange = 0.001;

    // Scale to fit while preserving aspect ratio
    var scaleX = usableW / lngRange;
    var scaleY = usableH / latRange;
    var scale = Math.min(scaleX, scaleY);

    // Centre the map within the usable area
    var renderedW = lngRange * scale;
    var renderedH = latRange * scale;
    var offsetX = MARGIN + (usableW - renderedW) / 2;
    var offsetY = MARGIN + (usableH - renderedH) / 2;

    return {
      minLng: minLng,
      maxLat: maxLat,
      scale: scale,
      offsetX: offsetX,
      offsetY: offsetY
    };
  }

  function project(lng, lat, proj) {
    var x = proj.offsetX + (lng - proj.minLng) * proj.scale;
    var y = proj.offsetY + (proj.maxLat - lat) * proj.scale;  // flip Y
    return [
      Math.round(x * 1000) / 1000,
      Math.round(y * 1000) / 1000
    ];
  }

  // --- Feature rendering ---

  function renderFeatures(features, group, proj) {
    features.forEach(function (feature) {
      var el = featureToSVG(feature, proj);
      if (el) group.appendChild(el);
    });
  }

  function featureToSVG(feature, proj) {
    var spec = (feature.properties && feature.properties._tactile_spec) || {};
    var geom = feature.geometry;
    if (!geom) return null;

    var el;

    switch (geom.type) {
      case 'Point':
        el = renderPoint(geom.coordinates, spec, proj);
        break;
      case 'LineString':
        el = renderLineString(geom.coordinates, spec, proj);
        break;
      case 'Polygon':
        el = renderPolygon(geom.coordinates, spec, proj);
        break;
      case 'MultiLineString':
        el = document.createElementNS(SVG_NS, 'g');
        geom.coordinates.forEach(function (line) {
          var child = renderLineString(line, spec, proj);
          if (child) el.appendChild(child);
        });
        break;
      case 'MultiPolygon':
        el = document.createElementNS(SVG_NS, 'g');
        geom.coordinates.forEach(function (poly) {
          var child = renderPolygon(poly, spec, proj);
          if (child) el.appendChild(child);
        });
        break;
      default:
        return null;
    }

    if (el && feature.properties && feature.properties.name) {
      el.setAttribute('data-name', feature.properties.name);
    }

    return el;
  }

  function renderPoint(coords, spec, proj) {
    var pt = project(coords[0], coords[1], proj);
    var circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', pt[0]);
    circle.setAttribute('cy', pt[1]);
    circle.setAttribute('r', spec.radius || 2);
    circle.setAttribute('fill', spec.fillColor || '#e05c5c');
    circle.setAttribute('stroke', spec.strokeColor || '#e05c5c');
    circle.setAttribute('stroke-width', spec.strokeWidth || 0.5);
    return circle;
  }

  function renderLineString(coords, spec, proj) {
    if (!coords || coords.length < 2) return null;
    var d = coords.map(function (c, i) {
      var pt = project(c[0], c[1], proj);
      return (i === 0 ? 'M' : 'L') + pt[0] + ' ' + pt[1];
    }).join(' ');

    var path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', spec.strokeColor || '#000000');
    path.setAttribute('stroke-width', spec.strokeWidth || 0.5);
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');

    if (spec.dashArray && spec.dashArray.length > 0) {
      path.setAttribute('stroke-dasharray', spec.dashArray.join(' '));
    }

    return path;
  }

  function renderPolygon(rings, spec, proj) {
    if (!rings || rings.length === 0) return null;
    var outerRing = rings[0];
    if (!outerRing || outerRing.length < 3) return null;

    var pointsStr = outerRing.map(function (c) {
      var pt = project(c[0], c[1], proj);
      return pt[0] + ',' + pt[1];
    }).join(' ');

    var polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('points', pointsStr);
    polygon.setAttribute('fill', spec.fillColor || 'none');
    polygon.setAttribute('stroke', spec.strokeColor || '#1a1a1a');
    polygon.setAttribute('stroke-width', spec.strokeWidth || 2.2);
    polygon.setAttribute('stroke-linejoin', 'round');

    return polygon;
  }

  // --- SVG DOM helpers ---

  function createGroup(svg, id, label) {
    var g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('id', id);
    g.setAttribute('aria-label', label);
    svg.appendChild(g);
    return g;
  }

  // Iterate all coordinate pairs in any geometry type
  function visitCoords(geometry, fn) {
    if (!geometry) return;
    switch (geometry.type) {
      case 'Point':
        fn(geometry.coordinates[0], geometry.coordinates[1]);
        break;
      case 'MultiPoint':
      case 'LineString':
        geometry.coordinates.forEach(function (c) { fn(c[0], c[1]); });
        break;
      case 'Polygon':
      case 'MultiLineString':
        geometry.coordinates.forEach(function (ring) {
          ring.forEach(function (c) { fn(c[0], c[1]); });
        });
        break;
      case 'MultiPolygon':
        geometry.coordinates.forEach(function (poly) {
          poly.forEach(function (ring) {
            ring.forEach(function (c) { fn(c[0], c[1]); });
          });
        });
        break;
      case 'GeometryCollection':
        geometry.geometries.forEach(function (g) { visitCoords(g, fn); });
        break;
    }
  }

  // --- Street labels (major streets only) ---

  function renderStreetLabels(features, group, proj) {
    var seen = {};
    features.forEach(function (f) {
      var name = f.properties && f.properties.name;
      if (!name || seen[name]) return;
      var geom = f.geometry;
      if (!geom || geom.type !== 'LineString') return;
      var coords = geom.coordinates;
      if (coords.length < 2) return;

      // Place label at midpoint of the longest segment
      var midIdx = Math.floor(coords.length / 2);
      var a = coords[midIdx - 1] || coords[0];
      var b = coords[midIdx];
      var pa = project(a[0], a[1], proj);
      var pb = project(b[0], b[1], proj);
      var mx = (pa[0] + pb[0]) / 2;
      var my = (pa[1] + pb[1]) / 2;

      // Angle of this segment
      var angle = Math.atan2(pb[1] - pa[1], pb[0] - pa[0]) * 180 / Math.PI;
      if (angle > 90)  angle -= 180;
      if (angle < -90) angle += 180;

      var text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', mx);
      text.setAttribute('y', my);
      text.setAttribute('transform', 'rotate(' + angle + ',' + mx + ',' + my + ')');
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('dominant-baseline', 'auto');
      text.setAttribute('font-family', 'Arial, sans-serif');
      text.setAttribute('font-size', '2.2');
      text.setAttribute('fill', '#444444');
      text.setAttribute('dy', '-0.6');
      text.textContent = name;
      group.appendChild(text);
      seen[name] = true;
    });
  }

  // --- SVG Legend (bottom-left corner) ---

  function renderLegend(svg) {
    var g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('id', 'legend');
    g.setAttribute('transform', 'translate(10, 148)');

    // Background panel
    var bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('x', 0);
    bg.setAttribute('y', 0);
    bg.setAttribute('width', 68);
    bg.setAttribute('height', 52);
    bg.setAttribute('fill', '#ffffff');
    bg.setAttribute('fill-opacity', '0.92');
    bg.setAttribute('stroke', '#cccccc');
    bg.setAttribute('stroke-width', '0.3');
    bg.setAttribute('rx', '1');
    g.appendChild(bg);

    var title = document.createElementNS(SVG_NS, 'text');
    title.setAttribute('x', 4);
    title.setAttribute('y', 6);
    title.setAttribute('font-family', 'Arial, sans-serif');
    title.setAttribute('font-size', '2.5');
    title.setAttribute('font-weight', 'bold');
    title.setAttribute('fill', '#222222');
    title.textContent = 'Legend';
    g.appendChild(title);

    var items = [
      { label: 'Building',        color: '#1a1a1a', width: 1.2, dash: null,   dot: false },
      { label: 'Major street',    color: '#555555', width: 1.2, dash: null,   dot: false },
      { label: 'Minor street',    color: '#cccccc', width: 0.5, dash: null,   dot: false },
      { label: 'Pedestrian path', color: '#256fba', width: 0.8, dash: '2 2', dot: false },
      { label: 'Campus entrance', color: '#e05c5c', width: 0.5, dash: null,   dot: true  },
    ];

    items.forEach(function (item, i) {
      var y = 11 + i * 8;

      if (item.dot) {
        var circle = document.createElementNS(SVG_NS, 'circle');
        circle.setAttribute('cx', 10);
        circle.setAttribute('cy', y + 0.5);
        circle.setAttribute('r', 1.5);
        circle.setAttribute('fill', item.color);
        g.appendChild(circle);
      } else {
        var line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', 4);
        line.setAttribute('y1', y + 0.5);
        line.setAttribute('x2', 18);
        line.setAttribute('y2', y + 0.5);
        line.setAttribute('stroke', item.color);
        line.setAttribute('stroke-width', item.width);
        if (item.dash) line.setAttribute('stroke-dasharray', item.dash);
        line.setAttribute('stroke-linecap', 'round');
        g.appendChild(line);
      }

      var text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', 22);
      text.setAttribute('y', y + 1.5);
      text.setAttribute('font-family', 'Arial, sans-serif');
      text.setAttribute('font-size', '2.8');
      text.setAttribute('fill', '#333333');
      text.textContent = item.label;
      g.appendChild(text);
    });

    svg.appendChild(g);
  }

  return { render: render };

}());
