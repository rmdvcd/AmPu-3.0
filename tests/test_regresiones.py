"""Pruebas de regresión de los hallazgos de ``AUDITORIA_AMPU.md``.

Cada prueba lleva el identificador del hallazgo (E1, E2, …) y reproduce el caso que
fallaba antes de la corrección, con el valor de referencia y su origen.

    PYTHONPATH=vendor python3 -m unittest discover -s tests -v
"""

from __future__ import annotations

import math
import unittest

import app

ANFITRION = {"Host": "127.0.0.1:5000"}


class Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.app.config.update(TESTING=True)
        cls.cliente = app.app.test_client()

    def post(self, ruta, datos, estado=200):
        respuesta = self.cliente.post(ruta, json=datos, headers=ANFITRION)
        self.assertEqual(respuesta.status_code, estado, respuesta.get_data(as_text=True))
        return respuesta.get_json()

    def error(self, ruta, datos, *, campo=None, tipo=None, estado=400):
        cuerpo = self.post(ruta, datos, estado=estado)
        self.assertIn("error", cuerpo)
        self.assertTrue(cuerpo["error"])
        if campo is not None:
            self.assertEqual(cuerpo["campo"], campo, cuerpo)
        if tipo is not None:
            self.assertEqual(cuerpo["tipo"], tipo, cuerpo)
        return cuerpo

    def cerca(self, valor, referencia, rel=1e-9):
        self.assertTrue(math.isclose(valor, referencia, rel_tol=rel, abs_tol=0.0),
                        f"{valor!r} ≠ {referencia!r} (tolerancia relativa {rel})")


class PrecisionTest(Base):
    """E1 y E18: las colas no se redondean a cero."""

    def test_e1_cola_normal_extrema(self):
        r = self.post("/api/distribucion/calcular",
                      {"clave": "normal", "parametros": {"mu": 0, "sigma": 1}, "x": 8})
        # Referencia: erfc(8/√2)/2 = 6,220960574271785e-16
        self.cerca(r["resumen"]["cola"]["valor"], 0.5 * math.erfc(8 / math.sqrt(2)), rel=1e-10)

    def test_e1_p_valor_diminuto_no_es_cero(self):
        a = [10.0, 10.1, 9.9, 10.05, 9.95, 10.02, 9.98, 10.01] * 4
        b = [v + 5 for v in a]
        r = self.post("/api/inferencia", {"prueba": "t_dos", "datos": a, "datos2": b})
        self.assertGreater(r["p_valor"], 0.0)
        self.assertLess(r["p_valor"], 1e-50)
        self.assertNotIn(r["p_texto"], ("0", "0,0", "0.0"))

    def test_e18_intervalo_en_la_cola_derecha(self):
        r = self.post("/api/distribucion/calcular",
                      {"clave": "normal", "parametros": {"mu": 0, "sigma": 1}, "x": 0,
                       "intervalo": {"a": 8, "b": 9}})
        referencia = 0.5 * math.erfc(8 / math.sqrt(2)) - 0.5 * math.erfc(9 / math.sqrt(2))
        self.cerca(r["intervalo"]["probabilidad"], referencia, rel=1e-9)

    def test_e15_parametro_desconocido_no_se_sustituye(self):
        self.error("/api/distribucion/calcular", {"clave": "poisson", "parametros": {"lam": 3}, "x": 2},
                   campo="lam", tipo="dominio")


class InferenciaTest(Base):
    A = [12, 13, 11, 14, 12, 13]
    B = [15, 16, 14, 15, 17, 16]

    def test_e2_curva_nula_coherente_con_la_prueba(self):
        r = self.post("/api/inferencia", {"prueba": "mann_whitney", "datos": self.A, "datos2": self.B})
        if r["exacta"]:
            self.assertIsNone(r["curva"])        # sin curva continua para una prueba exacta
        else:
            self.assertEqual(r["curva"]["familia"], "normal")
        r = self.post("/api/inferencia", {"prueba": "anova", "grupos": [[1, 2, 3], [2, 3, 4], [5, 6, 7]]})
        self.assertEqual(r["curva"]["familia"], "f")
        self.assertEqual(r["curva"]["parametros"], {"gl1": 2, "gl2": 6})
        r = self.post("/api/inferencia", {"prueba": "chi_bondad", "observadas": [18, 22, 20, 25, 15],
                                          "esperadas": [20, 20, 20, 20, 20]})
        self.assertEqual(r["curva"]["familia"], "chi2")
        self.assertIsNone(r["curva"]["critico_bajo"])   # χ² solo rechaza en la cola derecha

    def test_e3_la_alternativa_se_aplica(self):
        p = {alt: self.post("/api/inferencia", {"prueba": "mann_whitney", "datos": self.A,
                                                "datos2": self.B, "alternativa": alt})["p_valor"]
             for alt in ("two-sided", "less", "greater")}
        self.assertLess(p["less"], p["two-sided"])
        self.assertGreater(p["greater"], 0.9)
        self.assertNotEqual(p["less"], p["greater"])

    def test_e3_pruebas_sin_direccion_rechazan_la_alternativa(self):
        self.error("/api/inferencia", {"prueba": "anova", "grupos": [[1, 2, 3], [2, 3, 4], [5, 6, 7]],
                                       "alternativa": "less"}, campo="alternativa", tipo="dominio")
        meta = self.cliente.get("/api/meta", headers=ANFITRION).get_json()
        sin = {p["clave"] for p in meta["pruebas"] if not p["admite_alternativa"]}
        self.assertEqual(sin, {"chi_indep", "chi_bondad", "anova", "kruskal"})

    def test_e4_hipotesis_e_intervalo_siguen_a_la_alternativa(self):
        r = self.post("/api/inferencia", {"prueba": "t_una", "datos": "12,4 11,8 13,1 12,9", "mu0": 12,
                                          "alternativa": "greater"})
        self.assertEqual(r["hipotesis"]["h1"], "μ > 12")
        self.assertEqual(r["intervalo"][1], "∞")           # intervalo unilateral, coherente con H₁
        self.assertEqual(r["intervalo_de"], "μ")

    def test_e6_coma_decimal(self):
        r = self.post("/api/inferencia", {"prueba": "t_una", "datos": "12,4 11,8 13,1 12,9", "mu0": 12})
        self.assertEqual(r["gl"], 3)                         # cuatro datos, no ocho
        e = self.error("/api/inferencia", {"prueba": "t_una", "datos": "12,4,11,8,13,1", "mu0": 12},
                       campo="datos", tipo="ambiguedad")
        self.assertEqual(e["posicion"], 1)
        self.assertTrue(e["sugerencia"])

    def test_e11_cambio_a_prueba_exacta_con_aviso(self):
        r = self.post("/api/inferencia", {"prueba": "prop_una", "exitos": 1, "n": 40, "p0": 0.02})
        self.assertTrue(r["exacta"])
        # Binomial exacta bilateral: P(X = 0) + P(X ≥ 1 con masa ≤ P(X = 1)) — SciPy binomtest da 0,5543
        self.cerca(r["p_valor"], 0.5543, rel=2e-3)
        self.assertTrue(any("exacta" in aviso for aviso in r["avisos"]))
        r = self.post("/api/inferencia", {"prueba": "chi_indep", "tabla": [[3, 1], [1, 3]]})
        self.assertTrue(r["exacta"])
        self.cerca(r["p_valor"], 34 / 70, rel=1e-9)          # Fisher: (1 + 16 + 16 + 1)/70
        self.assertTrue(any("Fisher" in aviso for aviso in r["avisos"]))

    def test_no_dice_que_se_acepta_h0(self):
        r = self.post("/api/inferencia", {"prueba": "t_una", "datos": [12.1, 11.9, 12.0, 12.2, 11.8], "mu0": 12})
        self.assertFalse(r["rechaza"])
        self.assertNotIn("acepta", r["conclusion"].lower())


class DescriptivaTest(Base):
    def test_e7_bigotes_en_el_dato_no_en_la_valla(self):
        r = self.post("/api/descriptiva", {"datos": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 50]})
        self.assertEqual(r["caja"]["bigote_sup"], 11)
        self.assertEqual(r["caja"]["valla_sup"], 17.5)
        self.assertEqual(r["n_atipicos"], 1)

    def test_e8_sin_moda_si_todos_son_distintos(self):
        r = self.post("/api/descriptiva", {"datos": [1, 2, 3, 4, 5, 6, 7]})
        self.assertEqual(r["resumen"]["modas"], [])
        r = self.post("/api/descriptiva", {"datos": [1, 2, 2, 3, 3, 4]})
        self.assertEqual(r["resumen"]["modas"], [2, 3])

    def test_e19_forma_indefinida_con_pocos_datos(self):
        r = self.post("/api/descriptiva", {"datos": [1, 2]})
        self.assertIsNone(r["resumen"]["sesgo"])
        self.assertIsNone(r["resumen"]["curtosis"])
        self.assertEqual(r["resumen"]["ic_nivel"], 0.95)

    def test_e16_magnitudes_que_desbordan(self):
        e = self.error("/api/descriptiva", {"datos": [1e308, 1e308, 1]}, campo="datos", tipo="fuera_de_alcance")
        self.assertNotIn("nan", e["error"].lower())
        self.assertTrue(e["sugerencia"])

    def test_e6_coma_decimal_y_ambiguedad(self):
        r = self.post("/api/descriptiva", {"datos": "1,5 2,5 3,5"})
        self.assertEqual(r["n"], 3)
        self.cerca(r["resumen"]["media"], 2.5)
        self.error("/api/descriptiva", {"datos": "1,2,3,4,5"}, campo="datos", tipo="ambiguedad")


class ProbabilidadTest(Base):
    def test_e9_una_sola_tolerancia_y_mensaje_claro(self):
        hipotesis = [{"nombre": n, "prior": 0.3333333, "likelihood": v}
                     for n, v in (("a", 0.5), ("b", 0.2), ("c", 0.1))]
        e = self.error("/api/probabilidad/bayes", {"hipotesis": hipotesis}, campo="hipotesis", tipo="dominio")
        self.assertNotIn("(suman 1)", e["error"])            # el mensaje enseña la suma real
        self.assertIn("1/3", e["sugerencia"])

    def test_e9_fracciones_exactas(self):
        hipotesis = [{"nombre": n, "prior": "1/3", "likelihood": v}
                     for n, v in (("a", "0,5"), ("b", "0,2"), ("c", "0,1"))]
        r = self.post("/api/probabilidad/bayes", {"hipotesis": hipotesis})
        self.assertTrue(r["exacto"])
        self.assertEqual(r["total_exacto"], "4/15")
        self.assertEqual([f["posterior_exacto"] for f in r["filas"]], ["5/8", "1/4", "1/8"])
        self.cerca(sum(f["posterior"] for f in r["filas"]), 1.0, rel=1e-12)

    def test_decimales_en_texto_son_exactos(self):
        # Prueba diagnóstica clásica: prevalencia 1 %, sensibilidad 95 %, falsos positivos 5 %.
        r = self.post("/api/probabilidad/bayes", {"hipotesis": [
            {"nombre": "enfermo", "prior": "0,01", "likelihood": "0,95"},
            {"nombre": "sano", "prior": "0,99", "likelihood": "0,05"}]})
        self.assertEqual(r["total_exacto"], "59/1000")
        self.assertEqual(r["filas"][0]["posterior_exacto"], "19/118")
        self.cerca(r["filas"][0]["posterior"], 19 / 118, rel=1e-12)

    def test_error_de_bayes_senala_la_celda(self):
        self.error("/api/probabilidad/bayes", {"hipotesis": [
            {"nombre": "a", "prior": "abc", "likelihood": "0,5"},
            {"nombre": "b", "prior": "0,5", "likelihood": "0,5"}]}, campo="hipotesis.0.prior", tipo="sintaxis")

    def test_variable_discreta_exacta(self):
        r = self.post("/api/probabilidad/variable",
                      {"valores": "1 2 3 4 5 6", "masas": "1/6 1/6 1/6 1/6 1/6 1/6", "t": "0,5"})
        self.assertEqual(r["esperanza_exacta"], "7/2")
        self.assertEqual(r["varianza_exacta"], "35/12")
        self.error("/api/probabilidad/variable", {"valores": "0 1 2", "masas": "0,3 0,3 0,3"},
                   campo="masas", tipo="dominio")

    def test_condicional_e_independencia_exacta(self):
        r = self.post("/api/probabilidad/condicional", {"interseccion": "1/6", "condicion": "1/2", "pa": "1/3"})
        self.assertEqual(r["resultado_exacto"], "1/3")
        self.assertTrue(r["independencia"]["independientes"])
        self.error("/api/probabilidad/condicional", {"interseccion": "0,6", "condicion": "0,5"}, tipo="dominio")

    def test_e10_combinatoria_acotada(self):
        r = self.post("/api/probabilidad/combinatoria", {"tipo": "factorial", "n": 2000})
        self.assertTrue(r["exacto"])
        self.assertEqual(r["digitos"], 5736)                 # ⌊log10(2000!)⌋ + 1
        self.assertEqual(len(r["resultado"]), 5736)
        r = self.post("/api/probabilidad/combinatoria", {"tipo": "combinaciones", "n": 2_000_000, "k": 1_000_000})
        self.assertFalse(r["exacto"])
        self.assertEqual(r["exponente"], 602056)
        self.cerca(r["mantisa"], 5.5303545121, rel=1e-9)     # vía lgamma: C(2n, n) ≈ 4ⁿ/√(πn)
        self.assertTrue(r["nota"])
        self.error("/api/probabilidad/combinatoria", {"tipo": "factorial", "n": "1e30"},
                   campo="n", tipo="fuera_de_alcance")
        self.error("/api/probabilidad/combinatoria", {"tipo": "factorial", "n": "2,5"}, campo="n")
        self.error("/api/probabilidad/combinatoria", {"tipo": "factorial", "n": -1}, campo="n")

    def test_combinatoria_valores_conocidos(self):
        for cuerpo, esperado in (
            ({"tipo": "combinaciones", "n": 49, "k": 6}, "13983816"),
            ({"tipo": "permutaciones", "n": 10, "k": 3}, "720"),
            ({"tipo": "factorial", "n": 0}, "1"),
            ({"tipo": "factorial", "n": 20}, "2432902008176640000"),
        ):
            with self.subTest(cuerpo=cuerpo):
                self.assertEqual(self.post("/api/probabilidad/combinatoria", cuerpo)["resultado"], esperado)


class SimulacionTest(Base):
    def test_e5_referencia_sigue_al_intervalo(self):
        r = self.post("/api/simulacion", {"tipo": "integral", "funcion": "cuadrado", "a": 0, "b": 2,
                                          "n": 20000, "semilla": 7})
        self.cerca(r["referencia"]["valor"], 8 / 3, rel=1e-12)
        self.assertEqual(r["intervalo_integracion"], [0.0, 2.0])
        self.cerca(r["error_absoluto"], abs(r["estimacion"]["valor"] - 8 / 3), rel=1e-9)
        self.assertLess(r["error_absoluto"], 5 * r["estimacion"]["error_estandar"])
        self.error("/api/simulacion", {"tipo": "integral", "funcion": "circulo", "a": 0, "b": 2, "n": 1000},
                   campo="b", tipo="dominio")

    def test_e14_intervalo_coherente_con_la_confianza(self):
        base = {"tipo": "pi", "n": 2000, "semilla": 3}
        r95 = self.post("/api/simulacion", {**base, "confianza": 0.95})
        r99 = self.post("/api/simulacion", {**base, "confianza": 0.99})
        self.assertEqual(r99["confianza"], 0.99)
        ancho = lambda r: r["estimacion"]["intervalo"][1] - r["estimacion"]["intervalo"][0]  # noqa: E731
        self.cerca(ancho(r99) / ancho(r95), 2.5758293035489 / 1.959963984540054, rel=1e-6)
        self.assertEqual(r95["estimacion"]["n"], 2000)

    def test_semilla_reproducible(self):
        cuerpo = {"tipo": "pi", "n": 1500, "semilla": 11}
        self.assertEqual(self.post("/api/simulacion", cuerpo)["estimacion"],
                         self.post("/api/simulacion", cuerpo)["estimacion"])

    def test_e12_ajuste_determinista(self):
        datos = [48, 49, 50, 47, 51, 48.5, 49.2]
        a = self.post("/api/simulacion", {"tipo": "ajuste", "clave": "normal", "datos": datos, "semilla": 1})
        b = self.post("/api/simulacion", {"tipo": "ajuste", "clave": "normal", "datos": datos, "semilla": 99})
        self.assertEqual(a["parametros"], b["parametros"])
        self.cerca(a["parametros"]["loc"], sum(datos) / len(datos), rel=1e-12)   # EMV cerrado: la media

    def test_e17_histograma_y_curva_en_el_mismo_eje(self):
        r = self.post("/api/simulacion", {"tipo": "muestra", "clave": "poisson", "parametros": {"tasa": 3},
                                          "n": 2000, "semilla": 5})
        self.assertTrue(r["discreta"])
        bordes = r["histograma"]["bordes"]
        self.assertEqual(bordes[1] - bordes[0], 1.0)          # una clase por entero
        self.assertEqual(bordes[0] % 1, 0.5)                  # centrada en el entero
        # Con clases de anchura 1 la altura es la frecuencia relativa: comparable con la masa.
        self.cerca(sum(r["histograma"]["densidad"]), 1.0, rel=1e-9)
        self.assertEqual(r["teorica"]["x"], r["histograma"]["centros"])


class RegresionTest(Base):
    def test_e13_diagnostico_de_colinealidad(self):
        x = [[i, i + d] for i, d in zip(range(1, 7), (1e-7, 2e-7, 1e-7, 3e-7, 1e-7, 2e-7))]
        respuesta = self.cliente.post("/api/regresion", json={"y": [1, 2, 3, 4, 5, 6], "x": x}, headers=ANFITRION)
        cuerpo = respuesta.get_json()
        if respuesta.status_code == 200:
            self.assertTrue(any("olinealidad" in aviso for aviso in cuerpo["avisos"]), cuerpo["avisos"])
            self.assertGreater(max(cuerpo["diagnostico"]["vif"]), 10)
        else:                                                # o se rechaza con un motivo claro
            self.assertEqual(respuesta.status_code, 400)
            self.assertEqual(cuerpo["campo"], "x")

    def test_e13_significacion_sigue_a_la_confianza(self):
        r = self.post("/api/regresion", {"y": [1, 2.1, 2.9, 4.2, 5.1, 5.8], "x": [1, 2, 3, 4, 5, 6],
                                         "confianza": 0.99})
        self.cerca(r["bondad"]["alfa"], 0.01, rel=1e-9)
        for coef in r["coeficientes"]:
            self.assertEqual(coef["significativo"], coef["p_valor"] < 0.01)

    def test_e13_prediccion_con_intervalos_y_extrapolacion(self):
        r = self.post("/api/regresion", {"y": "6,4 8,7 10,9 13,2 15,4 17,8", "x": "1 2 3 4 5 6",
                                         "predecir": "3,5\n30"})
        dentro, fuera = r["predicciones"]
        self.assertFalse(dentro["extrapola"])
        self.assertTrue(fuera["extrapola"])
        for p in (dentro, fuera):
            self.assertLess(p["ic_prediccion"][0], p["ic_media"][0])     # predicción más ancha que la media
            self.assertGreater(p["ic_prediccion"][1], p["ic_media"][1])
            self.assertTrue(p["ic_media"][0] < p["prediccion"] < p["ic_media"][1])
        self.assertTrue(any("extrapol" in aviso.lower() for aviso in r["avisos"]))

    def test_recta_conocida(self):
        # A mano: x̄ = 3,5; ȳ = 8; Sxx = 17,5; Sxy = 34,5 → pendiente 69/35 y ordenada 8 − 3,5·69/35 = 1,1.
        r = self.post("/api/regresion", {"y": [3, 5, 7, 9, 11.5, 12.5], "x": [1, 2, 3, 4, 5, 6]})
        self.cerca(r["coeficientes"][1]["estimacion"], 69 / 35, rel=1e-10)
        self.cerca(r["coeficientes"][0]["estimacion"], 1.1, rel=1e-10)
        self.assertEqual(r["gl"], 4)
        self.assertNotIn("100,0 %", r["conclusion"])          # R² < 1 no se redondea a «100,0 %»

    def test_respuesta_constante_con_ruido_de_coma_flotante(self):
        # 0,1 + 0,2 ≠ 0,3 en binario: no debe tomarse por variación real (R² sería basura).
        self.error("/api/regresion", {"y": [0.1 + 0.2, 0.3, 0.3, 0.1 + 0.2], "x": [1, 2, 3, 4]},
                   campo="y", tipo="dominio")

    def test_predictores_dependientes(self):
        self.error("/api/regresion", {"y": [1, 2, 3, 4], "x": [[1, 2], [2, 4], [3, 6], [4, 8]]},
                   campo="x", tipo="dominio")


class ErroresTest(Base):
    """E16: errores en español, clasificados y sin trazas internas."""

    def test_contrato_de_error(self):
        casos = [
            ("/api/descriptiva", {"datos": "1 2 abc"}, "datos", "sintaxis"),
            ("/api/descriptiva", {"datos": ""}, "datos", None),
            ("/api/inferencia", {"prueba": "no_existe"}, None, None),
            ("/api/distribucion/calcular", {"clave": "normal", "parametros": {"mu": 0, "sigma": -1}, "x": 0},
             "sigma", "dominio"),
            ("/api/simulacion", {"tipo": "pi", "n": 10 ** 12}, "n", None),
        ]
        for ruta, cuerpo, campo, tipo in casos:
            with self.subTest(ruta=ruta, cuerpo=cuerpo):
                e = self.error(ruta, cuerpo, campo=campo, tipo=tipo)
                self.assertNotIn("Traceback", e["error"])
                for ingles in ("cannot", "invalid", "must be", "could not", "Exceeds"):
                    self.assertNotIn(ingles, e["error"])

    def test_json_invalido_y_ruta_inexistente(self):
        r = self.cliente.post("/api/descriptiva", data="{mal", headers={**ANFITRION, "Content-Type": "application/json"})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.get_json()["tipo"], "sintaxis")
        r = self.cliente.get("/api/no-existe", headers=ANFITRION)
        self.assertEqual(r.status_code, 404)
        self.assertIn("No se encontró", r.get_json()["error"])

    def test_valores_no_finitos_en_json(self):
        r = self.cliente.post("/api/descriptiva", data='{"datos": [1, 2, NaN]}',
                              headers={**ANFITRION, "Content-Type": "application/json"})
        self.assertEqual(r.status_code, 400)
        cuerpo = r.get_json()
        self.assertIn(cuerpo["tipo"], ("sintaxis", "dominio"))
        self.assertNotIn("cannot", cuerpo["error"])

    def test_infinito_se_serializa_como_texto(self):
        r = self.post("/api/inferencia", {"prueba": "t_una", "datos": [12.4, 11.8, 13.1, 12.9], "mu0": 12,
                                          "alternativa": "less"})
        self.assertEqual(r["intervalo"][0], "−∞")


if __name__ == "__main__":
    unittest.main()
