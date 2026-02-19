// Stage 6: SVG Exporter
// Serializes SVG element with ProBlind_Standard_v4 header comment
// Downloads as tactile-map-sgw-YYYY-MM-DD.svg

var SVGExporter = (function () {

  var PROBLINK_VERSION = 'ProBlind_Standard_v4';

  function exportMap(svgEl) {
    if (!svgEl) {
      throw new Error('SVGExporter: no SVG element provided');
    }

    // Serialize the SVG element to string
    var serializer = new XMLSerializer();
    var svgString = serializer.serializeToString(svgEl);

    // Build the ProBlind header comment
    var today = new Date();
    var dateStr = today.getFullYear() + '-'
      + String(today.getMonth() + 1).padStart(2, '0') + '-'
      + String(today.getDate()).padStart(2, '0');

    var header = buildProBlindHeader(dateStr);

    // Insert header after the XML declaration (or at the very start)
    var finalSVG;
    if (svgString.startsWith('<?xml')) {
      // Insert after the XML declaration
      var xmlDeclEnd = svgString.indexOf('?>') + 2;
      finalSVG = svgString.slice(0, xmlDeclEnd)
        + '\n' + header + '\n'
        + svgString.slice(xmlDeclEnd);
    } else {
      finalSVG = header + '\n' + svgString;
    }

    // Trigger browser download
    var filename = 'tactile-map-sgw-' + dateStr + '.svg';
    var blob = new Blob([finalSVG], { type: 'image/svg+xml;charset=utf-8' });
    var url = URL.createObjectURL(blob);

    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();

    // Clean up
    setTimeout(function () {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);

    return { filename: filename, size: finalSVG.length };
  }

  function buildProBlindHeader(dateStr) {
    return [
      '<!--',
      '  ============================================================',
      '  ' + PROBLINK_VERSION,
      '  ============================================================',
      '  Campus:       Concordia University — Sir George Williams (SGW)',
      '  Map Type:     Building Footprints + Pedestrian Network',
      '  Format:       A4 Landscape (297mm × 210mm), 1:1 emboss scale',
      '  Generated:    ' + dateStr,
      '  Pipeline:     cart484-tactileMaps v1.0',
      '  License:      Concordia CART484 Research Prototype',
      '  ============================================================',
      '  TACTILE SPECIFICATION (ProBlind_Standard_v4):',
      '  Layer             | Stroke   | Dash        | Treatment',
      '  ------------------|----------|-------------|------------------',
      '  Building boundary | 2.2mm    | solid       | High-relief solid',
      '  Pedestrian path   | 1.5mm    | 3mm/3mm gap | Raised dashed line',
      '  Building entrance | 0.5mm    | solid       | 4mm filled circle',
      '  Street grid       | 0.5mm    | solid       | Low-relief thin',
      '  ============================================================',
      '  COORDINATE SYSTEM: WGS84 → linear SVG projection',
      '  Print at 100% scale — do NOT scale to fit page.',
      '  ============================================================',
      '-->'
    ].join('\n');
  }

  return { export: exportMap };

}());
