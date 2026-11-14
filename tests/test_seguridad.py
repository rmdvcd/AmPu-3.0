"""Cabeceras, validación de anfitrión y de origen (S1 y S2 de la auditoría)."""

from __future__ import annotations

import unittest

import app

ANFITRION = {"Host": "127.0.0.1:5000"}


class SeguridadTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.app.config.update(TESTING=True)
        cls.cliente = app.app.test_client()

    def test_cabeceras(self):
        r = self.cliente.get("/", headers=ANFITRION)
        self.assertEqual(r.status_code, 200)
        csp = r.headers["Content-Security-Policy"]
        self.assertIn("default-src 'self'", csp)
        self.assertIn("script-src 'self'", csp)
        self.assertNotIn("'unsafe-eval'", csp)
        self.assertNotIn("script-src 'self' 'unsafe-inline'", csp)
        self.assertEqual(r.headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(r.headers["X-Frame-Options"], "DENY")
        self.assertEqual(r.headers["Referrer-Policy"], "no-referrer")

    def test_api_sin_cache_y_con_duracion(self):
        r = self.cliente.get("/api/salud", headers=ANFITRION)
        self.assertIn("no-store", r.headers["Cache-Control"])
        self.assertIn("X-AmPu-Duracion-ms", r.headers)

    def test_anfitrion_desconocido(self):
        # Protección frente a «DNS rebinding»: una web externa no puede hablar con el motor local.
        r = self.cliente.get("/api/meta", headers={"Host": "evil.example"})
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.get_json()["tipo"], "seguridad")

    def test_origen_ajeno(self):
        r = self.cliente.post("/api/descriptiva", json={"datos": [1, 2, 3]},
                              headers={**ANFITRION, "Origin": "http://evil.example"})
        self.assertEqual(r.status_code, 403)
        r = self.cliente.post("/api/descriptiva", json={"datos": [1, 2, 3]},
                              headers={**ANFITRION, "Origin": "http://127.0.0.1:5000"})
        self.assertEqual(r.status_code, 200)

    def test_el_html_no_lleva_scripts_en_linea(self):
        html = self.cliente.get("/", headers=ANFITRION).get_data(as_text=True)
        import re
        for etiqueta in re.findall(r"<script\b[^>]*>(.*?)</script>", html, flags=re.S):
            self.assertEqual(etiqueta.strip(), "", "script en línea incompatible con la CSP")
        self.assertNotRegex(html, r"\son\w+\s*=\s*[\"']")
        self.assertNotRegex(html, r"https?://(?!127\.0\.0\.1|localhost)[\w.-]+/[^\"']*\.(js|css)")

    def test_el_motor_no_evalua_expresiones(self):
        # AmPu es un laboratorio de formularios: ninguna ruta interpreta texto como código o fórmula.
        import re
        from pathlib import Path
        raiz = Path(app.__file__).resolve().parent
        fuentes = [*(raiz / nombre for nombre in ("app.py", "main.py", "AmPu.pyw", "arranque.py", "escritorio.py", "lanzador.py")),
                   *sorted((raiz / "engine").rglob("*.py"))]
        self.assertGreater(len(fuentes), 20)
        for ruta in fuentes:
            codigo = ruta.read_text(encoding="utf-8")
            for patron in (r"(?<![\w.])eval\(", r"(?<![\w.])exec\(", r"\bast\.parse\(", r"\bsympify\(", r"\bparse_expr\("):
                self.assertIsNone(re.search(patron, codigo), f"{ruta.name}: {patron}")

    def test_exportacion_neutraliza_formulas(self):
        r = self.cliente.post("/api/exportar", json={
            "formato": "csv", "titulo": "Prueba",
            "tablas": [{"nombre": "t", "columnas": ["a"], "filas": [["=CMD|' /C calc'!A0"], ["+1+1"], ["@SUM(1)"]]}],
        }, headers=ANFITRION)
        self.assertEqual(r.status_code, 200, r.get_data(as_text=True)[:300])
        texto = r.get_data(as_text=True)
        for linea in texto.splitlines():
            self.assertFalse(linea.lstrip('"').startswith(("=", "+", "@")), linea)


if __name__ == "__main__":
    unittest.main()
