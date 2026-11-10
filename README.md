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
  preferencias persistentes.
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

Variables útiles: `AMPU_HOST`, `PORT` y `AMPU_NO_BROWSER=1`.

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
├── build_exe.py            # Empaquetado real con PyInstaller
├── requirements.txt        # Dependencias de ejecución
├── requirements-build.txt  # + PyInstaller, solo para el ejecutable
├── scripts/                # probar.sh y dejar_de_versionar.sh
├── engine/ampu/            # Motor estadístico canónico + teoría + KaTeX
├── frontend/
│   ├── index.html          # Shell de la aplicación
│   └── static/
│       ├── css/app.css     # Sistema de diseño, componentes y responsive
│       ├── favicon.svg
│       └── js/
│           ├── app.js      # Router, shell, paleta, ayuda y atajos
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
./scripts/probar.sh          # todo: Python (unittest) y analizador del navegador (Node)

PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=vendor python3 -m unittest discover -s tests -v
node --test tests/test_entrada.mjs
```

| Archivo | Qué comprueba |
| --- | --- |
| `tests/test_api.py` | Contrato general de la API y valores de referencia |
| `tests/test_regresiones.py` | Un caso por hallazgo de la auditoría (E1–E19), con su referencia |
| `tests/test_entrada.py` · `test_entrada.mjs` | Los dos lectores de números contra `vectores_entrada.json` |
| `tests/test_seguridad.py` | Cabeceras, anfitrión, origen y exportación sin fórmulas |

Las pruebas no cubren el aspecto visual: no hay pruebas automáticas en navegador.

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

## Privacidad y alcance

- Sin cuentas, analítica, telemetría ni peticiones a hosts externos.
- Los datos de usuario viven en el almacenamiento local del navegador; el
  servidor solo guarda una copia de las preferencias.
- Los cálculos se delegan al motor `engine/ampu`; la interfaz no evalúa código
  enviado por el usuario.
- AmPu es un **laboratorio de formularios**: cada herramienta pide sus datos en
  campos con nombre. No acepta expresiones libres (`2*x+sin(x)`), ni en la
  interfaz ni en la API; ningún texto del usuario se interpreta como fórmula.
