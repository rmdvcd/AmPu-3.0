# AmPu 3.1 · laboratorio local de probabilidad y estadística

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

El detalle de la auditoría y de las decisiones de diseño está en
[`README_REDISEÑO_AMPU_3_0.md`](README_REDISEÑO_AMPU_3_0.md).

## Puesta en marcha

Requisitos: Python 3.11 y las dependencias de `requirements.txt`. En este
repositorio las dependencias ya están en `vendor/`, por lo que no hace falta
instalarlas para probar la app.

```bash
cd AmPu-3.0
PYTHONPATH=vendor python3 app.py
# Abre http://127.0.0.1:5000
```

Para escuchar en todas las interfaces (por ejemplo, dentro de un contenedor):

```bash
AMPU_HOST=0.0.0.0 PORT=5000 PYTHONPATH=vendor python3 app.py
```

Arranque de escritorio, que abre el navegador cuando el motor ya responde:

```bash
PYTHONPATH=vendor python3 main.py
```

Variables útiles: `AMPU_HOST`, `PORT` y `AMPU_NO_BROWSER=1`.

## Estructura

```
.
├── app.py                  # Servidor Flask, API JSON y exportaciones
├── main.py                 # Arranque de escritorio
├── build_exe.py            # Empaquetado real con PyInstaller
├── requirements.txt
├── engine/ampu/            # Motor estadístico canónico + teoría + KaTeX
├── frontend/
│   ├── index.html          # Shell de la aplicación
│   └── static/
│       ├── css/app.css     # Sistema de diseño, componentes y responsive
│       ├── favicon.svg
│       └── js/
│           ├── app.js      # Router, shell, paleta, ayuda y atajos
│           ├── ui.js       # Componentes y formato numérico
│           ├── api.js      # Cliente HTTP y descargas
│           ├── store.js    # Preferencias, historial y metadatos
│           ├── chart.js    # Gráficos SVG accesibles (sin librerías)
│           ├── icons.js    # Iconos de línea locales
│           ├── params.js   # Campos generados desde metadatos
│           ├── data.js     # Navegación y textos de orientación
│           └── views/      # Una vista por módulo
├── tests/test_api.py       # Pruebas de integración de la API
└── vendor/                 # Dependencias y KaTeX local
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

Los errores usan `{ "error": "...", "campo": ..., "tipo": "validacion" }` con
código HTTP 400; el cliente los muestra en el campo correspondiente.

## Pruebas

```bash
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=vendor python3 -m unittest discover -s tests -v
```

Las pruebas cubren salud/catálogo, una distribución, combinatoria exacta,
descriptiva, Bayes, regresión simple y múltiple, tamaños muestrales, los siete
diseños, Monte Carlo y validación de probabilidad condicional.

Para una revisión manual: abre cada sección desde la barra lateral, ejecuta el
ejemplo, cambia de tema, usa `Ctrl K`, `?`, `Ctrl Enter` y comprueba que el
resultado conserva su fórmula, su interpretación y sus exportaciones.

## Portabilidad

`build_exe.py` empaqueta de verdad con PyInstaller (no simula resultados):

```bash
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
