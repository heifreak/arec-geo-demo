"""Synthetic geometry only; these fixtures do not validate a corporate model."""
import unittest
from shapely.geometry import box, Point, LineString, mapping
from shapely.affinity import rotate
from processing.spatial import (Record, TargetIndex, direct_attributes, grid_facts,
    metric_utm, overlap_percent, project_features, queen_components)


def cell(name='a', geometry=None, attributes=None):
    return Record(name, geometry if geometry is not None else box(0, 0, 500, 500), attributes or {})


class GeometryTests(unittest.TestCase):
    def test_square_rotated_and_clipped(self):
        facts = grid_facts([cell(), cell('b', rotate(box(0,0,500,500), 23)), cell('c', box(0,0,250,500))], side_m=500, length_tolerance_m=.001, area_tolerance_m2=.01)
        self.assertEqual([x['full_square_within_tolerance'] for x in facts], [True, True, False])
        self.assertEqual(facts[0]['geometry_area_ha'], 25)
        self.assertEqual(facts[2]['geometry_area_m2'], 125000)

    def test_explicit_metric_crs(self):
        for crs in ['EPSG:4326', 'EPSG:3857', None]:
            with self.assertRaises(ValueError): metric_utm(crs)
        self.assertTrue(metric_utm('EPSG:32631').is_projected)

    def test_projection_preserves_attributes(self):
        source = {'type':'FeatureCollection','features':[{'type':'Feature','id':'x','properties':{'density':None},'geometry':mapping(Point(3,0))}]}
        records = project_features(source, source_crs='EPSG:4326', metric_crs='EPSG:32631')
        self.assertAlmostEqual(records[0].geometry.x,500000)
        self.assertEqual(records[0].attributes, {'density':None})
        source['features'][0]['properties']['density'] = 2
        self.assertIsNone(records[0].attributes['density'])

    def test_conflicting_crs_and_duplicate_ids(self):
        feature = {'type':'Feature','id':'x','properties':{},'geometry':mapping(Point(3,0))}
        source = {'type':'FeatureCollection','features':[feature, feature]}
        with self.assertRaises(ValueError): project_features(source,source_crs='EPSG:4326',metric_crs='EPSG:32631')
        source['features'] = [feature]
        source['crs'] = {'properties':{'name':'EPSG:3857'}}
        with self.assertRaises(ValueError): project_features(source,source_crs='EPSG:4326',metric_crs='EPSG:32631')

    def test_missing_and_null_are_distinct(self):
        result = direct_attributes(cell(attributes={'known':None,'nested':{'a':1}}), ['known','missing','nested'])
        self.assertEqual(result['absent_fields'], ['missing'])
        self.assertIsNone(result['values']['known'])

    def test_nearest_ties_and_generator_input(self):
        index = TargetIndex(iter([cell('left',Point(150,250)),cell('right',Point(350,250))]))
        result = index.nearest_from_centroid(cell())
        self.assertEqual(result['distance_m'],100)
        self.assertEqual(result['nearest_ids'],['left','right'])

    def test_empty_source_is_not_zero(self):
        index = TargetIndex([])
        self.assertIsNone(index.nearest_from_centroid(cell())['distance_m'])
        self.assertIsNone(index.intersection_area(cell())['intersection_m2'])
        self.assertIsNone(index.buffer_count(cell(),radius_m=100)['intersecting_records'])

    def test_buffer_boundary_and_radius(self):
        index = TargetIndex([cell('a',Point(350,250)),cell('b',Point(350.01,250))])
        self.assertEqual(index.buffer_count(cell(),radius_m=100)['intersecting_records'],1)
        with self.assertRaises(ValueError): index.buffer_count(cell(),radius_m=0)

    def test_intersection_union_avoids_double_count(self):
        index = TargetIndex([cell('a',box(0,0,300,500)),cell('b',box(200,0,500,500))])
        area = index.intersection_area(cell())['intersection_m2']
        self.assertEqual(area,250000)
        self.assertEqual(overlap_percent(area,denominator_m2=250000),100)
        with self.assertRaises(ValueError): overlap_percent(area,denominator_m2=100)

    def test_lines_do_not_get_invented_width(self):
        with self.assertRaises(ValueError): TargetIndex([cell('l',LineString([(0,0),(500,500)]))]).intersection_area(cell())

    def test_queen_corner_and_separated_components(self):
        result = queen_components([cell(),cell('b',box(500,500,1000,1000)),cell('c',box(1500,0,2000,500))],max_overlap_area_m2=0)
        self.assertEqual([x['cell_ids'] for x in result],[['a','b'],['c']])
        self.assertEqual(result[0]['union_area_m2'],500000)

    def test_overlapping_cells_rejected(self):
        with self.assertRaises(ValueError): queen_components([cell(),cell('b',box(250,0,750,500))],max_overlap_area_m2=0)


if __name__ == '__main__': unittest.main()
