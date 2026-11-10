"""Pruebas de integración de la API de AmPu 3.2.

Se ejecutan con el propio intérprete de Python, sin dependencias de test
adicionales:

    PYTHONPATH=vendor python3 -m unittest discover -s tests -v

Comprueban contratos de la API y valores de referencia del motor; no sustituyen
a la validación visual del navegador.
"""

from __future__ import annotations

import math
import unittest

import app


class ApiAmPuTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.app.config.update(TESTING=True)
        cls.cliente = app.app.test_client()

    def post(self, ruta, datos):
        respuesta = self.cliente.post(ruta, json=datos)
        self.assertEqual(respuesta.status_code, 200, respuesta.get_data(as_text=True))
        return respuesta.get_json()

    def test_salud_y_catalogo(self):
        salud = self.cliente.get("/api/salud").get_json()
        self.assertEqual(salud["estado"], "ok")
        self.assertGreaterEqual(salud["distribuciones"], 26)
        self.assertGreaterEqual(salud["lecciones"], 57)
        meta = self.cliente.get("/api/meta").get_json()
        self.assertEqual(len(meta["pruebas"]), 13)
        self.assertTrue(any(d["clave"] == "normal" for d in meta["distribuciones"]))

    def test_distribucion_normal(self):
        datos = self.post(
            "/api/distribucion/calcular",
            {"clave": "normal", "parametros": {"mu": 0, "sigma": 1}, "x": 0, "q": 0.975, "puntos": 101},
        )
        self.assertAlmostEqual(datos["resumen"]["densidad"]["valor"], 1 / math.sqrt(2 * math.pi), places=6)
        self.assertAlmostEqual(datos["resumen"]["acumulada"]["valor"], 0.5, places=6)
        self.assertAlmostEqual(datos["resumen"]["cuantil"]["valor"], 1.959963984540054, places=5)

    def test_combinatoria_exacta(self):
        datos = self.post("/api/probabilidad/combinatoria", {"tipo": "combinaciones", "n": 49, "k": 6})
        self.assertEqual(datos["resultado"], "13983816")

    def test_descriptiva(self):
        datos = self.post("/api/descriptiva", {"datos": [1, 2, 3, 4, 100]})
        self.assertEqual(datos["n"], 5)
        self.assertAlmostEqual(datos["resumen"]["media"], 22.0)
        self.assertAlmostEqual(datos["resumen"]["mediana"], 3.0)
        self.assertEqual(datos["atipicos"], [100.0])

    def test_bayes_normaliza_posteriores(self):
        datos = self.post(
            "/api/probabilidad/bayes",
            {"hipotesis": [
                {"nombre": "A", "prior": 0.01, "likelihood": 0.95},
                {"nombre": "B", "prior": 0.99, "likelihood": 0.05},
            ]},
        )
        total = sum(fila["posterior"] for fila in datos["filas"])
        self.assertAlmostEqual(total, 1.0, places=10)
        self.assertAlmostEqual(datos["filas"][0]["posterior"], 0.161016949153, places=9)
        self.assertAlmostEqual(datos["filas"][1]["posterior"], 0.838983050847, places=9)

    def test_regresion_simple_y_prediccion(self):
        datos = self.post(
            "/api/regresion",
            {"x": [[1], [2], [3], [4]], "y": [3, 5, 7, 9], "predecir": [[5]]},
        )
        self.assertAlmostEqual(datos["coeficientes"][1]["estimacion"], 2.0, places=8)
        self.assertAlmostEqual(datos["coeficientes"][0]["estimacion"], 1.0, places=8)
        self.assertAlmostEqual(datos["bondad"]["r2"], 1.0, places=10)
        self.assertAlmostEqual(datos["predicciones"][0]["prediccion"], 11.0, places=8)

    def test_regresion_multiple(self):
        datos = self.post(
            "/api/regresion",
            {
                "x": [[1, 2], [2, 1], [3, 4], [4, 3], [5, 5], [6, 4], [7, 6], [8, 7], [9, 8], [10, 9]],
                "y": [4, 5, 8, 9, 12, 13, 16, 17, 20, 21],
                "nombres": ["x1", "x2"],
                "predecir": [[11, 10]],
            },
        )
        self.assertEqual(datos["predictores"], 2)
        self.assertEqual(datos["n"], 10)
        self.assertEqual(len(datos["predicciones"]), 1)

    def test_tamano_muestral(self):
        infinito = self.post("/api/muestreo/tamano", {"tipo": "proporcion", "confianza": 0.95, "error": 0.05, "p": 0.5})
        finito = self.post("/api/muestreo/tamano", {"tipo": "proporcion", "confianza": 0.95, "error": 0.05, "p": 0.5, "N": 1000})
        self.assertEqual(infinito["n"], 385)
        self.assertEqual(finito["n"], 278)

    def test_disenos_muestreo(self):
        estratos = [
            {"nombre": "A", "N": 400, "sigma": 12, "costo": 1},
            {"nombre": "B", "N": 600, "sigma": 18, "costo": 1.2},
        ]
        for metodo, n in [
            ("finito", 100), ("infinito", 100), ("sistematico", 100),
            ("proporcional", 100), ("neyman", 100), ("optimo", 100), ("conglomerados", 2),
        ]:
            datos = self.post(
                "/api/muestreo",
                {"metodo": metodo, "N": 1000, "n": n, "semilla": 42, "auto": False, "p": 0.5,
                 "error": 0.05, "confianza": 0.95, "estratos": estratos, "n_por_grupo": None},
            )
            self.assertEqual(datos["metodo"], metodo)
            self.assertIn("resumen", datos)

    def test_simulacion_montecarlo(self):
        pi = self.post("/api/simulacion", {"tipo": "pi", "n": 20000, "semilla": 7})
        self.assertLess(abs(pi["estimacion"]["valor"] - math.pi), 0.08)
        integral = self.post("/api/simulacion", {"tipo": "integral", "funcion": "seno", "n": 10000, "semilla": 7})
        self.assertLess(abs(integral["estimacion"]["valor"] - 2.0), 0.15)

    def test_validacion_condicional(self):
        respuesta = self.cliente.post(
            "/api/probabilidad/condicional",
            json={"interseccion": 0.8, "condicion": 0.5},
        )
        self.assertEqual(respuesta.status_code, 400)
        self.assertIn("no puede superar", respuesta.get_json()["error"])


if __name__ == "__main__":
    unittest.main()
