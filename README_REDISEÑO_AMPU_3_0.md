# AmPu 3.1 · auditoría y rediseño de la interfaz

Este documento resume qué se encontró al auditar el proyecto y qué decisiones se
tomaron para convertirlo en un asistente matemático web coherente, accesible y
verificable. El código es la fuente de verdad; aquí queda el criterio.

## Punto de partida

La aplicación tenía un backend Flask sólido y un motor estadístico completo, pero
la capa web era un prototipo:

- `frontend/index.html` era un documento monolítico con estilos y lógica
  embebidos; `frontend/style.css` y `frontend/script.js` concentraban toda la
  interfaz en dos archivos difíciles de mantener.
- La navegación no conservaba estado, no había rutas profundas ni una noción
  clara de “dónde estoy”.
- Los formularios dependían de campos escritos a mano; los errores del motor se
  mostraban como texto genérico y no se asociaban al campo culpable.
- Los gráficos se generaban como PNG en el servidor, sin tooltip, sin teclado y
  sin tabla equivalente.
- No existía un sistema de preferencias coherente (tema, densidad, decimales,
  notación, movimiento reducido) ni una forma de exportar el estado.
- Había funciones muertas, dependencias no usadas y un `.exe` de 0 bytes
  presentado como artefacto final.

## Arquitectura elegida

### Shell y router

`frontend/index.html` queda como esqueleto semántico: enlace de salto, barra de
carga, barra lateral, cabecera, `main`, pie, región de avisos, raíz de modales y
región `aria-live`. `app.js` es el único punto de arranque y se encarga de:

- rutas por hash (`#/vista/parametro`) con normalización y rutas profundas;
- carga diferida de cada vista y destrucción de la anterior (abortar peticiones,
  desconectar observadores);
- barra lateral responsive, tema, densidad, movimiento reducido y estado del
  motor;
- paleta de comandos con ranking por título, tipo y palabras clave;
- ayuda, atajos de teclado y anuncios para lectores de pantalla.

### Vistas

Cada vista es un módulo ES que exporta `montar(host, parametro)` y devuelve una
función de limpieza opcional. La vista no toca el documento global: construye su
propio árbol y usa componentes compartidos. Esto permite cargar solo lo necesario
y mantener el estado local de cada herramienta.

### Componentes

`ui.js` concentra el lenguaje visual y de interacción: paneles, KPIs, tablas con
scroll y cabecera fija, alertas, veredictos, pestañas, chips, campos con ayuda y
error, estados vacíos, modales, toasts, carga y formato numérico `es-ES`
(incluidos `∞`, `−∞`, `NaN` y p-valores). `chart.js` dibuja SVG propio con
tooltip, leyenda conmutables, navegación por teclado y tabla de datos
equivalente; no hay librerías de gráficos ni CDN.

`params.js` genera los campos de una distribución desde `/api/meta`, de modo que
la interfaz y el motor comparten una única definición de parámetros, tipos y
rangos. `campo()` distingue número, entero, serie, matriz, select, checkbox y
texto; los valores numéricos aceptan coma decimal y los errores se anuncian con
`aria-invalid` y `role="alert"`.

## Decisiones de UX e IX

1. **Primero la tarea, después la herramienta.** La portada pregunta “¿qué
   quieres hacer?” y ofrece rutas según el momento del usuario, no un catálogo
   plano de módulos.
2. **Una sola dirección de lectura.** Cabecera de vista → formulario validado →
   resultado → interpretación → exportación. Los resultados no aparecen antes de
   que el usuario ejecute el cálculo.
3. **Validación antes de la red.** Las dimensiones de X/Y, los tamaños de muestra,
   los estratos, las probabilidades y los parámetros se comprueban en el cliente;
   el servidor vuelve a validar y responde con `{error, campo, tipo}`.
4. **El resultado se explica.** Cada salida incluye una lectura en lenguaje claro,
   supuestos y límites (extrapolación, asociación vs. causalidad, p-valor vs.
   tamaño del efecto, potencia del ajuste).
5. **Continuidad entre herramientas.** Una muestra descriptiva puede enviarse a
   inferencia o a ajuste; una distribución puede enviarse a simulación. El
   tránsito se hace por `store.transito`, no copiando datos a mano.
6. **Reproducibilidad.** Muestreo y simulación muestran y permiten fijar la
   semilla; las exportaciones incluyen el estado suficiente para repetir el
   cálculo.
7. **Accesibilidad.** Foco visible, `skip-link`, etiquetas asociadas, errores
   anunciados, diálogos nativos, contraste en ambos temas, objetivos táctiles de
   38 px, `prefers-reduced-motion` y respeto de la preferencia del sistema.
8. **Responsive real.** La barra lateral se convierte en panel deslizante,
   las rejillas colapsan, las tablas hacen scroll y los formularios de hipótesis
   y estratos reorganizan sus columnas sin perder el botón de eliminar.

## Correcciones de cálculo y contrato

Durante la auditoría se corrigieron, entre otros:

- la selección de `<select>` recibía el valor antes de tener opciones y quedaba
  siempre en el placeholder;
- `/api/regresion` interpretaba `predecir` con el parser de predictores y
  rechazaba el ejemplo múltiple; ahora acepta filas, lista plana o texto y valida
  el ancho;
- probabilidad condicional, Bayes y variables discretas ahora rechazan
  probabilidades fuera de `[0, 1]` y aseguran `P(A ∩ B) ≤ P(B)`;
- el cálculo del tamaño muestral ya muestra su resultado (el host no estaba
  montado en el panel);
- los rangos de histograma y los nombres de columnas de exportación se alinearon
  con el contrato real del motor;
- el botón “Conglomerados” parte de un número de grupos válido y los estratos
  conservan la alineación de columnas en móvil;
- la densidad de la interfaz y los decimales 0 se guardan correctamente;
- el tema elegido en Ajustes ya no se pierde al recargar por una copia remota de
  preferencias;
- las exportaciones de simulación (PDF) se añadieron a π, integrales, muestras,
  ajustes y QQ-plot;
- `main.py`, `build_exe.py` y la documentación dejaron de describir archivos
  eliminados y el `.exe` falso se retiró.

## Verificación

- `tests/test_api.py`: 11 pruebas de integración con valores de referencia
  (normal, combinatoria, descriptiva, Bayes, regresión, tamaños, diseños,
  Monte Carlo y validación condicional).
- Auditoría DOM con jsdom sobre las 10 vistas: cálculo de distribución, las 13
  pruebas de inferencia con veredicto, los cuatro instrumentos de probabilidad,
  los siete diseños de muestreo, los cinco modos de simulación, QQ-plot,
  navegación de teoría, cambio de tema, paleta, ayuda y rutas profundas.
- Revisión de contratos de exportación PDF/XLSX/PNG/CSV contra
  `/api/exportar`.

## Límites conocidos

- El servidor es el de desarrollo de Flask; para uso multiusuario habría que
  poner un WSGI de producción delante.
- El catálogo científico y las fórmulas provienen del motor; la interfaz no
  sustituye la revisión de un especialista.
- La exportación Excel limita las filas visibles por diseño; el PDF prioriza la
  legibilidad sobre volcar series enormes.
