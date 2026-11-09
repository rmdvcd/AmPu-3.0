# Requisitos para la App Web Portable AmPu 3.0 (Python + PyInstaller)

## Estructura
- `portable_web_app/`
  - `app.py` (Backend Flask)
  - `main.py` (Arrancador .exe)
  - `build_exe.py` (Script PyInstaller)
  - `requirements.txt`
  - `frontend/`
    - `index.html`
    - `style.css`
    - `script.js`
  - `engine/` (Copia de `AmPu 3.0/src/ampu` - solo lógica, sin UI Dear PyGui)
  - `vendor/` (Dependencias instaladas)
  - `dist/ampu_portable.exe` (Resultado)

## Dependencias
- Flask==3.0.0
- Werkzeug==3.0.0
- NumPy==1.26.0
- Pandas==2.1.0
- SciPy==1.11.0
- Matplotlib==3.8.0
- Openpyxl==3.1.2
- ReportLab==4.0.5
- PyInstaller==6.3.0
- Markdown==3.5.1

## Flujo de Funcionamiento
1. El usuario ejecuta `ampu_portable.exe`.
2. `main.py` inicia el servidor Flask en `127.0.0.1:5000` (hilo secundario).
3. `main.py` abre el navegador en `http://127.0.0.1:5000`.
4. El frontend (HTML/JS/CSS) se carga y solicita datos al backend (API REST).
5. El backend (Flask) llama al motor AmPu 3.0 (`ampu.core.*`, `ampu.io.*`, etc.) y devuelve resultados JSON.
6. El frontend renderiza los resultados (Gráficos Matplotlib -> PNG base64, Tablas -> HTML, PDF/Excel -> Descarga).

## Adaptación de la Lógica AmPu 3.0
- **Motor Estadístico**: Se mantiene intacto (`ampu.core`, `ampu.io`, `ampu.docs`).
- **UI Dear PyGui**: Se sustituye por el Frontend Web. Los métodos de `VistaDistribuciones`, `VistaDescriptiva`, etc., se adaptan a rutas de API.
- **Exportación**: Genera archivos temporales en el directorio del `.exe` y los envía al navegador.
- **Teoría**: 57 lecciones Markdown+LaTeX convertidas a HTML/KaTeX.

## Cumplimiento del Plan (PLAN.md) y Migración (MIGRACION.md)
- **Distribuciones**: 26 modelos (SciPy) con validación de metadatos.
- **Muestreo**: Diseños finito, infinito, estratificado, sistemático, conglomerados.
- **Descriptiva/Probabilidad/Inferencia/Regresión/Simulación**: Implementadas como rutas API.
- **Exportación**: XLSX, CSV, PNG, PDF mediante `ampu.io.servicio`.
- **Sesiones**: Formato JSON versionado.
- **Portabilidad**: .exe único, sin dependencias externas.

## Instrucciones para el Usuario
1. Ejecutar `ampu_portable.exe` en `/home/user/AmPu-2.0/portable_web_app/dist/`.
2. El servidor Flask se inicia en `http://127.0.0.1:5000`.
3. El navegador se abre automáticamente.
4. La app es portable: se puede copiar a cualquier USB o carpeta.
