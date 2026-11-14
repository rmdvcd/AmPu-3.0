"""La navegación global se conserva sin bloques redundantes ni pie de página."""

from __future__ import annotations

import re
import unittest
from pathlib import Path

import app


class NavegacionTest(unittest.TestCase):
    def test_barra_lateral_sin_bloque_inferior_duplicado(self):
        with app.app.test_client() as cliente:
            respuesta = cliente.get("/", headers={"Host": "127.0.0.1:5000"})
            self.assertEqual(respuesta.status_code, 200)
            html = respuesta.get_data(as_text=True)
        lateral = re.search(r'<aside\b[^>]*\bid="sidebar"[^>]*>(.*?)</aside>', html, re.S)
        self.assertIsNotNone(lateral, "se conserva la barra lateral")
        contenido = lateral.group(1)
        self.assertIn('id="nav-principal"', contenido)
        self.assertIn('class="marca"', contenido)
        for componente in ("sidebar__pie", "estado-motor", "abrir-preferencias", "abrir-ayuda", "sidebar__version"):
            with self.subTest(componente=componente):
                self.assertNotIn(componente, contenido)
        # La ayuda sigue disponible en la barra superior.
        self.assertIn('id="boton-ayuda"', html)

    def test_aplicacion_sin_footer_global(self):
        with app.app.test_client() as cliente:
            respuesta = cliente.get("/", headers={"Host": "127.0.0.1:5000"})
            self.assertEqual(respuesta.status_code, 200)
            html = respuesta.get_data(as_text=True)
        self.assertNotRegex(html, r"<footer\b")
        for componente in ("pie-ayuda", "pie-preferencias", "motor NumPy/SciPy local", "Los cálculos no salen de tu equipo"):
            with self.subTest(componente=componente):
                self.assertNotIn(componente, html)
        self.assertIn('id="contenido"', html)
        self.assertIn('id="boton-ayuda"', html)

    def test_un_solo_disparo_de_menu_y_en_el_lado_izquierdo(self):
        with app.app.test_client() as cliente:
            html = cliente.get("/", headers={"Host": "127.0.0.1:5000"}).get_data(as_text=True)
        izquierda = re.search(r'<div class="barra-superior__izq">(.*?)<div class="barra-superior__centro">', html, re.S)
        self.assertIsNotNone(izquierda)
        self.assertIn('id="alternar-sidebar"', izquierda.group(1))
        self.assertEqual(html.count('id="alternar-sidebar"'), 1)
        self.assertEqual(html.count('id="cerrar-sidebar"'), 1)
        self.assertIn('aria-controls="sidebar"', izquierda.group(1))

    def test_destinos_de_teoria_existen_en_el_catalogo(self):
        with app.app.test_client() as cliente:
            meta = cliente.get("/api/meta", headers={"Host": "127.0.0.1:5000"}).get_json()
        claves = {leccion["clave"] for leccion in meta["teoria"]}
        base = Path(__file__).resolve().parents[1] / "frontend" / "static" / "js"
        destinos = set()
        for archivo in base.rglob("*.js"):
            texto = archivo.read_text(encoding="utf-8")
            # /api/teoria/lista es una API, no un enlace de navegación.
            for destino in re.findall(r"(?<!api/)\bteoria/([a-z_]+)", texto):
                with self.subTest(archivo=archivo.name, destino=destino):
                    self.assertIn(destino, claves)
                destinos.add(destino)
        mapa = re.search(r"export const LECCIONES_MUESTREO = \{(.*?)\};", (base / "data.js").read_text(encoding="utf-8"), re.S)
        self.assertIsNotNone(mapa)
        lecciones_muestreo = re.findall(r': "([a-z_]+)"', mapa.group(1))
        self.assertEqual(len(lecciones_muestreo), len(meta["muestreo"]))
        self.assertTrue(set(lecciones_muestreo).issubset(claves))
        self.assertIn("regresion", destinos)

    def test_catalogos_conservan_el_papel_nativo_de_los_botones(self):
        base = Path(__file__).resolve().parents[1] / "frontend" / "static" / "js" / "views"
        for vista in ("distribuciones", "inferencia", "teoria"):
            with self.subTest(vista=vista):
                texto = (base / f"{vista}.js").read_text(encoding="utf-8")
                self.assertNotIn('role: "listitem"', texto)
                self.assertRegex(texto, r'class: "lista-modelos", role: "group", "aria-label": "[^"]+"')


if __name__ == "__main__":
    unittest.main()
