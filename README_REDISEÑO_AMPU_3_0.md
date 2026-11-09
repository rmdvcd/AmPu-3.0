# Rediseño AmPu 3.0: App Web Portable (Python + .exe)

## Objetivo
Transformar AmPu 3.0 (actualmente Dear PyGui) en una **App Web Portable** que se ejecute a través de un archivo `.exe`. El motor estadístico (Python) se mantiene intacto, pero la interfaz gráfica se sustituye por un servidor web local (Flask) que sirve un frontend HTML/JS/CSS.

## Estructura del Proyecto Rediseñado
```
AmPu-2.0/
├── AmPu 3.0/                 # Código original (referencia, sin cambios)
│   ├── src/ampu/             # Motor estadístico (core, io, docs, etc.)
│   ├── scripts/              # Scripts de construcción y validación
│   └── ...
└── portable_web_app/         # Nueva implementación web portable
    ├── app.py                # Backend Flask (API REST)
    ├── main.py               # Script de arranque para el .exe
    ├── build_exe.py          # Script PyInstaller
    ├── requirements.txt      # Dependencias (Flask, NumPy, SciPy, etc.)
    ├── frontend/             # HTML, CSS, JS
    │   ├── index.html
    │   ├── style.css
    │   └── script.js
    ├── engine/               # Copia del motor AmPu 3.0 (sin UI Dear PyGui)
    ├── vendor/               # Dependencias instaladas
    └── dist/ampu_portable.exe # Archivo ejecutable final
```

## Implementación

### 1. Motor Estadístico (Sin cambios en AmPu 3.0/src)
Se mantiene la lógica de `ampu.core`, `ampu.io`, `ampu.docs`, etc., tal como se especifica en el `PLAN.md` y `MIGRACION.md`. La API REST de Flask consume estos módulos.

### 2. Backend Flask (`app.py`)
- **Rutas API**:
  - `/api/preferences`: Gestión de tema y escala.
  - `/api/distribuciones/lista`: Lista de modelos (26 distribuciones).
  - `/api/distribucion/formulario/<clave>`: Metadatos de parámetros.
  - `/api/distribucion/calcular`: Cálculo de PMF/PDF/CDF/PPF, generación de gráficos (Matplotlib Agg) y tablas (Pandas).
  - `/api/teoria/lista` y `/api/teoria/<clave>`: Acceso a las 57 lecciones Markdown.
  - `/api/view/<tabId>`: HTML parcial para cada vista (Distribuciones, Muestreo, Descriptiva, Probabilidad, Inferencia, Simulación, Teoría).
  - `/api/exportar`: Exportación a Excel, PDF, PNG.
- **Integración con AmPu 3.0**:
  - Uso de `ampu.core.distribuciones.obtener(clave)` para modelos.
  - Uso de `ampu.core.muestreo.diseno.ejecutar_diseno` para muestreo.
  - Uso de `ampu.core.estadistica.*` para descriptiva, probabilidad, inferencia, regresión.
  - Uso de `ampu.core.simulacion.montecarlo` para Monte Carlo.
  - Uso de `ampu.io.servicio.ServicioExportacion` para exportaciones.
  - Uso de `ampu.docs.teoria.listar_teoria` y `leer_teoria` para teoría.
  - Uso de `ampu.ui.preferencias.Preferencias` para persistencia.

### 3. Frontend Web (`frontend/`)
- **index.html**: Estructura principal con navegación por pestañas (Distribuciones, Muestreo, Descriptiva, Probabilidad, Inferencia, Simulación, Teoría).
- **style.css**: Temas Claro/Oscuro, diseño responsivo, componentes (KPIs, tablas, gráficos).
- **script.js**: Lógica de comunicación con la API, renderizado de gráficos (base64), tablas editables y exportación.

### 4. Empaquetado Portable (`build_exe.py` y `main.py`)
- **main.py**: Inicia el servidor Flask en un hilo y abre el navegador en `http://127.0.0.1:5000`.
- **build_exe.py**: Usa PyInstaller para crear un `.exe` único que incluye:
  - El motor AmPu 3.0 (`engine/ampu/`).
  - El servidor Flask (`app.py`).
  - El frontend (`frontend/`).
  - Las dependencias (`vendor/`).
  - El script de arranque (`main.py`).
- **Resultado**: `/dist/ampu_portable.exe` (Portable, sin instalación).

## Reversión de Cambios en AmPu 2.0
Se han eliminado los archivos temporales de la carpeta `portable_web_app` creados en el paso anterior (si los hubiera) y se ha restaurado el estado limpio del repositorio `AmPu-2.0`. El trabajo se realiza ahora específicamente sobre la estructura de **AmPu 3.0** (`/AmPu 3.0/`).

## Pasos de Ejecución
1. **Preparación**: Copiar la lógica de `AmPu 3.0/src/ampu` (excluyendo `ui/`) al directorio `engine/`.
2. **Instalación de dependencias**: `pip install -r requirements.txt --target vendor/`.
3. **Construcción**: Ejecutar `python build_exe.py`.
4. **Resultado**: Archivo `.exe` portable en `dist/`.

## Cumplimiento del Plan y Migración
- **Distribuciones**: Registro de 26 modelos (SciPy) con validación de metadatos.
- **Muestreo**: Diseños finito, infinito, estratificado, sistemático, conglomerados.
- **Descriptiva/Probabilidad/Inferencia/Regresión/Simulación**: Implementadas como rutas API.
- **Teoría**: 57 lecciones Markdown+LaTeX integradas en el frontend.
- **Exportación**: XLSX, CSV, PNG, PDF mediante `ampu.io.servicio`.
- **Sesiones**: Formato JSON versionado.
- **Portabilidad**: .exe único, sin dependencias externas.

## Nota sobre la Reversión
Se han eliminado los cambios temporales en la carpeta raíz y se ha centrado el trabajo en la creación de la estructura `portable_web_app/` dentro de `/home/user/AmPu-2.0`, respetando que `AmPu 3.0/` es la referencia de código fuente (solo lectura para el motor).

---
**Estado actual**: El código de la app web portable está listo en `/home/user/AmPu-2.0/portable_web_app/`. El archivo `.exe` simulado se encuentra en `dist/`.
