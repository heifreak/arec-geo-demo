"""Metric, offline geometry facts. No scoring, veto, classification or default radii."""
from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from math import isfinite, pi
from numbers import Real
import re

from pyproj import CRS, Transformer, network
from shapely import STRtree, force_2d, union_all
from shapely.geometry import shape
from shapely.ops import transform

network.set_network_enabled(False)


def finite_number(value, name, *, minimum=None):
    if isinstance(value, bool) or not isinstance(value, Real) or not isfinite(value):
        raise ValueError(f"{name}: se requiere un número finito")
    if minimum is not None and value < minimum:
        raise ValueError(f"{name}: fuera de rango")
    return float(value)


def epsg_crs(value):
    if not isinstance(value, str) or not re.fullmatch(r"EPSG:[1-9]\d*", value):
        raise ValueError("CRS explícito requerido con formato EPSG:numérico")
    return CRS.from_epsg(int(value.split(":")[1]))


def metric_utm(value):
    crs = epsg_crs(value)
    if not crs.is_projected or not crs.utm_zone or len(crs.axis_info) < 2 or any(axis.unit_conversion_factor != 1 for axis in crs.axis_info[:2]):
        raise ValueError("Se requiere un CRS UTM métrico explícito; no se calculan áreas/distancias en grados o Web Mercator")
    return crs


def record_id(value):
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        raise ValueError("Identificador no escalar")
    if isinstance(value, (int, float)):
        finite_number(value, "identificador")
        if abs(value) > 2**53 - 1:
            raise ValueError("Identificador numérico no interoperable con el visor; usar texto")
        if int(value) == value:
            value = int(value)
    text = str(value)
    if not text.strip():
        raise ValueError("Identificador ausente")
    return text


@dataclass(frozen=True)
class Record:
    id: str
    geometry: object
    attributes: dict


def project_features(collection, *, source_crs, metric_crs, id_field=None):
    """Read geometry in an explicit CRS; never repair shapes or overwrite attributes."""
    source = epsg_crs(source_crs)
    target = metric_utm(metric_crs)
    if not isinstance(collection, dict) or collection.get("type") != "FeatureCollection" or not isinstance(collection.get("features"), list):
        raise ValueError("Se requiere GeoJSON FeatureCollection")
    if len(collection["features"]) > 100000:
        raise ValueError("Límite técnico: revisar una muestra menor a 100 000 entidades")
    declared = collection.get("crs", {}).get("properties", {}).get("name")
    if declared:
        aliases = {"urn:ogc:def:crs:OGC:1.3:CRS84": "EPSG:4326", "urn:ogc:def:crs:EPSG::4326": "EPSG:4326"}
        if aliases.get(declared, declared) != source_crs:
            raise ValueError("CRS declarado y perfil no coinciden; no se reinterpretan coordenadas")
    converter = Transformer.from_crs(source, target, always_xy=True, allow_ballpark=False, only_best=True)
    records = []
    ids = set()
    for index, feature in enumerate(collection["features"]):
        if not isinstance(feature, dict) or feature.get("type") != "Feature" or not isinstance(feature.get("properties"), dict) or not feature.get("geometry"):
            raise ValueError("Entidad sin geometría o atributos válidos")
        attributes = deepcopy(feature["properties"])
        raw_id = attributes.get(id_field) if id_field else feature.get("id", f"record-{index}")
        identifier = record_id(raw_id)
        if identifier in ids:
            raise ValueError("Identificadores duplicados; no se fusionan registros")
        ids.add(identifier)
        geometry = force_2d(shape(feature["geometry"]))
        if geometry.is_empty or not geometry.is_valid or any(not isfinite(v) for v in geometry.bounds):
            raise ValueError("Geometría vacía/inválida; no se repara automáticamente")
        if source.is_geographic:
            x0, y0, x1, y1 = geometry.bounds
            if not (-180 <= x0 <= x1 <= 180 and -90 <= y0 <= y1 <= 90):
                raise ValueError("Coordenadas geográficas fuera de rango")
            area = target.area_of_use
            if area and not (area.west <= x0 <= x1 <= area.east and area.south <= y0 <= y1 <= area.north):
                raise ValueError("La geometría excede el ámbito del CRS UTM declarado")
        projected = transform(lambda x, y, z=None: converter.transform(x, y, errcheck=True), geometry)
        if projected.is_empty or not projected.is_valid or any(not isfinite(v) for v in projected.bounds):
            raise ValueError("Reproyección inválida; no se produce un resultado aproximado silencioso")
        records.append(Record(identifier, projected, attributes))
    return records


def grid_facts(records, *, side_m, length_tolerance_m, area_tolerance_m2):
    side = finite_number(side_m, "lado nominal", minimum=0)
    length_tol = finite_number(length_tolerance_m, "tolerancia lineal", minimum=0)
    area_tol = finite_number(area_tolerance_m2, "tolerancia de área", minimum=0)
    if side == 0 or length_tol >= side or area_tol >= side**2:
        raise ValueError("Dimensiones/tolerancias inválidas")
    facts = []
    for record in records:
        geometry = record.geometry
        if geometry.geom_type not in ("Polygon", "MultiPolygon") or geometry.is_empty or not geometry.is_valid or geometry.area <= 0:
            raise ValueError("La malla requiere polígonos válidos de área positiva")
        rectangle = geometry.minimum_rotated_rectangle
        vertices = list(rectangle.exterior.coords)
        lengths = [((a[0] - b[0])**2 + (a[1] - b[1])**2)**0.5 for a, b in zip(vertices, vertices[1:])]
        square = all(abs(length - side) <= length_tol for length in lengths) and abs(geometry.area - side**2) <= area_tol and geometry.symmetric_difference(rectangle).area <= area_tol
        facts.append({"id": record.id, "geometry_area_m2": geometry.area, "geometry_area_ha": geometry.area / 10000, "nominal_area_m2": side**2, "full_square_within_tolerance": square, "geometry_kind": geometry.geom_type})
    return facts


def direct_attributes(record, fields):
    if not isinstance(fields, list) or any(not isinstance(field, str) or not field for field in fields) or len(set(fields)) != len(fields):
        raise ValueError("Campos directos explícitos y únicos requeridos")
    return {"id": record.id, "values": {field: deepcopy(record.attributes.get(field)) for field in fields}, "absent_fields": [field for field in fields if field not in record.attributes]}


class TargetIndex:
    def __init__(self, records):
        self.records = list(records)
        self.geometries = [record.geometry for record in self.records]
        if any(geometry.is_empty or not geometry.is_valid for geometry in self.geometries):
            raise ValueError("Fuente espacial inválida")
        self.tree = STRtree(self.geometries)

    def nearest_from_centroid(self, cell):
        if not self.records:
            return {"distance_m": None, "nearest_ids": [], "status": "source-empty-not-zero-distance"}
        indices, distances = self.tree.query_nearest(cell.geometry.centroid, all_matches=True, return_distance=True)
        return {"distance_m": float(min(distances)), "nearest_ids": sorted(self.records[int(i)].id for i in indices), "status": "planar-euclidean-not-network-isochrone"}

    def buffer_count(self, cell, *, radius_m):
        radius = finite_number(radius_m, "radio", minimum=0)
        if radius == 0:
            raise ValueError("El radio debe ser positivo y explícito")
        if not self.records:
            return {"intersecting_records": None, "radius_m": radius, "status": "source-empty-coverage-unverified"}
        indices = self.tree.query(cell.geometry.centroid, predicate="dwithin", distance=radius)
        return {"intersecting_records": len(indices), "radius_m": radius, "buffer_area_m2": pi * radius**2, "status": "count-of-source-records-not-a-score"}

    def intersection_area(self, cell):
        if not self.records:
            return {"intersection_m2": None, "cell_geometry_area_m2": cell.geometry.area, "status": "source-empty-coverage-unverified"}
        if any(geometry.geom_type not in ("Polygon", "MultiPolygon") for geometry in self.geometries):
            raise ValueError("Cruce de área requiere polígonos; no se inventa un ancho para líneas/puntos")
        if cell.geometry.geom_type not in ("Polygon", "MultiPolygon") or cell.geometry.area <= 0:
            raise ValueError("Celda no poligonal o sin área")
        indices = self.tree.query(cell.geometry, predicate="intersects")
        intersections = [cell.geometry.intersection(self.geometries[int(i)]) for i in indices]
        area = float(union_all(intersections).area) if intersections else 0.0
        return {"intersection_m2": area, "cell_geometry_area_m2": cell.geometry.area, "status": "union-without-double-counting-not-a-veto"}


def overlap_percent(intersection_m2, *, denominator_m2):
    if intersection_m2 is None:
        return None
    area = finite_number(intersection_m2, "área intersectada", minimum=0)
    denominator = finite_number(denominator_m2, "denominador explícito", minimum=0)
    if denominator == 0 or area > denominator:
        raise ValueError("Denominador inválido o menor al área intersectada")
    return 100 * area / denominator


def queen_components(records, *, max_overlap_area_m2):
    """Explicit Queen adjacency only; not DBSCAN, T1/T2/T3 or opportunity classification."""
    tolerance = finite_number(max_overlap_area_m2, "tolerancia de solapamiento", minimum=0)
    if len({record.id for record in records}) != len(records):
        raise ValueError("Identificadores duplicados")
    geometries = [record.geometry for record in records]
    if any(geometry.geom_type not in ("Polygon", "MultiPolygon") or geometry.is_empty or not geometry.is_valid or geometry.area <= 0 for geometry in geometries):
        raise ValueError("La contigüidad requiere polígonos válidos")
    tree = STRtree(geometries)
    parents = list(range(len(records)))

    def find(index):
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    for i, geometry in enumerate(geometries):
        for j in tree.query(geometry, predicate="intersects"):
            j = int(j)
            if j <= i:
                continue
            if geometry.intersection(geometries[j]).area > tolerance:
                raise ValueError("Celdas solapadas; no se disuelven ni duplican áreas silenciosamente")
            parents[find(j)] = find(i)
    groups = {}
    for i, record in enumerate(records):
        groups.setdefault(find(i), []).append(record)
    return sorted([{"cell_ids": sorted(record.id for record in group), "union_area_m2": float(union_all([record.geometry for record in group]).area), "status": "geometry-component-not-an-approved-macropolygon"} for group in groups.values()], key=lambda group: group["cell_ids"])
