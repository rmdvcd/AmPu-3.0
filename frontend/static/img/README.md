# Icono de AmPu

`icono_ampu.png` es el archivo original, sin modificaciones, de **AmPu 2.0**:

- Origen: [`rmdvcd/AmPu-2.0/src/ImgVisual/icono_ampu.png`](https://github.com/rmdvcd/AmPu-2.0/blob/d498ea869581457df720e243ea5944748d68441a/src/ImgVisual/icono_ampu.png).
- Revisión consultada: `d498ea869581457df720e243ea5944748d68441a`.
- SHA del blob Git: `1b421b28d75808bf1be34e44e6620525226235d9`.
- SHA-256 del PNG: `8f9b98806e73b7d8318c75089dc7830c3848ce143cd2c16581a158e1b2d084c6`.
- Tamaño original: 1024 × 745 píxeles, RGBA.

La marca lateral usa este PNG con `object-fit: contain`: no cambia su proporción,
transparencia ni colores al alternar el tema.

Desde la raíz se regeneran los derivados locales con:

```bash
PYTHONPATH=vendor python3 scripts/generar_iconos.py
```

`../favicon.svg` contiene el PNG original dentro de un lienzo cuadrado, centrado
sin deformar la imagen. `../favicon.ico` añade únicamente márgenes transparentes
y tamaños de 16, 24, 32, 48, 64, 128 y 256 píxeles; lo usan el navegador y
PyInstaller para el icono del ejecutable de Windows. No es necesario acceder a
Internet para regenerarlos ni ejecutar la app.
