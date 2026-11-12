# AmPu - Aplicación de Estadísticas y Probabilidad

## Estado de la compilación y pruebas ✅

### Compilación ejecutable
El proyecto se ha compilado exitosamente en un ejecutable independiente de Windows:

- **Ruta**: `dist/ampu_portable_3_0.exe` (144.5 MB)
- **Comando**: `python build_exe.py`
- **Estado**: ✅ Éxito - Archivo único con todas las dependencias incluidas

El ejecutable incluye:
- Servidor Flask con Waitress WSGI
- Motor estadístico completo (ampu engine)
- Interfaz frontal (HTML/JS/CSS)
- KaTeX para renderizado matemático
- Exportación a PDF/Excel
- Todas las librerías: numpy, scipy, pandas, matplotlib, PyQt6, openpyxl, reportlab, markdown

### Ejecución
La aplicación se inicia y ejecuta correctamente:

```
$ python main.py
2026-11-11 19:37:19,629 [INFO] Serving on http://127.0.0.1:5000
AmPu 3.2.0 disponible en http://127.0.0.1:5000
Pulsa Ctrl+C para cerrar.
```

El servidor Flask+Waitress está disponible en `http://127.0.0.1:5000`.

### Pruebas automatizadas
Se ejecutó el suite completo de pruebas:

```
$ python -m pytest tests/ -v
```

**Resultados**: ✅ **74 pruebas aprobadas, 96 subpruebas aprobadas**

Todas las categorías de pruebas pasaron:
- **test_api.py**: 12 tests - APIs de distribuciones, simulaciones, validación
- **test_entrada.py**: 7 tests - Manejo de vectores, matrices, JSON
- **test_icono.py**: 5 tests - Íconos y recursos para PyInstaller
- **test_leyendas_exportacion.py**: 5 tests - Exportación PNG/PDF con leyendas
- **test_navegación.py**: 1 test - Barra lateral
- **test_regresiones.py**: 34 tests - Pruebas de regresión, inferencia, probabilidad, simulación, descriptiva, errores
- **test_seguridad.py**: 5 tests - Seguridad, cabeceras, exportación neutralizada

## Uso del ejecutable

El archivo `dist/ampu_portable_3_0.exe` es un ejecutable standalone de Windows que:

1. Inicia el servidor en `http://127.0.0.1:5000` por defecto
2. Abre el navegador automáticamente (se puede desactivar con `AMPU_NO_BROWSER=1`)
3. Proporciona la interfaz completa de estadísticas y probabilidad
4. Funciona offline sin necesidad de instalación de Python

## Variables de entorno

- `AMPU_HOST` - Dirección host (default: `127.0.0.1`)
- `PORT` - Puerto (default: `5000`)
- `AMPU_NO_BROWSER=1` - Evitar apertura automática de navegador

## Arquitectura del proyecto

```
AmPu-3.0/
├── build_exe.py          # Script PyInstaller para compilación
├── main.py               # Punto de entrada Flask + Waitress
├── app.py                # Aplicación Flask con todas las rutas API
├── requirements.txt      # Dependencias Python
├── requirements-build.txt # Dependencias para build
├── vendor/               # Dependencias empaquetadas para PyInstaller
├── engine/ampu/          # Motor estadístico core
├── frontend/             # Interfaz web HTML/JS/CSS
├── dist/ampu_portable_3_0.exe  # Ejecutable compilado (generado)
└── tests/                # Suite de 74 tests automatizados
```