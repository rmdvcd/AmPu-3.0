name: math-ix
description: >-
  Guía de interacción (IX) para un Asistente Matemático. Úsala al implementar
  autocompletado de expresiones, gráficas interactivas (zoom, pan, arrastre de
  puntos), animación de pasos de solución, entrada por teclado matemático y
  feedback de validación en vivo. Cubre throttling, cancelación de cálculos,
  alternativas a gestos y reduced-motion.
---

# IX del Asistente Matemático: Entrada, Gráficas Interactivas y Animación de Pasos

Esta skill define cómo responde la interfaz del asistente matemático a la interacción del usuario. Mientras `math-ui` define el renderizado y `math-ux` el flujo, **`math-ix` define el timing, la física y la respuesta directa a la entrada**.

## 1. Validación en vivo vs. cálculo bajo demanda

- **Validación de sintaxis en vivo con throttle de 300 ms.** El parser debe marcar el error en <100 ms tras el throttle, pero **no debe calcular el resultado** hasta que el usuario lo pida o pause la escritura durante 1.5 s.
- **Cancelación de cálculos en curso.** Si el usuario cambia la expresión mientras se calcula, cancela el cálculo anterior (`AbortController` en Web, `QThread`/`asyncio` con cancelación en Python). Un resultado que llega tarde y pisa uno más reciente es un bug de UX.
- **Indicador de progreso para cálculos lentos:** a partir de 500 ms, muestra un spinner inline junto al resultado. A partir de 3 s, muestra el tipo de cálculo en curso (“Simplificando…”, “Integrando…”).

## 2. Autocompletado y teclado matemático

- El autocompletado debe priorizar **funciones y constantes** (`sin`, `cos`, `π`, `√`) y respetar el contexto: tras `d/dx` sugiere variables, no funciones.
- El teclado matemático (barra de símbolos) debe ser **operable con teclado físico** y anunciar cada símbolo con su nombre al lector de pantalla.
- Atajos de teclado en Desktop: `Ctrl+Enter` para resolver, `Ctrl+Shift+G` para graficar, `Esc` para cancelar el cálculo en curso. Documenta los atajos en un diálogo accesible desde `F1`.

## 3. Gráficas interactivas

La gráfica no es una imagen estática: es el segundo canal de exploración matemática.

- **Zoom y pan:** responde a scroll y arrastre, pero **ofrece también botones** (`+`, `−`, reset) y flechas de teclado. WCAG 2.5.7 exige alternativa de un solo puntero a cualquier gesto.
- **Arrastre de puntos:** si el usuario puede mover un punto sobre la curva, muestra las coordenadas en tiempo real y ofrece campos numéricos para introducirlas directamente.
- **Trazado de valores:** al pasar el cursor o el foco sobre la curva, muestra `(x, y)` con precisión configurable. En táctil, un toque mantenido activa el trazado.
- **Animación de transformaciones:** cuando el usuario cambia un parámetro (ej. `a` en `a·sin(x)`), anima la transición con duración ≤ 300 ms y `.spring` suave. Bajo `prefers-reduced-motion`, salta directamente al nuevo estado.

## 4. Animación de pasos de solución

- Los pasos se revelan con `fadeIn + expandVertically` de 200 ms. No uses animaciones de más de 300 ms en un flujo que el usuario recorre paso a paso.
- El paso activo se resalta con un borde o fondo sutil; el resto se atenúa ligeramente para mantener el foco.
- Si el usuario navega con teclado, el foco sigue al paso revelado y el lector de pantalla anuncia el número de paso y la regla aplicada.
- Bajo `prefers-reduced-motion`, los pasos aparecen instantáneamente sin expansión.

## 5. Feedback de error y corrección

- El subrayado de error de sintaxis aparece en <100 ms tras el throttle; el mensaje detallado aparece al perder el foco o al intentar resolver.
- Al corregir, el subrayado desaparece de inmediato, sin esperar a un nuevo cálculo.
- En gráficas, si la función tiene una discontinuidad, marca el punto con un círculo hueco y una etiqueta (“asíntota en x = 0”), sin animación que oculte el dato.

## 6. Checklist de IX

- [ ] ¿La validación en vivo tiene throttle de ~300 ms y no dispara cálculos costosos?
- [ ] ¿Los cálculos en curso se cancelan cuando la expresión cambia?
- [ ] ¿Hay indicador de progreso a partir de 500 ms y descripción del cálculo a partir de 3 s?
- [ ] ¿Zoom, pan y arrastre tienen alternativa de botones o teclado?
- [ ] ¿Las animaciones de parámetros duran ≤ 300 ms y respetan `prefers-reduced-motion`?
- [ ] ¿Los pasos revelados mueven el foco y se anuncian al lector de pantalla?
- [ ] ¿El subrayado de error desaparece al corregir el campo?