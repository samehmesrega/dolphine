import * as THREE from 'three';
import { booleans, extrusions, transforms, geometries } from '@jscad/modeling';
import { loadFont } from './FontLoader.js';
import { glyphToJSCAD, getGlyphDebugLog } from './GlyphToJSCAD.js';
import { jscadToThree } from './JscadToThree.js';

export const debugLog = [];
function dbg(msg) { debugLog.push(msg); console.log(msg); }

export async function buildAmbigram(options) {
  const {
    textA, textB, fontUrl,
    fontSize      = 72,
    spacing       = 8,
    baseHeight    = 1.5,
    basePadding   = 10,
    cornerRadius  = 0
  } = options;

  debugLog.length = 0;
  dbg(`=== BUILD START: "${textA}" + "${textB}" | font: ${fontUrl} | size: ${fontSize} ===`);

  const font = await loadFont(fontUrl);

  const maxLen = Math.max(textA.length, textB.length);
  const a = textA.toUpperCase().padEnd(maxLen, ' ');
  const b = textB.toUpperCase().padEnd(maxLen, ' ');

  const group = new THREE.Group();
  let currentX = 0, maxHeight = 0, maxDepth = 0;

  for (let i = 0; i < maxLen; i++) {
    const charA = a[i];
    const charB = b[i];
    dbg(`\n--- PAIR ${i}: '${charA}' + '${charB}' ---`);

    if (charA === ' ' && charB === ' ') {
      currentX += fontSize * 0.5;
      continue;
    }

    // Glyph → JSCAD geom2
    const resultA = glyphToJSCAD(font, charA, fontSize);
    for (const line of getGlyphDebugLog()) dbg('  [A] ' + line);

    const resultB = glyphToJSCAD(font, charB, fontSize);
    for (const line of getGlyphDebugLog()) dbg('  [B] ' + line);

    if (!resultA || !resultB) {
      dbg('  SKIP — no shape');
      currentX += fontSize * 0.5;
      continue;
    }

    const { shape: shapeA, bounds: boundsA } = resultA;
    const { shape: shapeB, bounds: boundsB } = resultB;

    dbg(`  boundsA: ${boundsA.width.toFixed(1)}x${boundsA.height.toFixed(1)}`);
    dbg(`  boundsB: ${boundsB.width.toFixed(1)}x${boundsB.height.toFixed(1)}`);

    // Extrusion depth = 3× largest glyph dimension
    const maxDim = Math.max(boundsA.width, boundsA.height, boundsB.width, boundsB.height);
    const extrudeDepth = maxDim * 3;
    dbg(`  extrudeDepth: ${extrudeDepth.toFixed(1)}`);

    // Center each geom2 at XY origin before extrusion
    const cxA = (boundsA.minX + boundsA.maxX) / 2;
    const cyA = (boundsA.minY + boundsA.maxY) / 2;
    const cxB = (boundsB.minX + boundsB.maxX) / 2;
    const cyB = (boundsB.minY + boundsB.maxY) / 2;

    const centeredA = transforms.translate([-cxA, -cyA, 0], shapeA);
    const centeredB = transforms.translate([-cxB, -cyB, 0], shapeB);

    // Extrude in Z direction (0 → extrudeDepth)
    const extA = extrusions.extrudeLinear({ height: extrudeDepth }, centeredA);
    const extB = extrusions.extrudeLinear({ height: extrudeDepth }, centeredB);

    // Center in Z: shift from [0, depth] to [-depth/2, +depth/2]
    const halfD = extrudeDepth / 2;
    const centExtA = transforms.translate([0, 0, -halfD], extA);
    const centExtB = transforms.translate([0, 0, -halfD], extB);

    // Rotate: A at -45° (face toward -X+Z, green-arrow side), B at +45° (face toward +X+Z, yellow-arrow side)
    // These two directions are perpendicular (dot=0), so CSG intersection works correctly.
    const rotA = transforms.rotateY(-Math.PI / 4, centExtA);
    const rotB = transforms.rotateY( Math.PI / 4, centExtB);

    // CSG intersection
    let jscadResult;
    try {
      jscadResult = booleans.intersect(rotA, rotB);
    } catch (err) {
      dbg(`  CSG FAILED: ${err.message}`);
      currentX += fontSize * 0.5;
      continue;
    }

    // Validate result
    const polys = geometries.geom3.toPolygons(jscadResult);
    if (!polys || polys.length === 0) {
      dbg('  CSG empty result');
      currentX += fontSize * 0.5;
      continue;
    }
    dbg(`  CSG result: ${polys.length} polygons`);

    // Convert to Three.js geometry
    const geo = jscadToThree(jscadResult);
    geo.computeBoundingBox();
    const bbox = geo.boundingBox;
    const rW = bbox.max.x - bbox.min.x;
    const rH = bbox.max.y - bbox.min.y;
    const rD = bbox.max.z - bbox.min.z;
    dbg(`  size: ${rW.toFixed(1)} x ${rH.toFixed(1)} x ${rD.toFixed(1)}`);

    if (rH < 0.1) {
      dbg('  SKIP — zero height result');
      currentX += fontSize * 0.5;
      continue;
    }

    // Place side by side along X axis
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color: 0x4a9eff,
      roughness: 0.3,
      metalness: 0.1,
      side: THREE.DoubleSide
    }));

    mesh.position.x = currentX - bbox.min.x;
    currentX += rW + spacing;
    maxHeight = Math.max(maxHeight, rH);
    maxDepth  = Math.max(maxDepth,  rD);

    mesh.name = `pair_${charA}_${charB}`;
    group.add(mesh);
  }

  // Base plate — spans the full word length (X) × letter depth (Z)
  if (group.children.length > 0) {
    const totalW = currentX - spacing + basePadding * 2;
    const totalD = maxDepth + basePadding * 2;

    // Clamp radius to XZ dimensions only (height is irrelevant for plan-view rounding)
    const r = Math.min(cornerRadius, totalW / 2, totalD / 2);
    let baseGeo;

    if (r > 0) {
      // Rounded rectangle using absarc — the canonical Three.js approach.
      // absarc auto-inserts lineTo between arcs, producing a properly-closed
      // CCW contour whose caps triangulate correctly.
      const hw = totalW / 2, hd = totalD / 2;
      const shape = new THREE.Shape();
      shape.absarc( hw - r, -hd + r, r, -Math.PI / 2,  0,             false); // bottom-right
      shape.absarc( hw - r,  hd - r, r,  0,             Math.PI / 2,   false); // top-right
      shape.absarc(-hw + r,  hd - r, r,  Math.PI / 2,   Math.PI,       false); // top-left
      shape.absarc(-hw + r, -hd + r, r,  Math.PI,        3 * Math.PI / 2, false); // bottom-left
      baseGeo = new THREE.ExtrudeGeometry(shape, { depth: baseHeight, bevelEnabled: false });
    } else {
      baseGeo = new THREE.BoxGeometry(totalW, baseHeight, totalD);
    }

    const base = new THREE.Mesh(
      baseGeo,
      new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide })
    );

    if (r > 0) {
      // mesh.rotation.x = -90°:  local Z (extrusion) → world Y  |  local Y (depth) → world -Z
      // Top of plate (local Z=baseHeight) lands at world Y = position.y + baseHeight
      // → set position.y so top = -maxHeight/2
      base.rotation.x = -Math.PI / 2;
      base.position.x  = (currentX - spacing) / 2;
      base.position.y  = -maxHeight / 2 - baseHeight;   // top at -maxHeight/2
    } else {
      // BoxGeometry is centered at local origin → position.y is the center
      base.position.x = (currentX - spacing) / 2;
      base.position.y = -maxHeight / 2 - baseHeight / 2;
    }

    base.name = 'base_plate';
    group.add(base);
  }

  // Center the whole group
  const gBBox = new THREE.Box3().setFromObject(group);
  const gCenter = new THREE.Vector3();
  gBBox.getCenter(gCenter);
  group.position.set(-gCenter.x, -gCenter.y, -gCenter.z);

  dbg(`\n=== BUILD DONE: ${group.children.length} children ===`);
  return group;
}
