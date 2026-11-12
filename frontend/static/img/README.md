# Icono de AmPu

`icono_ampu.png` es la identidad visual modernizada de **AmPu**:

- Diseño acorde a las mejores prácticas: contenedor de esquinas redondeadas (squircle), paleta corporativa en verde azulado (`#0b4a42` y `#4ad4c0`), curva gaussiana de densidad de probabilidad y monograma geométrico «AmPu» (letras A y P con marcas de desviación típica $\pm\sigma$ y nodo central $\mu$).
- SHA-256 del PNG: `d6d5d4a82fa8dec4e450346aca3979b8744649f8d4a206d6f76a70bb609f9254`.
- Tamaño: 1024 × 745 píxeles, RGBA con antialiasing por supermuestreo 4x y esquinas transparentes.

La marca lateral usa este PNG con `object-fit: contain`: no cambia su proporción,
transparencia ni colores al alternar el tema.

Desde la raíz se regeneran los derivados locales con:

```bash
python3 scripts/generar_iconos.py
```

`../favicon.svg` contiene el PNG dentro de un lienzo cuadrado, centrado
sin deformar la imagen. `../favicon.ico` añade únicamente márgenes transparentes
y tamaños de 16, 24, 32, 48, 64, 128 y 256 píxeles; lo usan el navegador y
PyInstaller para el icono del ejecutable de Windows. No es necesario acceder a
Internet para regenerarlos ni ejecutar la app.
