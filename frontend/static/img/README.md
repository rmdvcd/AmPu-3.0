# Identidad de AmPu

El símbolo usa una sola curva de probabilidad y su base, en blanco sobre un
cuadrado de esquinas redondeadas verde oscuro (`#0b4a42`). No contiene letras,
marcas pequeñas ni degradados: debe seguir siendo reconocible a 16–20 px y en
ambos temas de la aplicación.

## Recursos

- `icono_ampu.svg`: vector de 64 × 64 unidades, para la barra lateral y los
  encabezados de todos los diálogos HTML.
- `icono_ampu.png`: 256 × 256 px RGBA, para la bandeja nativa de Windows.
- `../favicon.svg`: el mismo vector para la pestaña del navegador.
- `../favicon.ico`: cuadros de 16, 20, 24, 32, 40, 48, 64, 128 y 256 px, para
  navegadores y el icono del ejecutable de Windows al recompilar.
- `engine/ampu/docs/render/icono_ampu.svg`: copia del vector para las páginas
  de teoría independientes, que también funcionan sin conexión.

La geometría se define en `scripts/generar_iconos.py`. Cada resolución raster
se dibuja con antialiasing 4×; no se estira un icono rectangular ni se incrusta
un PNG en el SVG. Las esquinas son transparentes y los colores no se invierten
al cambiar de tema.

Regenera todos los recursos desde la raíz, sin fuentes ni descargas:

```bash
PYTHONPATH=vendor python3 scripts/generar_iconos.py
```

`tests/test_icono.py` comprueba geometría, transparencia, nitidez mínima,
regeneración determinista, entrega HTTP y recursos/comandos de empaquetado.
`tests/test_lectura.mjs` comprueba la marca en los diálogos reales. Las pruebas
simuladas de bandeja están en `tests/test_escritorio.py`; no sustituyen una
comprobación del ejecutable y de Explorer en Windows.
