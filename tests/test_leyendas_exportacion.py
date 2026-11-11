"""Las leyendas exportadas tienen espacio propio, también con muchas series."""

from __future__ import annotations

from io import BytesIO
import unittest

from matplotlib.backends.backend_agg import FigureCanvasAgg
from PIL import Image

import app


def figura_payload(nombres):
    tipos = ("linea", "barra", "dispersion")
    return {
        "titulo": "Comparación de estimaciones",
        "xlabel": "Número de observaciones",
        "ylabel": "Valor estimado",
        "series": [
            {"nombre": nombre, "tipo": tipos[i % len(tipos)],
             "x": [0, 1, 2, 3], "y": [i, i + 2, i + 1, i + 3]}
            for i, nombre in enumerate(nombres)
        ],
    }


class LeyendasExportacionTest(unittest.TestCase):
    def comprobar_disposicion(self, figura):
        lienzo = FigureCanvasAgg(figura)
        lienzo.draw()
        renderer = lienzo.get_renderer()
        eje = figura.axes[0]
        self.assertIsNone(eje.get_legend(), "la leyenda no debe estar dentro del área de datos")
        self.assertEqual(len(figura.legends), 1)
        leyenda = figura.legends[0]
        caja = leyenda.get_window_extent(renderer)
        self.assertGreaterEqual(caja.x0, 0)
        self.assertGreaterEqual(caja.y0, 0)
        self.assertLessEqual(caja.x1, figura.bbox.x1)
        self.assertLessEqual(caja.y1, figura.bbox.y1)
        # Incluye título, marcas y nombres de los ejes, no solo las líneas.
        self.assertLess(caja.y1 + 2, eje.get_tightbbox(renderer).y0)
        self.assertGreater(eje.get_window_extent().height / figura.dpi, 3,
                           "las filas de leyenda no deben aplastar el gráfico")
        return leyenda

    def test_leyendas_fuera_del_grafico_a_las_resoluciones_de_exportacion(self):
        casos = [
            ["f(x)"],
            ["Observaciones", "Recta ajustada"],
            [f"Modelo {i + 1}: estimación del intervalo de confianza para la población de referencia"
             for i in range(8)],
            ["W" * 200, "Estimación" * 30, "Referencia", "Cuantiles observados"],
        ]
        for nombres in casos:
            figura = app._figura_export(figura_payload(nombres))
            for dpi in (120, 135, 180):
                with self.subTest(series=len(nombres), dpi=dpi):
                    figura.set_dpi(dpi)
                    leyenda = self.comprobar_disposicion(figura)
                    self.assertCountEqual(
                        ["".join(texto.get_text().split()) for texto in leyenda.get_texts()],
                        ["".join(nombre.split()) for nombre in nombres],
                        "el ajuste de línea no debe omitir ni truncar los nombres",
                    )

    def test_series_sin_nombre_o_sin_puntos_no_reservan_leyendas_vacias(self):
        payload = figura_payload([None])
        payload["series"].append({"nombre": "Sin puntos", "x": [], "y": []})
        figura = app._figura_export(payload)
        FigureCanvasAgg(figura).draw()
        self.assertIsNone(figura.axes[0].get_legend())
        self.assertEqual(figura.legends, [])

    def test_sin_datos_no_hay_figura(self):
        self.assertIsNone(app._figura_export(None))
        self.assertIsNone(app._figura_export({"series": []}))

    def test_api_exporta_png_y_pdf_con_leyendas_largas(self):
        cliente = app.app.test_client()
        figura = figura_payload([
            "Observaciones de la población de referencia y su estimación",
            "Modelo ajustado con el intervalo de confianza de la predicción",
        ])
        for formato, cabecera in (("png", b"\x89PNG\r\n\x1a\n"), ("pdf", b"%PDF-")):
            with self.subTest(formato=formato):
                with cliente.post("/api/exportar", json={
                    "formato": formato, "titulo": "Leyendas sin solapamientos", "figura": figura,
                }, headers={"Host": "127.0.0.1:5000"}) as respuesta:
                    self.assertEqual(respuesta.status_code, 200)
                    contenido = respuesta.get_data()
                    self.assertTrue(contenido.startswith(cabecera))
                    if formato == "png":
                        with Image.open(BytesIO(contenido)) as imagen:
                            self.assertGreater(imagen.width, 1000)
                            self.assertGreater(imagen.height, 700)
                            imagen.verify()


if __name__ == "__main__":
    unittest.main()
