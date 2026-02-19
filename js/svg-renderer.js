// Stage 5: SVG Renderer
// Projects WGS84 coordinates to SVG mm space (A4 landscape: 297x210mm)
// Street names placed as large text in page margins — no street lines drawn.

var SVGRenderer = (function () {

  var SVG_NS   = 'http://www.w3.org/2000/svg';
  var VIEWBOX_W = 297;  // A4 landscape mm
  var VIEWBOX_H = 210;
  // Content margins — generous so street labels have breathing room
  var MARGIN_TOP    = 28;
  var MARGIN_BOTTOM = 28;
  var MARGIN_LEFT   = 22;
  var MARGIN_RIGHT  = 22;

  function render(styledLayers, containerEl) {
    var buildings    = styledLayers.buildings    || [];
    var paths        = styledLayers.paths        || [];
    var entrances    = styledLayers.entrances    || [];
    var streetLabels = styledLayers.streetLabels || [];

    if (buildings.length === 0) {
      console.warn('SVGRenderer: no buildings to render');
      return null;
    }

    // 1. Bbox from buildings only — streets don't influence the projection
    var bbox = computeBbox(buildings);
    if (!bbox) return null;

    // 2. Projection into usable content area
    var proj = buildProjection(bbox);

    // 3. Build SVG
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('xmlns', SVG_NS);
    svg.setAttribute('viewBox', '0 0 ' + VIEWBOX_W + ' ' + VIEWBOX_H);
    svg.setAttribute('width',  VIEWBOX_W + 'mm');
    svg.setAttribute('height', VIEWBOX_H + 'mm');
    svg.setAttribute('data-tactile-pipeline', 'cart484');

    var bg = document.createElementNS(SVG_NS, 'rect');
    bg.setAttribute('width',  VIEWBOX_W);
    bg.setAttribute('height', VIEWBOX_H);
    bg.setAttribute('fill', '#ffffff');
    svg.appendChild(bg);

    // 4. Layer groups — paths → buildings → entrances → street name labels
    var groupMidground  = createGroup(svg, 'midground',     'Pedestrian paths');
    var groupForeground = createGroup(svg, 'foreground',    'Building footprints');
    var groupPoi        = createGroup(svg, 'poi',           'Entrances');
    var groupLabels     = createGroup(svg, 'street-labels', 'Street name labels');

    renderFeatures(paths,     groupMidground,  proj);
    renderFeatures(buildings, groupForeground, proj);
    renderFeatures(entrances, groupPoi,        proj);

    // 5. Street name labels in page margins
    renderMarginLabels(streetLabels, groupLabels, proj);

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

    var usableW = VIEWBOX_W - MARGIN_LEFT - MARGIN_RIGHT;
    var usableH = VIEWBOX_H - MARGIN_TOP  - MARGIN_BOTTOM;

    var lngRange = maxLng - minLng || 0.001;
    var latRange = maxLat - minLat || 0.001;

    var scale = Math.min(usableW / lngRange, usableH / latRange);

    var renderedW = lngRange * scale;
    var renderedH = latRange * scale;
    var offsetX = MARGIN_LEFT  + (usableW - renderedW) / 2;
    var offsetY = MARGIN_TOP   + (usableH - renderedH) / 2;

    return {
      minLng: minLng, maxLat: maxLat,
      scale: scale, offsetX: offsetX, offsetY: offsetY,
      // Content-area edges in SVG mm (used by margin label placement)
      contentMinX: offsetX,
      contentMaxX: offsetX + renderedW,
      contentMinY: offsetY,
      contentMaxY: offsetY + renderedH
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

  // --- Margin label placement ---
  // Each streetLabel feature has geometry.type=Point (centroid of the street)
  // and properties.side = 'top'|'bottom'|'left'|'right'
  // Labels are placed in the white space outside the building content area.

  function renderMarginLabels(streetLabels, group, proj) {
    streetLabels.forEach(function (f) {
      var p    = f.properties || {};
      var name = p.name;
      var side = p.side;
      if (!name || !side) return;

      var coords = f.geometry.coordinates;  // [lng, lat] centroid of the street
      var pt     = project(coords[0], coords[1], proj);

      var x, y, anchor;

      switch (side) {
        case 'top':
          // Horizontally aligned with street centroid, vertically centred in top margin
          x      = Math.max(MARGIN_LEFT + 5, Math.min(VIEWBOX_W - MARGIN_RIGHT - 5, pt[0]));
          y      = (proj.contentMinY) / 2;   // halfway between page top and content top
          anchor = 'middle';
          break;

        case 'bottom':
          x      = Math.max(MARGIN_LEFT + 5, Math.min(VIEWBOX_W - MARGIN_RIGHT - 5, pt[0]));
          y      = proj.contentMaxY + (VIEWBOX_H - proj.contentMaxY) / 2;
          anchor = 'middle';
          break;

        case 'left':
          x      = proj.contentMinX / 2;     // halfway between page left and content left
          y      = Math.max(MARGIN_TOP + 5, Math.min(VIEWBOX_H - MARGIN_BOTTOM - 5, pt[1]));
          anchor = 'middle';
          break;

        case 'right':
          x      = proj.contentMaxX + (VIEWBOX_W - proj.contentMaxX) / 2;
          y      = Math.max(MARGIN_TOP + 5, Math.min(VIEWBOX_H - MARGIN_BOTTOM - 5, pt[1]));
          anchor = 'middle';
          break;

        default:
          return;
      }

      var text = document.createElementNS(SVG_NS, 'text');
      text.setAttribute('x', Math.round(x * 10) / 10);
      text.setAttribute('y', Math.round(y * 10) / 10);
      text.setAttribute('text-anchor', anchor);
      text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-family', 'Arial, sans-serif');
      text.setAttribute('font-size', '7');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('fill', '#111111');
      text.setAttribute('data-street', name);
      text.textContent = name;
      group.appendChild(text);
    });
  }

  return { render: render };

}());
