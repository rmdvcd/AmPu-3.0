---
name: math-ui
description: >-
  Guía de UI para un Asistente Matemático multiplataforma (Python backend,
  frontend Web y Desktop). Úsala al crear o revisar la entrada de expresiones,
  el renderizado de fórmulas (KaTeX/MathJax), la visualización de gráficas
  (Plotly/Matplotlib) y el layout de resultados paso a paso. Cubre tipografía
  matemática, MathML accesible, contraste en gráficas y responsive de fórmulas
  largas.
---

# UI del Asistente Matemático: Entrada, Renderizado y Gráficas

Esta skill define cómo debe verse y componerse la interfaz de un asistente matemático. El objetivo es que una expresión escrita por el usuario se transforme en una **fórmula legible, una solución paso a paso y una gráfica interactiva**, sin ambigüedad visual y sin excluir a usuarios con lectores de pantalla.

## 1. Entrada de expresiones matemáticas

Un asistente matemático recibe entrada por tres canales, y cada uno exige un tratamiento distinto:

| Canal | Componente recomendado | Reglas |
|---|---|---|
| **Teclado / texto** | `<textarea>` o `contenteditable` con autocompletado | Acepta LaTeX y notación natural (`sin(x)^2`); muestra preview en vivo |
| **Editor visual (WYSIWYG)** | MathLive / MathQuill (Web); MathKey (Desktop) | Ofrece una barra de símbolos accesible por teclado; no bloquea el pegado de LaTeX |
| **Escritura a mano** | Canvas con reconocimiento (MyScript / MathPix) | Siempre ofrece “corregir como texto” para revisar y editar la interpretación |

**Regla de tolerancia:** el parser debe aceptar variantes comunes (`*` implícito, `^` como potencia, `sen`/`sin`, `π`/`pi`). Si la expresión es ambigua, muestra la interpretación canónica antes de calcular: `sin(x)^2` → `\sin^2(x)`, no calcules en silencio la interpretación equivocada.

## 2. Renderizado de fórmulas

- Usa **KaTeX** para renderizado en Web (más rápido que MathJax y suficiente para el 99% de expresiones). Usa **MathJax** solo si necesitas extensiones avanzadas (comandos AMS, entornos multilínea complejos).
- En Desktop (PyQt/PySide), renderiza fórmulas como **imágenes SVG** generadas con KaTeX server-side o Matplotlib mathtext. No uses widgets de texto con unicode para fórmulas complejas: la tipografía no escala y los subíndices se rompen.
- **Tamaño y legibilidad:** la fórmula debe renderizarse con un tamaño mínimo equivalente a 16 px; en pantallas pequeñas, permite scroll horizontal antes que reducir la fuente.
- **Fórmulas largas:** envuelve en un contenedor con `overflow-x: auto` y una máscara de degradado en el borde. Nunca rompas una fórmula a la mitad.

## 3. Accesibilidad matemática

Una fórmula renderizada como SVG o KaTeX es opaca para un lector de pantalla. Debes proporcionar una **representación textual equivalente**:

- Genera el **MathML** (KaTeX puede emitirlo con `output: "mathml"` como fallback) o un `aria-label` con la expresión en notación hablada (speech rule): `aria-label="seno al cuadrado de x"`.
- Para cada paso de la solución, incluye un texto descriptivo: “Paso 2: aplicamos la regla de la cadena a `f(g(x))`”.
- En gráficas, proporciona una **tabla de datos alternativa** (colapsable) y un `aria-describedby` que resuma la tendencia: “La función es creciente en (-∞, 0) y decreciente en (0, ∞)”.

## 4. Gráficas y visualización

- Usa **Plotly** en Web (interactivo, accesible por teclado en gran medida) y **Matplotlib** en Desktop con backend Qt. Evita gráficas puramente decorativas.
- **Contraste:** ejes y etiquetas con contraste ≥ 4.5:1 sobre el fondo; líneas de la función con ≥ 3:1. No dependas solo del color para distinguir múltiples funciones: usa estilos de línea distintos (`solid`, `dashed`, `dotted`) y una leyenda clara.
- **Zoom y pan accesibles:** los controles de zoom deben ser botones (no solo scroll) y la gráfica debe responder a teclado (`+`, `-`, flechas).
- **Dominio de la función:** indica claramente los cortes y asíntotas; una gráfica de `1/x` sin marcar `x=0` es una gráfica incorrecta.

## 5. Layout de resultados paso a paso

- El resultado final va **primero y destacado**, seguido de los pasos colapsables. El usuario quiere la respuesta, no leer 12 líneas para llegar a ella.
- Cada paso debe mostrar la expresión **antes** y **después** de la transformación, con la regla aplicada como etiqueta (`Factorización`, `Regla de la cadena`, `Sustitución`).
- Usa una tipografía monoespaciada para la notación intermedia y la matemática renderizada para la expresión formal. No mezcles ambas en la misma línea.
- En pantallas pequeñas, los pasos se apilan verticalmente; en desktop, pueden mostrarse en dos columnas (paso a paso + gráfica).

## 6. Checklist de UI

- [ ] ¿La entrada acepta LaTeX, notación natural y muestra preview en vivo?
- [ ] ¿Se muestra la interpretación canónica antes de calcular si la expresión es ambigua?
- [ ] ¿Las fórmulas se renderizan con KaTeX (Web) o SVG (Desktop) con tamaño mínimo legible?
- [ ] ¿Cada fórmula tiene MathML o `aria-label` con notación hablada?
- [ ] ¿Las gráficas distinguen funciones por estilo de línea además de color y ofrecen tabla de datos alternativa?
- [ ] ¿El resultado final aparece antes que los pasos y estos son colapsables?
- [ ] ¿Las fórmulas largas hacen scroll horizontal en lugar de romperse o reducirse?