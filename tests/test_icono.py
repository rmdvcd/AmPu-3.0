"""La identidad simplificada comparte geometría en web, bandeja y ejecutable."""

from __future__ import annotations

import contextlib
import io
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET

from PIL import Image

import app
import build_exe
import escritorio
from scripts.generar_iconos import BASE_DIR, FONDO, STATIC_DIR, SVG, TAMANOS_ICO, generar, rasterizar


class IconoTest(unittest.TestCase):
    def test_simbolo_vectorial_simple_sin_texto_pequeno_ni_imagen_raster_incrustada(self):
        raiz = ET.fromstring(SVG)
        ns = {"s": "http://www.w3.org/2000/svg"}
        self.assertEqual(raiz.attrib["viewBox"], "0 0 64 64")
        self.assertEqual(raiz.find("s:title", ns).text, "AmPu")
        self.assertEqual(raiz.find("s:rect", ns).attrib["fill"], FONDO)
        self.assertEqual(len(raiz.findall("s:path", ns)), 1)
        for etiqueta in ("text", "image", "script", "filter"):
            self.assertIsNone(raiz.find(f"s:{etiqueta}", ns))
        self.assertEqual((STATIC_DIR / "favicon.svg").read_text(), SVG)
        self.assertEqual((STATIC_DIR / "img/icono_ampu.svg").read_text(), SVG)
        self.assertEqual((BASE_DIR / "engine/ampu/docs/render/icono_ampu.svg").read_text(), SVG)

    def test_png_cuadrado_y_transparente_es_el_recurso_de_la_bandeja(self):
        self.assertEqual(escritorio.ruta_icono(), STATIC_DIR / "img/icono_ampu.png")
        with Image.open(escritorio.ruta_icono()) as imagen:
            self.assertEqual(imagen.mode, "RGBA")
            self.assertEqual(imagen.size, (256, 256))
            self.assertEqual(imagen.getpixel((0, 0))[3], 0)
            self.assertEqual(imagen.tobytes(), rasterizar(256).tobytes())

    def comprobar_ico(self, ruta):
        with Image.open(ruta) as imagen:
            self.assertEqual(imagen.ico.sizes(), {(n, n) for n in TAMANOS_ICO})
            for lado in TAMANOS_ICO:
                with self.subTest(lado=lado):
                    cuadro = imagen.ico.getimage((lado, lado)).convert("RGBA")
                    # Lanczos puede dejar alfa 1–3 en las esquinas al reducir.
                    self.assertLessEqual(cuadro.getpixel((0, 0))[3], 3)
                    mascara = cuadro.getchannel("A").point(lambda alfa: 255 if alfa >= 16 else 0)
                    x0, y0, x1, y1 = mascara.getbbox()
                    self.assertGreater(x1 - x0, lado * 0.85)
                    self.assertAlmostEqual(x1 - x0, y1 - y0, delta=1)
                    # Una curva blanca identificable incluso en 16 px, sin letras diminutas.
                    blancos = [(x, y) for y in range(lado) for x in range(lado)
                               if min(cuadro.getpixel((x, y))[:3]) > 190 and cuadro.getpixel((x, y))[3] > 200]
                    self.assertGreater(len(blancos), lado * lado * 0.035)
                    self.assertLess(len(blancos), lado * lado * 0.30)
                    self.assertEqual(cuadro.tobytes(), rasterizar(lado).tobytes())

    def test_ico_contiene_todos_los_tamanos_de_windows(self):
        self.comprobar_ico(STATIC_DIR / "favicon.ico")

    def test_regeneracion_determinista_sin_red(self):
        with tempfile.TemporaryDirectory() as temporal:
            destino = Path(temporal)
            generar(destino)
            for nombre in ("favicon.svg", "favicon.ico", "img/icono_ampu.png", "img/icono_ampu.svg"):
                with self.subTest(nombre=nombre):
                    self.assertEqual((destino / nombre).read_bytes(), (STATIC_DIR / nombre).read_bytes())

    def test_sidebar_y_favicons_sirven_la_misma_identidad_sin_red(self):
        with app.app.test_client() as cliente:
            html = cliente.get("/", headers={"Host": "127.0.0.1:5000"}).get_data(as_text=True)
            self.assertIn('src="/static/img/icono_ampu.svg?v=4"', html)
            self.assertIn('href="/favicon.svg?v=4"', html)
            self.assertIn('href="/favicon.ico?v=4"', html)
            self.assertIn('name="application-name" content="AmPu"', html)
            for url, nombre, tipos in (
                ("/static/img/icono_ampu.svg?v=4", "img/icono_ampu.svg", ("image/svg+xml",)),
                ("/static/img/icono_ampu.png", "img/icono_ampu.png", ("image/png",)),
                ("/favicon.svg?v=4", "favicon.svg", ("image/svg+xml",)),
                ("/favicon.ico?v=4", "favicon.ico", ("image/vnd.microsoft.icon", "image/x-icon")),
            ):
                with self.subTest(url=url), cliente.get(url, headers={"Host": "127.0.0.1:5000"}) as respuesta:
                    self.assertEqual(respuesta.status_code, 200)
                    self.assertIn(respuesta.mimetype, tipos)
                    self.assertEqual(respuesta.get_data(), (STATIC_DIR / nombre).read_bytes())
                    self.assertEqual(respuesta.headers["X-Content-Type-Options"], "nosniff")

    def test_empaquetado_incluye_modulo_bandeja_y_usa_el_ico(self):
        # Comprueba recursos y comandos reales; no simula una compilación nativa de Windows.
        with tempfile.TemporaryDirectory() as temporal:
            raiz = Path(temporal)
            with patch.object(build_exe, "BUILD_DIR", raiz / "build"), patch.object(build_exe, "OUTPUT_DIR", raiz / "salida"):
                preparado = build_exe.preparar_entorno()
                self.assertEqual((preparado / "escritorio.py").read_bytes(), (BASE_DIR / "escritorio.py").read_bytes())
                for nombre in ("favicon.ico", "img/icono_ampu.png", "img/icono_ampu.svg"):
                    self.assertEqual((preparado / "frontend/static" / nombre).read_bytes(), (STATIC_DIR / nombre).read_bytes())
                for plataforma in ("linux", "win32"):
                    with self.subTest(plataforma=plataforma), patch.object(build_exe.sys, "platform", plataforma):
                        def ejecutar(cmd, *, cwd, env):
                            self.assertEqual(Path(cmd[cmd.index("--icon") + 1]), preparado / "frontend/static/favicon.ico")
                            self.assertEqual(cwd, preparado)
                            self.assertIn("--onefile", cmd)
                            self.assertEqual("--windowed" in cmd, plataforma == "win32")
                            self.assertEqual("pystray._win32" in cmd, plataforma == "win32")
                            self.assertEqual("PIL.IcoImagePlugin" in cmd, plataforma == "win32")
                            generado = preparado / "dist" / (build_exe.APP_NAME + (".exe" if plataforma == "win32" else ""))
                            generado.parent.mkdir(exist_ok=True)
                            generado.write_bytes(b"comprobacion del comando, no es un ejecutable")
                            return types.SimpleNamespace(returncode=0)

                        with patch.object(build_exe.subprocess, "run", side_effect=ejecutar) as llamada, contextlib.redirect_stdout(io.StringIO()):
                            salida = build_exe.construir(preparado)
                        llamada.assert_called_once()
                        self.assertTrue(salida.is_file())


if __name__ == "__main__":
    unittest.main()
