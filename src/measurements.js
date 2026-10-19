// Spherical estimates, not cadastral or terrain-following survey measurements.
const R = 6371008.8;
const radians = degrees => degrees * Math.PI / 180;
const wrapped = angle => Math.atan2(Math.sin(angle), Math.cos(angle));
export function surfaceDistance(points) {
  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    const [lon1, lat1] = points[i - 1].map(radians);
    const [lon2, lat2] = points[i].map(radians);
    const a = Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2;
    distance += 2 * R * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
  }
  return distance;
}
export function surfaceArea(points) {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [lon1, lat1] = points[i].map(radians);
    const [lon2, lat2] = points[(i + 1) % points.length].map(radians);
    sum += wrapped(lon2 - lon1) * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  const area = Math.abs(sum) * R * R / 2;
  return Math.min(area, 4 * Math.PI * R * R - area);
}

export function installDrawing(viewer, C, report) {
  const drawings = new C.CustomDataSource('Dibujos locales — sin persistencia');
  viewer.dataSources.add(drawings);
  let mode = null; let points = []; let vertexEntities = [];
  const handler = new C.ScreenSpaceEventHandler(viewer.scene.canvas);
  function resetVertices() { for (const entity of vertexEntities) drawings.entities.remove(entity); vertexEntities = []; points = []; }
  function finish() {
    if (mode === 'line' && points.length >= 2) {
      drawings.entities.add({ name: 'Línea dibujada', polyline: { positions: C.Cartesian3.fromDegreesArray(points.flat()), clampToGround: true, width: 3, material: C.Color.CYAN } });
      report(`Distancia superficial aproximada: ${(surfaceDistance(points) / 1000).toFixed(3)} km.`);
      resetVertices(); mode = null;
    } else if (mode === 'polygon' && points.length >= 3) {
      drawings.entities.add({ name: 'Polígono dibujado — no analítico', polygon: { hierarchy: C.Cartesian3.fromDegreesArray(points.flat()), material: C.Color.CYAN.withAlpha(0.25), outline: true, heightReference: C.HeightReference.CLAMP_TO_GROUND } });
      report(`Área esférica aproximada: ${(surfaceArea(points) / 10000).toFixed(3)} ha. No es un cálculo catastral ni sigue el relieve. Usa polígonos simples sin cruces.`);
      resetVertices(); mode = null;
    } else report('Añade al menos dos vértices para una línea o tres para un polígono.');
    viewer.scene.requestRender();
  }
  handler.setInputAction(event => {
    if (!mode) return;
    const ray = viewer.camera.getPickRay(event.position);
    if (!ray) return;
    const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
    if (!cartesian) return;
    const p = C.Cartographic.fromCartesian(cartesian);
    const coords = [C.Math.toDegrees(p.longitude), C.Math.toDegrees(p.latitude)];
    const entity = drawings.entities.add({ position: C.Cartesian3.fromDegrees(...coords), point: { pixelSize: 9, color: C.Color.CYAN, heightReference: C.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY }, name: 'Punto dibujado' });
    if (mode === 'point') { report(`Punto: ${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}. WGS84.`); mode = null; }
    else { points.push(coords); vertexEntities.push(entity); report(`${points.length} vértices. Pulsa Terminar para completar.`); }
    viewer.scene.requestRender();
  }, C.ScreenSpaceEventType.LEFT_CLICK);
  return {
    start(nextMode) { resetVertices(); mode = nextMode; report('Haz clic sobre el terreno para colocar vértices.'); },
    finish,
    clear() { mode = null; points = []; vertexEntities = []; drawings.entities.removeAll(); report('Dibujos eliminados.'); viewer.scene.requestRender(); }
  };
}
