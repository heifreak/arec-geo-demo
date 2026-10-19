export function validateSessionGeoJSON(data) {
  if (data?.type !== 'FeatureCollection' || !Array.isArray(data.features) || data.features.length > 50000) throw Error('Se requiere FeatureCollection de hasta 50 000 entidades.');
  if (data.crs && !['EPSG:4326', 'urn:ogc:def:crs:OGC:1.3:CRS84', 'urn:ogc:def:crs:EPSG::4326'].includes(data.crs.properties?.name)) throw Error('Reproyectar a GeoJSON WGS84 longitud/latitud antes de cargar.');
  function position(point) {
    if (!Array.isArray(point) || point.length < 2 || point.some(value => typeof value !== 'number' || !Number.isFinite(value)) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) throw Error('Coordenadas inválidas o fuera de WGS84.');
  }
  function nested(value, depth) {
    if (depth === 0) { position(value); return; }
    if (!Array.isArray(value) || !value.length) throw Error('Geometría vacía o inválida.');
    for (const part of value) nested(part, depth - 1);
  }
  const depths = { Point: 0, MultiPoint: 1, LineString: 1, MultiLineString: 2, Polygon: 2, MultiPolygon: 3 };
  function geometry(value, depth = 0) {
    if (value === null) return;
    if (!value || depth > 10) throw Error('Geometría inválida.');
    if (value.type === 'GeometryCollection') {
      if (!Array.isArray(value.geometries)) throw Error('Colección geométrica inválida.');
      for (const item of value.geometries) geometry(item, depth + 1);
    } else {
      if (!Object.hasOwn(depths, value.type)) throw Error('Tipo geométrico no soportado.');
      nested(value.coordinates, depths[value.type]);
    }
  }
  for (const feature of data.features) {
    if (feature?.type !== 'Feature' || !feature.properties || typeof feature.properties !== 'object' || Array.isArray(feature.properties)) throw Error('Cada entidad debe tener atributos originales.');
    geometry(feature.geometry);
  }
  return data;
}
