"""Browser integration checks. Run: python -m unittest discover -s pdu-extractor/tests -v"""
import io
import subprocess
import threading
import unittest
import zipfile
import xml.etree.ElementTree as ET
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parents[2]
NS = {'k': 'http://www.opengis.net/kml/2.2', 'gx': 'http://www.google.com/kml/ext/2.2'}


def fixture_pdf():
    stream = io.BytesIO()
    c = canvas.Canvas(stream, pagesize=(600, 600))
    c.drawString(50, 560, 'Mapa 1 - Zonificacion territorial Toluca')
    c.setFillColorRGB(.2, .65, .3)
    c.rect(100, 150, 300, 330, fill=1, stroke=0)
    c.setFillColorRGB(.95, .9, .7)  # pale territory must survive
    c.rect(200, 220, 80, 80, fill=1, stroke=0)
    c.setFillColorRGB(0, 0, 0)
    c.drawString(470, 200, 'LEYENDA')
    c.showPage()
    c.drawString(50, 560, 'Mapa 2 - Vialidades Cancun')
    c.setFillColorRGB(.3, .4, .8)
    c.rect(100, 150, 300, 330, fill=1, stroke=0)
    c.save()
    return stream.getvalue()


class ExtractorTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        # curl uses the environment trust store; Chromium lacks the cloud proxy CA.
        # Mirror the real pinned artifacts without bypassing TLS verification.
        cls.pdf_assets = {name: subprocess.run(['curl', '--fail', '--silent', '--show-error', '--max-time', '60', f'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/{name}'], check=True, capture_output=True).stdout for name in ['pdf.min.js', 'pdf.worker.min.js']}
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()
        cls.server.shutdown()
        cls.server.server_close()

    def setUp(self):
        self.page = self.browser.new_page(accept_downloads=True)
        self.page.route('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/*', lambda route: route.fulfill(body=self.pdf_assets[route.request.url.rsplit('/', 1)[-1]], content_type='application/javascript', headers={'Access-Control-Allow-Origin': '*'}))
        self.errors = []
        self.page.on('pageerror', lambda e: self.errors.append(str(e)))
        self.page.goto(f'http://127.0.0.1:{self.server.server_port}/pdu-extractor/')
        self.page.wait_for_function('!!window.ARECExtractorDebug')
        self.page.locator('#pdfFile').set_input_files({'name': 'Toluca.pdf', 'mimeType': 'application/pdf', 'buffer': fixture_pdf()})
        self.page.locator('#btnScan').click()
        self.page.wait_for_function('window.ARECExtractorDebug.getState().candidates === 2 && !document.querySelector("#btnScan").disabled', timeout=60000)
        self.page.locator('#resetCrop').click()

    def tearDown(self):
        self.page.close()

    def point(self, x, y):
        box = self.page.locator('#preview').bounding_box()
        self.page.locator('#preview').click(position={'x': x*box['width'], 'y': y*box['height']})

    def download(self, selector):
        with self.page.expect_download() as info:
            self.page.locator(selector).click()
        return zipfile.ZipFile(info.value.path())

    def test_clean_overlay_and_saved_edits(self):
        p = self.page
        p.locator('#modeMask').click()
        for x, y in [(.1,.1),(.7,.1),(.7,.9),(.1,.9)]:
            self.point(x,y)
        p.locator('#finishMask').click()
        p.locator('#mapTitle').fill('Territorio & prueba')
        archive = self.download('#btnVisual')
        root = ET.fromstring(archive.read('doc.kml'))
        self.assertIsNotNone(root.find('.//k:GroundOverlay/k:LatLonBox', NS))
        self.assertIn('NO CALIBRADA', ''.join(root.itertext()))
        self.assertEqual(root.find('.//k:Icon/k:href', NS).text, 'files/plano.png')
        image = Image.open(io.BytesIO(archive.read('files/plano.png'))).convert('RGBA')
        def pixel(x,y): return image.getpixel((int(image.width*x),int(image.height*y)))
        self.assertEqual(pixel(.05,.5)[3], 0)  # outside territorial mask
        self.assertEqual(pixel(.15,.15)[3], 0)  # white inside mask
        self.assertEqual(pixel(.4,.55)[3], 255)  # pale territory
        self.assertEqual(pixel(.3,.4)[3], 255)  # colored territory
        p.locator('.candidate').nth(1).click()
        p.wait_for_function('window.ARECExtractorDebug.getState().selected===1')
        self.assertEqual(p.locator('#municipio').input_value(), 'TOL')  # explicit/current plaza retained
        p.locator('.candidate').nth(0).click()
        p.wait_for_function('document.querySelector("#mapTitle").value==="Territorio & prueba"')
        self.assertIn('cerrado', p.locator('#maskStatus').inner_text())
        self.assertEqual(self.errors, [])

    def test_scanned_page_candidate(self):
        stream = io.BytesIO()
        c = canvas.Canvas(stream, pagesize=(600,600))
        image = Image.new('RGB', (200,200), (70,150,90))
        c.drawImage(ImageReader(image), 100,100,400,400)
        c.save()
        p = self.page
        p.locator('#pdfFile').set_input_files({'name':'escaneado.pdf','mimeType':'application/pdf','buffer':stream.getvalue()})
        p.locator('#btnScan').click()
        p.wait_for_function('window.ARECExtractorDebug.getState().candidates===1 && !document.querySelector("#btnScan").disabled')
        self.assertIn('Posible mapa escaneado', p.locator('.candidate').inner_text())
        self.assertEqual(self.errors, [])

    def test_bulk_export_and_open_mask_rejection(self):
        p = self.page
        p.locator('#modeMask').click()
        self.point(.1,.1)
        p.locator('#btnVisual').click()
        self.assertIn('Cierra el contorno', p.locator('#status').inner_text())
        p.locator('#clearMask').click()
        p.locator('#municipio').select_option('QRO')
        archive = self.download('#btnAll')
        self.assertEqual(len(archive.namelist()), 2)
        for name in archive.namelist():
            inner = zipfile.ZipFile(io.BytesIO(archive.read(name)))
            root = ET.fromstring(inner.read('doc.kml'))
            self.assertAlmostEqual(float(root.find('.//k:west', NS).text), -100.62)
            self.assertIn('NO CALIBRADA', ''.join(root.itertext()))
        self.assertEqual(self.errors, [])

    def test_control_point_quad_and_degenerate_rejection(self):
        p = self.page
        p.locator('#modeControl').click()
        for x,y in [(.2,.2),(.8,.2),(.2,.8)]: self.point(x,y)
        for i,(lon,lat) in enumerate([(-99.8,19.5),(-99.5,19.48),(-99.78,19.2)],1):
            p.get_by_label(f'P{i} Longitud', exact=True).fill(str(lon))
            p.get_by_label(f'P{i} Latitud', exact=True).fill(str(lat))
        archive = self.download('#btnCalibrated')
        root = ET.fromstring(archive.read('doc.kml'))
        coords = root.find('.//gx:LatLonQuad/k:coordinates', NS).text.split()
        self.assertEqual(len(coords), 4)
        sw = [float(v) for v in coords[0].split(',')]
        self.assertAlmostEqual(sw[0], -99.873333, delta=.002)
        self.assertAlmostEqual(sw[1], 19.106667, delta=.002)
        self.assertIsNone(root.find('.//k:LatLonBox', NS))
        self.assertIn('tres puntos', ''.join(root.itertext()))
        self.assertNotIn('NO CALIBRADA', ''.join(root.itertext()))
        p.get_by_label('P3 Longitud', exact=True).fill('-99.8')
        p.get_by_label('P3 Latitud', exact=True).fill('19.5')
        p.locator('#btnCalibrated').click()
        self.assertIn('colapsan', p.locator('#status').inner_text())
        self.assertEqual(self.errors, [])


if __name__ == '__main__':
    unittest.main()
