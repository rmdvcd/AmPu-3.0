"""Identidad de AmPu 2.0 en la marca, favicons y empaquetado del ejecutable."""

from __future__ import annotations

import base64
import contextlib
import hashlib
import io
import os
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch
import xml.etree.ElementTree as ET

from PIL import Image

import app
import build_exe
from scripts.generar_iconos import ORIGINAL, STATIC_DIR, TAMANOS_ICO, generar


class IconoTest(unittest.TestCase):
    def test_png_es_el_original_sin_modificaciones(self):
        self.assertEqual(
            hashlib.sha256(ORIGINAL.read_bytes()).hexdigest(),
            "8f9b98806e73b7d8318c75089dc7830c3848ce143cd2c16581a158e1b2d084c6",
        )
        with Image.open(ORIGINAL) as imagen:
            self.assertEqual(imagen.size, (1024, 745))
            self.assertEqual(imagen.mode, "RGBA")

    def test_svg_autocontenido_no_redibuja_ni_deforma_el_icono(self):
        raiz = ET.parse(STATIC_DIR / "favicon.svg").getroot()
        self.assertEqual(raiz.attrib["viewBox"], "0 0 1024 1024")
        imagen = raiz.find("{http://www.w3.org/2000/svg}image")
        self.assertIsNotNone(imagen)
        self.assertEqual(imagen.attrib["preserveAspectRatio"], "xMidYMid meet")
        self.assertEqual(imagen.attrib["width"], imagen.attrib["height"])
        self.assertEqual(
            base64.b64decode(imagen.attrib["href"].split(",", 1)[1], validate=True),
            ORIGINAL.read_bytes(),
        )

    def comprobar_ico(self, ruta):
        with Image.open(ruta) as imagen:
            self.assertEqual(imagen.ico.sizes(), {(n, n) for n in TAMANOS_ICO})
            for lado in TAMANOS_ICO:
                with self.subTest(lado=lado):
                    cuadro = imagen.ico.getimage((lado, lado)).convert("RGBA")
                    self.assertEqual(cuadro.size, (lado, lado))
                    self.assertEqual(cuadro.getpixel((0, 0))[3], 0, "margen transparente")
                    # Lanczos deja halos de alfa 1–3 al reducir: medir el
                    # contenido visible, no esos píxeles casi transparentes.
                    mascara = cuadro.getchannel("A").point(lambda alfa: 255 if alfa >= 16 else 0)
                    x0, y0, x1, y1 = mascara.getbbox()
                    self.assertGreater(x1 - x0, lado * 0.85)
                    self.assertGreater(y1 - y0, lado * 0.6)
                    self.assertLess(y1 - y0, lado * 0.9, "no se estira el original rectangular")

    def test_ico_contiene_los_tamanos_de_windows_con_transparencia(self):
        self.comprobar_ico(STATIC_DIR / "favicon.ico")

    def test_derivados_se_regeneran_localmente(self):
        with tempfile.TemporaryDirectory() as temporal:
            destino = Path(temporal)
            generar(destino)
            self.assertEqual((destino / "favicon.svg").read_bytes(), (STATIC_DIR / "favicon.svg").read_bytes())
            self.comprobar_ico(destino / "favicon.ico")

    def test_marca_y_favicons_se_sirven_sin_recursos_externos(self):
        with app.app.test_client() as cliente:
            html = cliente.get("/", headers={"Host": "127.0.0.1:5000"}).get_data(as_text=True)
            self.assertIn('src="/static/img/icono_ampu.png"', html)
            self.assertIn('href="/favicon.svg"', html)
            self.assertIn('href="/favicon.ico"', html)
            for url, nombre, tipos in (
                ("/static/img/icono_ampu.png", "img/icono_ampu.png", ("image/png",)),
                ("/favicon.svg", "favicon.svg", ("image/svg+xml",)),
                ("/favicon.ico", "favicon.ico", ("image/vnd.microsoft.icon", "image/x-icon")),
            ):
                with self.subTest(url=url), cliente.get(url, headers={"Host": "127.0.0.1:5000"}) as respuesta:
                    self.assertEqual(respuesta.status_code, 200)
                    self.assertIn(respuesta.mimetype, tipos)
                    self.assertEqual(respuesta.get_data(), (STATIC_DIR / nombre).read_bytes())
                    self.assertEqual(respuesta.headers["X-Content-Type-Options"], "nosniff")

    def test_pyinstaller_recibe_el_mismo_icono_incluido_en_el_paquete(self):
        # No compila ni requiere PyInstaller: comprueba el comando real y los
        # recursos copiados al directorio de compilación, no una lista duplicada.
        with tempfile.TemporaryDirectory() as temporal:
            raiz = Path(temporal)
            with patch.object(build_exe, "BUILD_DIR", raiz / "build"), patch.object(build_exe, "OUTPUT_DIR", raiz / "salida"):
                preparado = build_exe.preparar_entorno()
                icono = preparado / "frontend" / "static" / "favicon.ico"
                self.assertEqual(icono.read_bytes(), (STATIC_DIR / "favicon.ico").read_bytes())
                self.assertEqual((preparado / "frontend" / "static" / "img" / "icono_ampu.png").read_bytes(), ORIGINAL.read_bytes())

                def pyinstaller_simulado(cmd, *, cwd, env):
                    self.assertEqual(Path(cmd[cmd.index("--icon") + 1]), icono)
                    self.assertEqual(cwd, preparado)
                    self.assertIn("--onefile", cmd)
                    nombre = build_exe.APP_NAME + (".exe" if os.name == "nt" else "")
                    generado = preparado / "dist" / nombre
                    generado.parent.mkdir()
                    generado.write_bytes(b"ejecutable simulado para probar el comando")
                    return types.SimpleNamespace(returncode=0)

                with patch.object(build_exe.subprocess, "run", side_effect=pyinstaller_simulado) as ejecutar, contextlib.redirect_stdout(io.StringIO()):
                    salida = build_exe.construir(preparado)
                ejecutar.assert_called_once()
                self.assertTrue(salida.is_file())


if __name__ == "__main__":
    unittest.main()
