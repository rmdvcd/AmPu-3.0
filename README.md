# AmPu 3.2 · laboratorio local de probabilidad y estadística

AmPu es una aplicación web **local y sin conexión** para aprender, calcular y
documentar probabilidad y estadística. El motor numérico es Python
(NumPy/SciPy/Pandas); la interfaz es HTML, CSS y JavaScript sin frameworks ni
CDN. Todo se sirve desde `app.py`: ni los datos ni las preferencias salen del
equipo.

## Estado actual

La interfaz anterior (`frontend/style.css` y `frontend/script.js`) fue sustituida
por una arquitectura modular:

- **Shell accesible** con navegación por hash, migas, barra lateral colapsable,
  paleta de comandos (`Ctrl K`), ayuda (`?`), temas claro/oscuro/sistema y
  preferencias persistentes. El menú se abre desde la izquierda; el disparador
  desaparece al abrirlo y se cierra con la X. En móvil bloquea el fondo,
  contiene el foco y se cierra también con Esc, el velo o la navegación.
- **Centro de ayuda** de carga diferida con guía rápida, ejemplos de entrada y
  atajos agrupados con búsqueda por acción o tecla. Distingue combinaciones de
  alternativas y usa únicamente combinaciones de **Windows** (`Ctrl`, `Alt`,
  `Shift`), sin remapeos de plataforma ni activación con Meta. Pestañas
  accesibles, foco restaurado al cerrar y diseño para móvil y escritorio en
  ambos temas. La lista de atajos vive solo en Ayuda, no se repite en Ajustes.
- **10 vistas** en módulos independientes: inicio, distribuciones, descriptiva,
  probabilidad, inferencia, regresión, muestreo, simulación, teoría y ajustes.
- **26 distribuciones**, **13 pruebas de hipótesis**, **7 diseños de muestreo**,
  **5 experimentos de simulación** y **57 lecciones** con fórmulas KaTeX e
  imágenes servidas localmente.
- **Exportación** a PDF, Excel y CSV desde cualquier resultado, y PNG en las
  vistas con gráfico (todas salvo probabilidad). La API acepta `pdf`, `xlsx`,
  `png` y `csv`.
- **Diseño responsivo** y componentes reutilizables: paneles, KPIs, tablas con
  scroll, alertas, veredictos, pestañas, chips, formularios con validación y
  estados vacíos.
- **Contraste en ambos temas**: texto, ayudas, placeholders, controles e
  indicadores de carga con colores propios de cada variante. El cambio de tema
  aplica fondo y tinta juntos, sin interpolar colores incompatibles.
- **Identidad simplificada** y legible a tamaño pequeño en la barra lateral,
  los diálogos, la pestaña y el ejecutable. El arranque de escritorio añade una
  bandeja nativa de Windows con opciones para abrir y salir de AmPu.

El detalle del rediseño está en
[`README_REDISEÑO_AMPU_3_0.md`](README_REDISEÑO_AMPU_3_0.md). La auditoría de la
versión 3.1 y el estado de cada hallazgo en la 3.2 están en
[`AUDITORIA_AMPU.md`](AUDITORIA_AMPU.md).

## Cómo se escriben los números

La misma regla vale en todas las pantallas y en la API (la aplican
`engine/ampu/core/entrada.py` y `frontend/static/js/entrada.js`, comprobados con
los mismos casos de prueba):

- **Decimales** con coma o con punto: `12,5` y `12.5` son el mismo número.
- **Separadores** entre valores: espacio, tabulador, salto de línea, punto y coma,
  o coma seguida de espacio (`1, 2, 3`).
- Lo ambiguo **no se adivina**: `1,2,3` o `1.234,5` se rechazan indicando la
  posición y una sugerencia. Tampoco se aceptan `50%`, `0x10`, `nan` ni `inf`.
- En probabilidad se admiten **fracciones** (`1/3`) y se opera con aritmética
  exacta: el resultado se muestra como fracción y como decimal.
- Bajo cada campo de datos aparece lo que se ha leído («4 valores: 12,4 · 11,8 …»).

Los resultados se muestran con coma decimal y espacio fino de millares; los
p-valores muy pequeños, en notación científica (nunca como `0`).

## Puesta en marcha

Requisitos: Python 3.11 y las dependencias de `requirements.txt`. Las
dependencias **no se versionan**: se instalan una vez en `vendor/` (carpeta local,
ignorada por Git), sin tocar el Python del sistema.

```bash
cd AmPu-3.0
pip install --target vendor --no-compile -r requirements.txt   # solo la primera vez
PYTHONPATH=vendor python3 app.py
# Abre http://127.0.0.1:5000
```

Si prefieres un entorno virtual, `pip install -r requirements.txt` dentro de él
funciona igual y no hace falta `PYTHONPATH`.

Para escuchar en todas las interfaces (por ejemplo, dentro de un contenedor):

```bash
AMPU_HOST=0.0.0.0 PORT=5000 PYTHONPATH=vendor python3 app.py
```

Arranque de escritorio, que abre el navegador cuando el motor ya responde:

```bash
PYTHONPATH=vendor python3 main.py
```

Variables útiles: `AMPU_HOST`, `PORT`, `AMPU_NO_BROWSER=1` y `AMPU_NO_TRAY=1`.
En Windows, este arranque muestra una bandeja propia con «Abrir AmPu» y
«Salir de AmPu». Cerrar la pestaña no detiene el motor; usa la opción de salida
de la bandeja. `python app.py` solo inicia el servidor, sin bandeja.

La aplicación se sirve con Waitress. Por seguridad solo atiende peticiones
dirigidas a `127.0.0.1`/`localhost` y no se deja incrustar en otras páginas. Si
la publicas detrás de un proxy o con otro nombre:

| Variable | Efecto |
| --- | --- |
| `AMPU_HOSTS_PERMITIDOS` | Nombres de host admitidos, separados por comas (`*` desactiva la comprobación) |
| `AMPU_PERMITIR_IFRAME=1` | Permite incrustar la aplicación en un `iframe` |

## Estructura

```
.
├── app.py                  # Servidor Flask, API JSON y exportaciones
├── main.py                 # Arranque de escritorio
├── escritorio.py           # Identidad y bandeja nativa de Windows
├── build_exe.py            # Empaquetado real con PyInstaller
├── requirements.txt        # Dependencias de ejecución
├── requirements-build.txt  # + PyInstaller, solo para el ejecutable
├── scripts/                # probar.sh y dejar_de_versionar.sh
├── engine/ampu/            # Motor estadístico canónico + teoría + KaTeX
├── frontend/
│   ├── index.html          # Shell de la aplicación
│   └── static/
│       ├── css/app.css     # Sistema de diseño, componentes y responsive
│       ├── favicon.svg · favicon.ico
│       ├── img/icono_ampu.svg · icono_ampu.png # Símbolo simplificado
│       └── js/
│           ├── app.js      # Router, shell, paleta y eventos globales
│           ├── ayuda.js    # Centro de ayuda y presentación compartida de atajos
│           ├── atajos.js   # Búsqueda y resolución de combinaciones de Windows
│           ├── lectura.js  # Prosa segura, pasos, tablas y fórmulas de las lecciones
│           ├── ui.js       # Componentes y formato numérico
│           ├── entrada.js  # Lector de números, series y matrices
│           ├── api.js      # Cliente HTTP y descargas
│           ├── store.js    # Preferencias, historial y metadatos
│           ├── chart.js    # Gráficos SVG accesibles (sin librerías)
│           ├── icons.js    # Iconos de línea locales
│           ├── params.js   # Campos generados desde metadatos
│           ├── data.js     # Navegación y textos de orientación
│           └── views/      # Una vista por módulo
├── tests/                  # API, regresiones de la auditoría, entrada y seguridad
└── vendor/                 # Dependencias instaladas (local, no versionado)
```

## Flujo de trabajo

1. **Explorar**: elige una distribución, ajusta parámetros y lee densidad/masa,
   acumulada, supervivencia, cuantiles, momentos e intervalos. La misma pantalla
   permite exportar y enviar el modelo a simulación.
2. **Describir**: pega una serie, importa CSV/TSV o usa el ejemplo. Se validan los
   datos antes de llamar al motor; el resultado incluye resumen, IC de la media,
   histograma con intervalos ajustables, caja, atípicos, frecuencias y ECDF.
   Desde ahí puedes **enviar la muestra a inferencia** o **ajustar una normal**.
3. **Inferir y modelar**: 13 pruebas con estadístico, p-valor, grados de libertad,
   intervalo, tamaño del efecto, supuestos y curva; regresión simple/múltiple con
   coeficientes, IC, R², RMSE, residuos y predicciones.
4. **Diseñar**: calcula el tamaño muestral y ejecuta diseños aleatorios,
   sistemáticos, estratificados, Neyman, óptimos y por conglomerados con semilla.
5. **Simular y aprender**: Monte Carlo (π, integrales), muestras, ajuste por
   máxima verosimilitud, QQ-plot y 57 lecciones conectadas con cada herramienta.
   Cada lección incluye un ejemplo resuelto con cifras de referencia verificadas.
   La biblioteca y los desplegables de distribuciones conservan listas, énfasis,
   subíndices y fórmulas; las tablas y expresiones anchas se desplazan dentro
   del artículo, sin ensanchar la página.

## API

Todas las rutas devuelven JSON y validan los datos antes de llamar al motor.

| Método | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/salud` | Versión, estado y catálogo |
| GET | `/api/meta` | Modelos, pruebas, muestreo, simulación y teoría |
| GET | `/api/ejemplos` | Ejemplos de cada herramienta |
| GET | `/api/teoria/lista` · `/api/teoria/<clave>` | Biblioteca y lección |
| GET/POST | `/api/preferences` | Copia de seguridad de preferencias |
| POST | `/api/distribucion/calcular` · `/muestra` | PMF/PDF/CDF/PPF y muestras |
| POST | `/api/descriptiva` | Resumen, histograma, caja y atípicos |
| POST | `/api/probabilidad/combinatoria` · `/condicional` · `/bayes` · `/variable` | Probabilidad |
| POST | `/api/inferencia` | Una de las 13 pruebas |
| POST | `/api/regresion` | OLS simple/múltiple y predicciones |
| POST | `/api/muestreo/tamano` · `/api/muestreo` | Tamaño y diseño muestral |
| POST | `/api/simulacion` | `pi`, `integral`, `muestra`, `ajuste`, `qq` |
| POST | `/api/exportar` | PDF, XLSX, PNG o CSV |

Los errores usan `{ "error", "campo", "tipo", "sugerencia"?, "posicion"? }`;
el cliente los muestra junto al campo indicado. `tipo` es uno de `sintaxis`,
`dominio`, `ambiguedad`, `fuera_de_alcance`, `timeout` (504), `seguridad` (403),
`http` o `interno`. Los mensajes están en español y no exponen trazas. Los
valores infinitos viajan como `"∞"` y `"−∞"`; muchas respuestas incluyen
`avisos` con los supuestos dudosos o las lecturas que conviene revisar.

## Pruebas

```bash
./scripts/probar.sh          # Python y Node; gráficos si Playwright está instalado

PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=vendor python3 -m unittest discover -s tests -v
node --test --test-concurrency=1 tests/test_*.mjs
```

| Archivo | Qué comprueba |
| --- | --- |
| `tests/test_api.py` | Contrato general de la API y valores de referencia |
| `tests/test_regresiones.py` | Un caso por hallazgo de la auditoría (E1–E19), con su referencia |
| `tests/test_entrada.py` · `test_entrada.mjs` | Los dos lectores de números contra `vectores_entrada.json` |
| `tests/test_seguridad.py` | Cabeceras, anfitrión, origen y exportación sin fórmulas |
| `tests/test_navegacion.py` | Shell sin footer global ni controles de menú duplicados, rutas de teoría válidas y semántica de los catálogos |
| `tests/test_atajos.mjs` | Combinaciones de Windows, rechazo de Meta, búsqueda y prioridad de campos, gráficos y diálogos |
| `tests/test_navegacion.mjs` | Menú izquierdo sin controles duplicados, foco/inert, persistencia y cambios móvil/escritorio; limpieza de Inicio/Ajustes, campos deshabilitados y regresiones de inferencia y muestreo |
| `tests/test_ayuda.mjs` | Carga diferida, pestañas y búsqueda, foco, navegación, atajos bloqueados detrás del diálogo y diseño móvil/escritorio en ambos temas |
| `tests/test_leyendas_exportacion.py` | Leyendas externas sin recortes ni solapamientos en PNG/PDF, con muchas series y nombres largos |
| `tests/test_graficos.mjs` | Leyendas sin solapamientos a 180, 240, 360 y 760 px, en ambos temas, con nombres largos, zoom, conmutación de series y resumen del diagrama de caja |
| `tests/test_temas.mjs` | Contraste calculado de texto (≥ 4,5:1), controles y gráficos (≥ 3:1), hover/foco/carga real, placeholders, avisos, series ocultas, fotogramas del cambio de tema, sistema y persistencia |
| `tests/test_icono.py` | Identidad vectorial simplificada, PNG y nueve tamaños ICO, transparencia, regeneración determinista y recursos/comandos de PyInstaller (sin compilar el ejecutable) |
| `tests/test_escritorio.py` | Salud antes de abrir el navegador, identidad Windows, recursos `_MEIPASS`, menú abrir/salir, vigilancia del servidor y respaldo de consola; backend nativo simulado |
| `tests/test_teoria.py` · `ejemplos_teoria.json` | Un caso numérico por cada una de las 57 lecciones, corrección finita y dos etapas; Markdown completo, TOC y subíndices sin recortes |
| `tests/test_lectura.mjs` | Todas las fórmulas con KaTeX real; iconos, HTML seguro, pasos y tablas/fórmulas desplazables por teclado; diálogos, buscador y páginas independientes en ambos temas y tamaños de pantalla |

Las comprobaciones de navegación, ayuda, lectura, gráficos y temas usan Chromium real y son opcionales; si
no está instalado `playwright-core`, se marcan como omitidas sin afectar a las
pruebas del motor. Para activarlas (solo desarrollo, sin dependencias nuevas
para ejecutar AmPu):

```bash
npm install --no-save --package-lock=false playwright-core
npx playwright-core install chromium
node --test --test-concurrency=1 tests/test_navegacion.mjs tests/test_ayuda.mjs tests/test_lectura.mjs tests/test_graficos.mjs tests/test_temas.mjs
```

No necesitan arrancar la app: sirven los componentes estáticos en servidores de
prueba temporales. Si ya tienes Chromium, puedes indicar su ruta con
`AMPU_CHROMIUM=/ruta/a/chromium` (y argumentos adicionales mediante
`AMPU_CHROMIUM_ARGS`, una lista JSON). Las pruebas de contraste de componentes
usan superficies sólidas; no sustituyen la revisión visual de degradados,
imágenes ni de todas las combinaciones posibles de datos.

Para una revisión manual: abre cada sección desde la barra lateral, ejecuta el
ejemplo, cambia de tema, usa `Ctrl K`, `?`, `Ctrl Enter` y comprueba que el
resultado conserva su fórmula, su interpretación y sus exportaciones.

## Portabilidad

`build_exe.py` empaqueta de verdad con PyInstaller (no simula resultados):

```bash
pip install --target vendor --no-compile -r requirements-build.txt
PYTHONPATH=vendor python3 build_exe.py
```

En Windows genera `dist/ampu_portable_3_0.exe`; en Linux/macOS, un ejecutable sin
extensión. El ejecutable incluye `frontend/`, `engine/` y las dependencias; el
navegador se abre solo cuando `/api/salud` responde.

### Identidad y bandeja de Windows

El icono del `.exe` se incorpora con `--icon` al **recompilar en Windows**;
no modifica ejecutables ya generados. El SVG de la barra lateral, los diálogos,
la pestaña del navegador, el PNG de bandeja y el ICO del ejecutable comparten
el nuevo símbolo simplificado. Consulta
[`frontend/static/img/README.md`](frontend/static/img/README.md).

```bash
PYTHONPATH=vendor python3 scripts/generar_iconos.py
```

El ejecutable de Windows se construye sin consola e incluye `pystray._win32`.
Si la bandeja falla o se desactiva, AmPu intenta abrir una consola de respaldo.
El icono de bandeja desaparece al salir o si el servidor deja de funcionar.
La identidad `AmPu.Laboratorio.3` pertenece al proceso de AmPu: **no sustituye
el icono nativo ni la agrupación de ventanas del navegador predeterminado**.

Comprobación manual necesaria en Windows después de recompilar:

1. Abrir el ejecutable y revisar su icono, la pestaña y los diálogos de la app.
2. Verificar la bandeja a escala 100 %, 125 % y 150 %, abrir su menú y recuperar
   la app después de cerrar la pestaña.
3. Usar «Salir de AmPu» y comprobar que desaparecen el icono y el proceso y que
   el puerto vuelve a estar disponible.
4. Probar `AMPU_NO_TRAY=1` y la recuperación tras reiniciar Explorer.

Las pruebas de Linux validan recursos, comandos y contratos simulados; no
certifican el comportamiento nativo de la barra de tareas o de Explorer.

## Privacidad y alcance

- Sin cuentas, analítica, telemetría ni peticiones a hosts externos.
- Los datos de usuario viven en el almacenamiento local del navegador; el
  servidor solo guarda una copia de las preferencias.
- Los cálculos se delegan al motor `engine/ampu`; la interfaz no evalúa código
  enviado por el usuario.
- AmPu es un **laboratorio de formularios**: cada herramienta pide sus datos en
  campos con nombre. No acepta expresiones libres (`2*x+sin(x)`), ni en la
  interfaz ni en la API; ningún texto del usuario se interpreta como fórmula.
