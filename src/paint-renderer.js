import { resolvePaint } from './style-expressions.js';
export function originalProperties(entity, layer, time) {
  const properties = entity.properties?.getValue(time) ?? {};
  return layer.sessionOnly ? properties.__arecOriginal ?? {} : properties;
}
export function applyPaint(source, layer, C, time, multiplier) {
  // Resolve and validate every symbol before mutating any rendered entity.
  const features = source.entities.values.filter(entity => !entity._arecParent);
  const symbols = features.map(entity => {
    const values = resolvePaint(layer.style.paint, originalProperties(entity, layer, time));
    const colors = {};
    for (const [key, value] of Object.entries(values)) if (key.endsWith('-color')) {
      colors[key] = C.Color.fromCssColorString(value); if (!colors[key]) throw Error('Color no soportado; conserva la referencia para revisión.');
    }
    if (entity.polygon && !colors['fill-color'] && !colors['line-color'] || entity.polyline && !entity.polygon && !colors['line-color'] || (entity.billboard || entity.point) && !colors['circle-color']) throw Error('La referencia no define simbología para la geometría recibida.');
    return { entity, values, colors };
  });
  for (const { entity, values: p, colors } of symbols) {
    const color = (key, opacity) => colors[key]?.withAlpha((colors[key].alpha ?? 1) * (p[opacity] ?? 1) * multiplier);
    if (entity.polygon) {
      entity.polygon.fill = Boolean(colors['fill-color']);
      if (colors['fill-color']) entity.polygon.material = color('fill-color', 'fill-opacity');
      if (colors['line-color']) {
        // Ground polygons need explicit clamped polylines: native polygon outlines are unsupported on terrain.
        entity.polygon.outline = false;
        if (!entity._arecRings) {
          const hierarchy = entity.polygon.hierarchy.getValue(time);
          const rings = [];
          function visit(part) { if (part?.positions?.length) rings.push(part.positions); for (const hole of part?.holes ?? []) visit(hole); }
          visit(hierarchy); entity._arecRings = [];
          for (const positions of rings) {
            const ring = source.entities.add({ polyline: { positions: [...positions, positions[0]], clampToGround: true, width: p['line-width'] ?? 1, material: color('line-color', 'line-opacity') } });
            ring._arecParent = entity; entity._arecRings.push(ring);
          }
        }
        for (const ring of entity._arecRings) { ring.polyline.material = color('line-color', 'line-opacity'); ring.polyline.width = p['line-width'] ?? 1; }
      }
    } else if (entity.polyline && colors['line-color']) {
      entity.polyline.material = color('line-color', 'line-opacity'); entity.polyline.width = p['line-width'] ?? 1;
    }
    if ((entity.billboard || entity.point) && colors['circle-color']) {
      if (entity.billboard) entity.billboard.show = false;
      entity.point ??= new C.PointGraphics({ heightReference: C.HeightReference.CLAMP_TO_GROUND });
      entity.point.color = color('circle-color', 'circle-opacity'); entity.point.pixelSize = 2 * (p['circle-radius'] ?? 4);
      if (colors['circle-stroke-color']) entity.point.outlineColor = color('circle-stroke-color', 'circle-opacity');
      entity.point.outlineWidth = p['circle-stroke-width'] ?? 0;
    }
  }
}
