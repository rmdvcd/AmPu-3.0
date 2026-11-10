"""El analizador de entrada del motor frente a los vectores compartidos con el navegador.

Los mismos casos los ejecuta ``tests/test_entrada.mjs`` contra
``frontend/static/js/entrada.js``: si uno de los dos lectores cambia, falla aquí o allí.

    PYTHONPATH=vendor python3 -m unittest discover -s tests -v
"""

from __future__ import annotations

import json
import math
import unittest
from fractions import Fraction
from pathlib import Path

import app  # noqa: F401  (configura sys.path para el motor)
from ampu.core import entrada
from ampu.core.errores import ErrorAmPu

VECTORES = json.loads((Path(__file__).parent / "vectores_entrada.json").read_text(encoding="utf-8"))


class VectoresCompartidosTest(unittest.TestCase):
    def test_series(self):
        for caso in VECTORES["series"]:
            with self.subTest(entrada=caso["entrada"]):
                fraccion = bool(caso.get("fraccion"))
                if "error" in caso:
                    with self.assertRaises(ErrorAmPu) as contexto:
                        entrada.leer_serie(caso["entrada"], "datos", fraccion=fraccion)
                    error = contexto.exception
                    self.assertEqual(error.tipo, caso["error"])
                    if "posicion" in caso:
                        self.assertEqual(error.posicion, caso["posicion"])
                    self.assertTrue(str(error))
                    continue
                lectura = entrada.leer_serie(caso["entrada"], "datos", fraccion=fraccion)
                self.assertEqual(len(lectura.valores), len(caso["valores"]))
                for leido, esperado in zip(lectura.valores, caso["valores"]):
                    self.assertTrue(math.isclose(float(leido), esperado, rel_tol=1e-12, abs_tol=1e-12))
                self.assertEqual(len(lectura.avisos), caso.get("avisos", 0), lectura.avisos)

    def test_listas_json_no_se_reinterpretan(self):
        lectura = entrada.leer_serie([1, 2.5, "3,5"], "datos")
        self.assertEqual([float(v) for v in lectura.valores], [1.0, 2.5, 3.5])
        for malo in ([1, None], [1, True], [1, float("nan")], [1, float("inf")], [1, "abc"]):
            with self.subTest(valor=malo), self.assertRaises(ErrorAmPu):
                entrada.leer_serie(malo, "datos")

    def test_numero_unico(self):
        self.assertEqual(entrada.leer_numero("0,05", "alfa"), 0.05)
        self.assertEqual(entrada.leer_numero("0.05", "alfa"), 0.05)
        self.assertEqual(entrada.leer_numero("−2,5", "x"), -2.5)
        for malo in ("1 2", "1,2,3", "1/4", "nan", "inf", "0x1F", "50%", "", None, True):
            with self.subTest(valor=malo), self.assertRaises(ErrorAmPu):
                entrada.leer_numero(malo, "x")

    def test_fracciones_y_decimales_exactos(self):
        self.assertEqual(entrada.leer_numero("1/4", "p", fraccion=True), Fraction(1, 4))
        # Un decimal corto escrito como texto es un racional exacto, no un binario aproximado.
        self.assertEqual(entrada.leer_numero("0,1", "p", fraccion=True), Fraction(1, 10))
        self.assertEqual(entrada.leer_numero("0.95", "p", fraccion=True), Fraction(19, 20))
        suma = sum(entrada.leer_serie("0,1 0,2 0,7", "p", fraccion=True).valores)
        self.assertEqual(suma, 1)
        with self.assertRaises(ErrorAmPu):
            entrada.leer_numero("1/0", "p", fraccion=True)

    def test_matriz(self):
        self.assertEqual(entrada.leer_matriz("1 2,5\n3 4", "tabla"), [[1.0, 2.5], [3.0, 4.0]])
        with self.assertRaises(ErrorAmPu):
            entrada.leer_matriz("1 2\n3", "tabla")

    def test_error_localiza_el_valor(self):
        with self.assertRaises(ErrorAmPu) as contexto:
            entrada.leer_serie("12,4 11,8 x13 12,9", "datos")
        error = contexto.exception
        self.assertEqual(error.campo, "datos")
        self.assertEqual(error.posicion, 3)
        self.assertIn("x13", str(error))


if __name__ == "__main__":
    unittest.main()
