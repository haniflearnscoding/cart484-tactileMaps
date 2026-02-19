# cart484-tactileMaps

**Technical Workflow Report: Automated Tactile Mapping for Concordia University**

---

## 1. Project Context and Mission Alignment

This document establishes the technical architecture for the automated production of tactile campus maps at Concordia University. Current global data from ProBlind indicates that of the 43 million blind people worldwide, only 4% of learning graphics are available in accessible formats. This deficit is not a lack of data, but a bottleneck in manual transcription.

By synthesizing the mission of the Concordia Access Centre for Students with Disabilities (ACSD)—which prioritizes equal access and inclusive community building—with automated geospatial processing, this workflow serves as a direct intervention in global information equity. The primary objective is the algorithmic transformation of complex campus spatial geometry into "fingertip-readable" tactile assets for the Sir George Williams (SGW) and Loyola campuses.

---

## 2. Data Sourcing and Environmental Scope

The system architecture ingests spatial data from the Concordia "Maps" utility and IT services infrastructure provided through the Student Hub. The environmental scope encompasses:

- **SGW Campus:** Downtown urban footprints, interconnecting subterranean tunnels, and building elevations.
- **Loyola Campus:** West-end campus grounds, green spaces, and facility perimeters.
- **Surrounding Areas:** Critical urban navigation points and street grids requested by Allison Rollins (ACSD) to facilitate transition between city transit and university property.

Stakeholder validation is integrated via the DCART484 studio, involving Allison Rollins, ACSD accessibility advisors, and students registered for final exam accommodations.

---

## 3. Automated Vector Extraction Pipeline

The pipeline converts raw geospatial data into structured vector formats (SVG, GeoJSON, or Shapefiles) optimized for tactile embossers. The extraction logic focuses on "schema mapping," where specific attribute tags (e.g., `building`, `pedestrian_path`) are isolated.

**Technical Command Sequence (Pseudo-code):**

```python
# Initialize extraction from Concordia Spatial Database
source_data = load("Concordia_Campus_Master_v2026.geojson")

# Isolate critical navigational layers
buildings = source_data.filter(layer="footprints").attribute_match(tag="campus_structure")
paths = source_data.filter(layer="thoroughfares").attribute_match(type="pedestrian_link")

# Execute geometric simplification (Douglas-Peucker Algorithm)
# Threshold set to 0.8m to remove negligible architectural facets
simplified_vectors = buildings.simplify(tolerance=0.8, preserve_topology=True)

# Standardize for ProBlind Open Access/Creative Commons licensing
export(simplified_vectors, format="SVG", profile="ProBlind_Standard_v4")
```

The output must adhere to the ProBlind "Graphic license types," ensuring all generated templates remain Open Access for the global blind community.

---

## 4. Algorithmic Simplification for Tactile Perception

Tactile usability requires a radical reduction in visual noise to prevent "tactile masking," where dense information clusters become indistinguishable to the fingertip.

- **Noise Removal:** The algorithm strips all non-essential metadata, including decorative landscaping (flower beds, benches) and micro-text labels that do not serve a navigational purpose.
- **Vertex Reduction:** Computational logic reduces the vertex count of building polygons by approximately 60% to ensure smooth tactile boundaries.
- **Line Thinning and Dilation:** To meet tactile discrimination standards, a minimum clearance of 3mm must be maintained between parallel lines. Paths are dilated to a standardized stroke weight of 1.5mm, while building perimeters are set to 2.2mm for clear haptic contrast.

**Tactile Hierarchy Mapping**

| Digital Entity | Tactile Treatment | Logic / Resolution Threshold |
|---|---|---|
| EV Building | High-relief solid boundary | 2.2mm stroke weight |
| SGW / Loyola Pathways | Raised dashed line | 1.5mm stroke; 3mm gap |
| Building Entrances | Raised 4mm circle symbol | Point-of-interest (POI) trigger |
| Street Grids | Low-relief 0.5mm thin lines | Minimal relief to prevent masking |

---

## 5. Participatory Design and Iterative Refinement

Following the DCART484 Inclusive and Accessible Design methodology led by Professor Florian Grond, the technical development cycle includes a three-stage participatory loop.

1. **Requirement Synthesis:** Initial meetings with ACSD clients to document specific navigation hurdles between SGW and Loyola.
2. **Prototype Evaluation I:** Conducted during class hours (Thursday 8:45–12:45) in EV Building 7.745. Algorithmic outputs are tested for fingertip discrimination.
3. **Prototype Evaluation II:** Ethnographic observation of students using refined maps. Feedback regarding line weights and "clutter" directly informs the recalibration of the thinning algorithm.

Hands-on adjustments occur during the "Ask Me Anything" (AMA) sessions and within the EV building workshop facilities to bridge the gap between digital vectors and physical tactile outcomes.

---

## 6. Integration with the ProBlind Ecosystem

Validated campus templates are contributed to the global ProBlind database, supporting the 43 million blind individuals who require free, high-quality graphics.

- **Documentation:** Per DCART484 final assignment requirements, a dedicated project website will host the technical report, iteration logs, and client feedback.
- **Open Access Upload:** Final SVG files are uploaded to the ProBlind database under the "Create/Edit" regulations, ensuring they are searchable for any blind student arriving at Concordia.

---

## 7. Workflow Maintenance and Quality Assurance

To ensure academic integrity and navigational safety, the following standards are mandatory:

- **Absolute Grounding:** All map labels must match official nomenclature found on the Concordia Student Hub and ACSD registration portals.
- **Critical Synchronization Date:** All automated maps for the Winter term must be validated and ready by **February 27, 2026**. This aligns with the ACSD deadline for students to submit documentation for final exam accommodations.
- **Code of Conduct:** All developers must adhere to the "Academic Code of Conduct" regarding intellectual property. No unauthorized recording of client sessions is permitted without express consent.
- **Technical Verification:** Discrepancies in spatial data or accessibility standards should be referred to [acsd.intake@concordia.ca](mailto:acsd.intake@concordia.ca) for advisor consultation.
