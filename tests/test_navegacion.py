"""La barra lateral conserva la navegación, sin repetir el contenido de Ajustes."""

from __future__ import annotations

import re
import unittest

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
        # El cambio es solo del lateral, no elimina los accesos globales.
        for control in ("boton-ayuda", "pie-ayuda", "pie-preferencias"):
            self.assertIn(f'id="{control}"', html)


if __name__ == "__main__":
    unittest.main()
