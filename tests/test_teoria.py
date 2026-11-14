"""Las 57 lecciones conservan pasos, fórmulas y resultados reproducibles."""

from __future__ import annotations

from html import unescape
from html.parser import HTMLParser
import json
import math
from pathlib import Path
import re
import unittest

import numpy as np

import app
from ampu.core.estadistica.inferencia import intervalo_media
from ampu.docs.teoria import DOCUMENTOS, convertir_markdown, leer_teoria, renderizar

CASOS = json.loads((Path(__file__).parent / "ejemplos_teoria.json").read_text(encoding="utf-8"))


class Estructura(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.etiquetas = []
        self.atributos = []
        self.feed(html)

    def handle_starttag(self, tag, attrs):
        self.etiquetas.append(tag)
        self.atributos.append((tag, dict(attrs)))


class EjemplosTeoriaTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cliente = app.app.test_client()

    def comprobar_valor(self, obtenido, esperado):
        if isinstance(esperado, list):
            self.assertEqual(len(obtenido), len(esperado))
            for actual, valor in zip(obtenido, esperado):
                self.comprobar_valor(actual, valor)
        elif esperado is None or isinstance(esperado, (str, bool, int)):
            self.assertEqual(obtenido, esperado)
        else:
            self.assertTrue(math.isclose(obtenido, esperado, rel_tol=1e-8, abs_tol=1e-6), (obtenido, esperado))

    def comprobar_caso(self, caso):
        texto = leer_teoria(caso["clave"])
        ejemplo = app._seccion(texto, "Ejemplo resuelto, paso a paso")
        self.assertGreaterEqual(len(re.findall(r"^\d+\. ", ejemplo, re.M)), 3)
        self.assertIn("**", ejemplo, "etiquetas y resultados destacados, no pasos aplanados")
        for numero in caso["texto_verificado"]:
            self.assertIn(numero, ejemplo, "la cifra de referencia debe seguir en el ejemplo publicado")
        if caso.get("operacion") == "intervalo_media":
            # Una serie con exactamente los momentos indicados en el ejemplo.
            e = caso["entrada"]
            serie = np.arange(e["n"], dtype=float)
            serie = e["media"] + e["s"] * (serie - serie.mean()) / serie.std(ddof=1)
            inferior, superior = intervalo_media(serie, e["confianza"])
            respuesta = {"inferior": inferior, "superior": superior}
        else:
            r = self.cliente.post(caso["ruta"], json=caso["entrada"])
            self.assertEqual(r.status_code, 200, r.get_data(as_text=True))
            respuesta = r.get_json()
        for campo, esperado in caso["esperado"].items():
            valor = respuesta
            for parte in campo.split("."):
                valor = valor[int(parte)] if isinstance(valor, list) else valor[parte]
            self.comprobar_valor(valor, esperado)

    def test_cada_leccion_tiene_un_caso_numerico(self):
        claves = [caso["clave"] for caso in CASOS]
        self.assertEqual(len(claves), len(set(claves)))
        self.assertEqual(set(claves), {p.stem for p in DOCUMENTOS.glob("*.md")})
        self.assertEqual(len(claves), 57)

    def test_ejemplos_de_correccion_finita_y_dos_etapas_tambien_estan_resueltos(self):
        for datos, esperado in (
            ({"tipo": "media", "sigma": 12, "error": 2, "confianza": .95, "N": 500}, 109),
            ({"tipo": "proporcion", "p": .5, "error": .05, "confianza": .95, "N": 1000}, 278),
        ):
            self.assertEqual(self.cliente.post("/api/muestreo/tamano", json=datos).get_json()["n"], esperado)
        conglomerados = next(c for c in CASOS if c["clave"] == "muestreo_conglomerados")
        datos = {**conglomerados["entrada"], "n_por_grupo": 10}
        self.assertEqual(self.cliente.post("/api/muestreo", json=datos).get_json()["total_muestra"], 20)
        sistematico = next(c for c in CASOS if c["clave"] == "muestreo_sistematico")
        datos = self.cliente.post(sistematico["ruta"], json=sistematico["entrada"]).get_json()
        self.assertEqual([fila[1] for fila in datos["tablas"]["Selección"]["filas"]], list(range(3, 40, 4)))


def crear_prueba(caso):
    def probar(self):
        self.comprobar_caso(caso)
    return probar


for _caso in CASOS:
    setattr(EjemplosTeoriaTest, "test_ejemplo_" + _caso["clave"], crear_prueba(_caso))


class FormatoTeoriaTest(unittest.TestCase):
    def test_conversion_preserva_latex_listas_enfasis_tablas_y_codigo(self):
        fuente = r'''# Lección

## Ejemplo resuelto

1. **Datos.** Usa $\mu_x=2$ y `mu_x`.
2. **Resultado.** Conserva la fórmula:

$$
T=\frac{\bar X_1-\bar X_2}{\sqrt{s_1^2/n_1+s_2^2/n_2}}
$$

| Columna | Valor |
|---|---|
| `alpha` | $\alpha_i$ |

```text
sin ejecutar <script>
```
'''
        html, conversor = convertir_markdown(fuente)
        estructura = Estructura(html)
        for tag in ("h1", "h2", "ol", "li", "strong", "table", "th", "code", "pre"):
            self.assertIn(tag, estructura.etiquetas)
        self.assertIn(r"\mu_x=2", unescape(html))
        self.assertIn(r"s_1^2/n_1", unescape(html))
        self.assertIn('<div class="tabla-scroll"><table>', html)
        self.assertNotRegex(html, r"AMPU(?:BLOCK|INLINE)TOKEN\d+END")
        self.assertIn("ejemplo-resuelto", conversor.toc)
        self.assertIn("&lt;script&gt;", html)

    def test_todas_las_lecciones_llegan_completas_a_la_api_y_al_renderer_local(self):
        with app.app.test_client() as cliente:
            for caso in CASOS:
                clave = caso["clave"]
                with self.subTest(clave=clave):
                    r = cliente.get(f"/api/teoria/{clave}")
                    self.assertEqual(r.status_code, 200)
                    d = r.get_json()
                    estructura = Estructura(d["html"])
                    self.assertEqual(estructura.etiquetas.count("h1"), 1)
                    self.assertGreaterEqual(estructura.etiquetas.count("li"), 3)
                    self.assertIn("ol", estructura.etiquetas)
                    self.assertIn("strong", estructura.etiquetas)
                    self.assertNotRegex(d["html"], r"AMPU(?:BLOCK|INLINE)TOKEN\d+END")
                    ids = {atributos.get("id") for tag, atributos in estructura.atributos}
                    self.assertTrue(all(t["id"] in ids for t in d["toc"]))
                    for tag, atributos in estructura.atributos:
                        if tag == "img":
                            self.assertRegex(atributos["src"], r"^/media/teoria/[a-z_]+\.png$")
                    for cifra in caso["texto_verificado"]:
                        self.assertIn(cifra, unescape(d["html"]))
                    for tema in ("claro", "oscuro"):
                        pagina = renderizar(clave, tema)
                        self.assertIn(f'data-tema="{tema}"', pagina)
                        self.assertIn(d["titulo"], pagina)
                        self.assertNotIn("{{", pagina)

    def test_fichas_de_distribuciones_no_recortan_ni_aplanan_ejemplos(self):
        with app.app.test_client() as cliente:
            modelos = cliente.get("/api/meta").get_json()["distribuciones"]
        self.assertEqual(len(modelos), 26)
        for modelo in modelos:
            with self.subTest(clave=modelo["clave"]):
                html = modelo["ejemplo_html"]
                self.assertIn("<ol>", html)
                self.assertEqual(Estructura(html).etiquetas.count("li"), 4)
                self.assertIn("<strong>Interpretación.</strong>", html)
                self.assertNotIn("<img", modelo["propiedades_html"])
                self.assertNotIn("Figura 1", modelo["propiedades_html"])
                if modelo["clave"] == "binomial_negativa":
                    self.assertEqual(modelo["parametros"][0]["descripcion"], "Número de éxitos objetivo")

    def test_prosa_de_inferencia_no_hereda_bloques_cdf_y_momentos_irrelevantes(self):
        for caso in CASOS:
            if caso.get("ruta") == "/api/distribucion/calcular":
                continue
            with self.subTest(clave=caso["clave"]):
                texto = leer_teoria(caso["clave"])
                self.assertNotIn("## Función de distribución acumulada (CDF)", texto)
                self.assertNotIn("Si no se explicita", texto)
                self.assertNotIn("CDF de referencia o del estimador", texto)

    def test_subindices_se_conservan_tambien_en_la_compatibilidad_de_texto(self):
        self.assertEqual(app._limpiar_markdown(r"**Media** $\mu_x$ y `mu_x`"), r"Media $\mu_x$ y mu_x")

    def test_proporcion_nula_explica_y_respeta_el_intervalo_abierto(self):
        with app.app.test_client() as cliente:
            pruebas = cliente.get("/api/meta").get_json()["pruebas"]
            prueba = next(p for p in pruebas if p["clave"] == "prop_una")
            p0 = next(c for c in prueba["campos"] if c["id"] == "p0")
            self.assertFalse(p0["incluir_minimo"])
            self.assertFalse(p0["incluir_maximo"])
            self.assertIn("0 < p₀ < 1", p0["ayuda"])
            self.assertIn("binomial exacta", prueba["supuestos"])
            for limite in (0, 1):
                r = cliente.post("/api/inferencia", json={"prueba": "prop_una", "exitos": 1, "n": 10, "p0": limite})
                self.assertEqual(r.status_code, 400)
                self.assertEqual(r.get_json()["campo"], "p0")

    def test_template_local_tiene_identidad_y_atajos_solo_de_windows(self):
        pagina = renderizar("normal")
        self.assertIn('rel="icon" href="../render/icono_ampu.svg"', pagina)
        self.assertNotIn("e.ctrlKey||e.metaKey", pagina)
        self.assertIn("e.ctrlKey&&!e.metaKey&&!e.altKey", pagina)


if __name__ == "__main__":
    unittest.main()
