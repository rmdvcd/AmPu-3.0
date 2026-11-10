# Auditoría de AmPu 3.1 y plan de cambios

Auditoría del proyecto contra las cuatro skills adjuntas (`math-engine`, `math-ui`, `math-ux`, `math-ix`), con un plan de cambios priorizado. Las secciones 1 a 5 son la auditoría original de la versión 3.1 y se conservan sin cambios; la **sección 0** resume qué se ha corregido en la versión 3.2 y qué sigue abierto.

## 0. Estado tras la implementación (AmPu 3.2)

**Cómo se ha comprobado.** 63 pruebas de Python (`tests/`, incluida una por hallazgo E1–E19 en `tests/test_regresiones.py`) y 43 de Node para el lector de entrada del navegador; todas pasan con `./scripts/probar.sh`. Las diez vistas se han ejercitado montándolas en Node con jsdom contra el servidor real (ejemplos, errores de validación y errores del servidor), sin excepciones. **No se ha podido abrir un navegador real**: el aspecto visual, el contraste efectivo, el zoom con ratón y el comportamiento con lector de pantalla están sin comprobar a ojo.

### Resultados y motor

| ID | Estado | Qué se hizo |
|---|---|---|
| E1 | Resuelto | Sin redondeo a 12 decimales; p y colas pequeñas en notación científica («4,83 × 10⁻³²»), nunca `0`. |
| E2 | Resuelto | Curva nula por prueba (t, normal, χ², F con sus grados de libertad); sin curva en las pruebas exactas, con explicación. |
| E3 | Resuelto | La alternativa se aplica donde tiene sentido; χ², ANOVA y Kruskal no muestran el selector y la API la rechaza. |
| E4 | Resuelto | H₀ y H₁ generadas según la alternativa; intervalo unilateral cuando el contraste lo es. |
| E5 | Resuelto | Valor exacto, error y nota calculados para el intervalo pedido; dominio validado. |
| E6 | Resuelto | Un solo lector (Python y JavaScript, con vectores compartidos). Coma o punto decimal; lo ambiguo se rechaza con posición y sugerencia; vista previa de lo leído bajo el campo. |
| E7, E8 | Resuelto | Bigotes en el dato extremo dentro de las vallas; sin moda si todos los valores son distintos. |
| E9 | Resuelto | Fracciones y decimales cortos con aritmética exacta (`Fraction`); una sola tolerancia (10⁻⁹) para números en coma flotante; el mensaje enseña la suma real. **Falta** el botón «Normalizar para que sumen 1». |
| E10 | Resuelto | Enteros exactos hasta 10 000 cifras; por encima, orden de magnitud marcado como aproximado. Entradas acotadas. |
| E11 | Resuelto | Cambio automático a binomial exacta, Fisher, Mann‑Whitney y Wilcoxon exactas cuando la aproximación no es fiable, siempre con aviso. |
| E12 | Resuelto | Ajuste determinista (estimadores cerrados o MLE de SciPy); no depende de la semilla. |
| E13 | Resuelto | F global, VIF, número de condición, Shapiro–Wilk, Breusch–Pagan, Durbin–Watson, Cook, intervalos de la media y de predicción, aviso de extrapolación; `significativo` según la confianza. |
| E14 | Resuelto | Intervalo y banda de convergencia con el cuantil de la confianza elegida; el texto dice el nivel real. |
| E15 | Resuelto | Parámetros desconocidos o ausentes: error que nombra los admitidos. |
| E16 | Resuelto | Errores tipados y en español, con `campo`, `sugerencia` y `posicion`; magnitudes > 10¹⁵⁰ se rechazan en vez de devolver «∞». |
| E17 | **Parcial** | CDF y ECDF en escalón; histogramas en el eje real, alineados con la curva teórica (antes la curva se dibujaba en otro eje); discretas con clases enteras. **Pendiente:** rejilla por cuantiles para Cauchy/t(1) y marca de asíntota. |
| E18 | Resuelto | P(a ≤ X ≤ b) con funciones de supervivencia en la cola derecha. |
| E19 | Resuelto | Sesgo y curtosis `null` con n insuficiente; nivel del IC declarado; interpretación reescrita. |
| E21 | **Parcial** | Waitress en lugar del servidor de desarrollo; cotas de tamaño en todas las entradas; control de plazo cooperativo y registro de cálculos lentos; plazo de 30 s y `Esc` en el cliente. **No hay** interrupción forzosa de un cálculo ya en marcha en el servidor (requiere procesos trabajadores). |

### Seguridad, interfaz y mantenimiento

| ID | Estado | Qué se hizo |
|---|---|---|
| S1 | Resuelto | Flask 3.1.3, Werkzeug 3.1.9, Markdown 3.11.3. |
| S2 | **Parcial** | CSP sin scripts en línea, `nosniff`, `X-Frame-Options`, validación de `Host` y de `Origin`. **Pendiente:** saneador de lecciones por lista de permitidos. |
| U1 | Resuelto (por cálculo) | `--texto-3` a #526b78 (≥ 4,96:1) en claro y #8aa5b3 (≥ 5,31:1) en oscuro. |
| U2, U3, U4 | Resuelto | Trazo y marcador por serie; zoom y desplazamiento con botones y teclado; lectura anunciada; tabla alternativa también en el diagrama de caja. |
| U6 | Resuelto | Un error en cálculo automático se muestra y el resultado anterior queda marcado como desactualizado. |
| U7 | Resuelto | Los errores de validación y del servidor aparecen junto al campo o la celda culpable, no en un aviso efímero. |
| U8, U10, U12 | Resuelto | `F1`, `Esc`, `Alt+G`; pestañas con patrón ARIA completo; la semilla 0 se respeta. |
| U5, U9, U11 | **Pendiente** | Fórmulas de las tarjetas mini, regiones `aria-live` demasiado amplias y tamaños tipográficos mínimos. |
| M1, M2 | Resuelto | `vendor/`, `build_temp/` y los `.pyc` ya no se versionan: de 28 252 archivos a 182 (commit «Deja de versionar vendor/, build_temp/ y bytecode»). Las dependencias se instalan con `pip install --target vendor --no-compile -r requirements.txt`; comprobado en una copia limpia (instalación desde cero, las 63 pruebas, KaTeX y las exportaciones a PDF, Excel y PNG). SciPy pasa de 1.11.0 a 1.11.4 porque la 1.11.0 fue retirada de PyPI. |
| M3 | **Pendiente** | `app.py` sigue siendo un único módulo (≈ 2 500 líneas). |
| M4 | Resuelto en parte | De 11 a 63 pruebas de Python más 43 de Node. Sin integración continua ni pruebas en navegador. |
| M5 | Resuelto en parte | Decisión D1: AmPu **no acepta expresiones libres**. Eliminados `core/estadistica/calculadora.py` (evaluador de expresiones) y `docs/expresiones.py` (vista previa de LaTeX), que no se usaban; una prueba impide que vuelva a entrar un evaluador (`eval`, `exec`, `ast.parse`, `sympify`). Docstrings obsoletos corregidos. **Pendiente:** `docs/teoria.py` conserva `renderizar` y su copia de `_preservar_matematicas`, que la aplicación web no usa. |
| M6 | **Parcial** | Versión 3.2 en la aplicación; dependencias de ejecución y de build separadas. El ejecutable sigue llamándose `ampu_portable_3_0`. |
| M7 | **Pendiente** | Formato de `math-ux.md` y `math-ix.md` sin tocar. |

### Del plan, sin hacer

- **4.2 «Verificar»** con un método independiente: no implementado.
- **4.3 exacto frente a aproximado:** hecho en probabilidad y combinatoria; no en las distribuciones discretas.
- **4.4 alta precisión con mpmath** para colas extremas: no; mpmath solo se usa en combinatoria. **SymPy no se añade**: sin expresiones libres (D1) no hace falta; las formas exactas usan `fractions.Fraction`.
- **4.5 pasos de la derivación** del estadístico: no implementado.
- **4.1 «Método y supuestos»:** inferencia y regresión lo muestran de forma estructurada; el resto de vistas solo una nota de método.

### Cambios de comportamiento que conviene conocer

- `1,2,3` ya no se lee como tres valores: se rechaza con la sugerencia de separar con espacios (el campo ofrece convertirlo). `1, 2, 3` (coma y espacio) sigue siendo válido.
- La aplicación solo responde a `127.0.0.1`/`localhost` y no se puede incrustar en un `iframe`, salvo con `AMPU_HOSTS_PERMITIDOS` y `AMPU_PERMITIR_IFRAME=1`.
- Las pruebas χ² 2×2, de proporciones y de rangos pueden devolver ahora un p‑valor distinto del de la versión 3.1 cuando la aproximación no era fiable: se usa la prueba exacta y se avisa.

## 1. Conclusión

AmPu tiene una base sólida (validación centralizada, errores tipados, sin `eval`, KaTeX local con MathML, gráficos con tabla alternativa, cancelación de peticiones), pero hoy **muestra resultados incorrectos o engañosos en varios caminos de uso normal**, y eso es lo primero que hay que arreglar:

1. **Los p‑valores y colas pequeños se convierten en `0`.** La API redondea todo a 12 decimales y la interfaz lo etiqueta como «p‑valor exacto».
2. **En 4 de las 13 pruebas la gráfica contradice al veredicto.** Mann‑Whitney, Wilcoxon, Kruskal‑Wallis y correlación dibujan el estadístico sobre una distribución que no le corresponde.
3. **La hipótesis alternativa se ignora en 7 de las 13 pruebas**, aunque el selector se muestra en todas y la respuesta devuelve la alternativa pedida.
4. **La coma decimal se interpreta en silencio de formas distintas según la pantalla.** En Inferencia, `12,4 11,8 13,1 12,9` se analiza como 8 observaciones en vez de 4.
5. **La integral Monte Carlo con límites propios muestra un «valor exacto» que pertenece a otro intervalo.**

El resto de hallazgos son de menor gravedad: robustez (sin timeouts, combinatoria sin cotas), transparencia (método, supuestos y error no siempre declarados; no existe «Verificar»), gráficas (sin zoom, series distinguidas solo por color, contraste insuficiente en etiquetas) y mantenimiento (28 252 archivos versionados, de los que 182 son el proyecto).

### Qué se ha comprobado y qué no

| Ámbito | Cómo se ha comprobado |
|---|---|
| Motor y API (`engine/ampu/**`, `app.py`) | Lectura completa y ejecución de unos 90 casos límite contra la API con el cliente de pruebas de Flask. Los hallazgos de la sección 3 están reproducidos, salvo los marcados «lectura». |
| Analizadores de entrada del frontend | Ejecutados en Node con casos ambiguos. |
| Contraste de color | Calculado (WCAG) a partir de los tokens de `app.css`. |
| Resto del frontend (`ui.js`, `chart.js`, vistas, CSS) | Lectura de código. **No se ha abierto la aplicación en un navegador**: no hay comprobación visual, ni con lector de pantalla, ni de teclado real. |
| Pruebas existentes | 11/11 pasan (`tests/test_api.py`). Ninguna cubre los fallos de la sección 3. |
| Dependencias | Avisos de seguridad consultados en PyPI hoy (10‑11‑2026). No se ha analizado si son explotables en AmPu. |

### Cómo se han aplicado las skills

Las skills describen un asistente matemático con **entrada libre de expresiones** (parser, LaTeX, pasos de solución). AmPu es un laboratorio de estadística con **formularios**. He aplicado cada requisito a su equivalente y marcado «no aplica» donde no lo hay:

- «expresión» → series de datos, matrices y parámetros;
- «pasos de la solución» → derivación del estadístico (hoy no existe);
- «forma exacta» → probabilidades racionales, enteros exactos, p‑valores sin truncar.

## 2. Resultado por skill

Leyenda: ✅ cumple · ◐ parcial · ❌ no cumple · — no aplica.

### math-engine

| Requisito del checklist | Estado | Motivo |
|---|---|---|
| SymPy / NumPy‑SciPy / mpmath separados | ◐ | Solo NumPy/SciPy. No hay SymPy ni mpmath. La combinatoria sí usa enteros exactos. |
| Supuestos declarados y mostrados | ◐ | Cada prueba tiene `supuestos` y se muestran. Faltan convenciones: Welch, χ² sin corrección, método de cuartiles, IC siempre bilateral. |
| Soluciones verificadas por sustitución | — | No se resuelven ecuaciones. |
| Integrales impropias informan convergencia | — | Solo integrales en intervalo finito. `√(1−x²)` con b > 1 da un error genérico. |
| Resultados numéricos con método y error | ◐ | Monte Carlo da error estándar e IC. Distribuciones, ajustes y regresión no. |
| Redondeo solo en la presentación | ❌ | `round(f, 12)` en la serialización (E1). |
| Evaluación restringida, timeout y límites | ◐ | Sin `eval`/`exec` y con límites en casi todo. Ningún timeout; combinatoria sin cotas (E10). |
| Verificación independiente antes de mostrar | ❌ | No existe. |

### math-ui

| Requisito del checklist | Estado | Motivo |
|---|---|---|
| Entrada con LaTeX/notación natural y vista previa | — / ◐ | No hay expresiones. La única vista previa es un contador «N valores». |
| Interpretación canónica si hay ambigüedad | ❌ | La coma se interpreta en silencio (E6). |
| KaTeX con tamaño mínimo legible | ◐ | Correcto en fichas y lecciones. Las tarjetas mini quedan en ≈11 px. |
| MathML o `aria-label` por fórmula | ✅ | `output: "htmlAndMathml"`. |
| Series por estilo de línea + tabla alternativa | ◐ | Hay tabla colapsable, salvo en el diagrama de caja. Las series solo difieren en color. |
| Resultado primero, pasos colapsables | ◐ | El resultado va primero. No hay pasos. |
| Fórmulas largas con scroll horizontal | ◐ | Sí en `.formula-card`. Las tarjetas mini recortan con `overflow: hidden`. |

### math-ux

| Requisito del checklist | Estado | Motivo |
|---|---|---|
| Resultado antes que los pasos | ✅ | Veredicto y KPI arriba. |
| Ambigüedad interpretada y confirmada | ❌ | E6, E15. |
| Errores con posición y sugerencia | ◐ | El servidor indica posición en series de texto. `campo` llega siempre `null` y ninguna vista lo usa. Varias vistas avisan solo con un toast. |
| Exacto frente a aproximado | ❌ | «p‑valor exacto: 0» (E1). No hay marca ≈ salvo en Monte Carlo. |
| Motor y supuestos declarados | ◐ | Pie «motor NumPy/SciPy local» y `metodo` en pruebas. Falta en el resto. |
| Acción «Verificar» | ❌ | No existe. |
| Límites del motor con acción de recuperación | ❌ | Sin timeout; mensajes internos en inglés (E16). Sí hay botón «Reintentar». |

### math-ix

| Requisito del checklist | Estado | Motivo |
|---|---|---|
| Validación en vivo ~300 ms sin cálculos costosos | ◐ | Solo Distribuciones recalcula sola (espera de 420 ms). El resto valida al pulsar. |
| Cancelación de cálculos | ◐ | `AbortController` en 6 vistas; faltan Probabilidad y Simulación. El servidor sigue calculando. `Esc` no cancela. |
| Progreso desde 500 ms y descripción desde 3 s | ◐ | Indicador inmediato «Calculando…», sin describir el tipo de cálculo. |
| Zoom/pan con botones o teclado | ❌ | No hay zoom ni pan. |
| Animaciones ≤ 300 ms y `prefers-reduced-motion` | ◐ | Respetado en CSS y en preferencias. 7 desplazamientos `behavior: "smooth"` fijos lo ignoran. |
| Pasos revelados mueven foco y se anuncian | — | No hay pasos. Los resultados sí se anuncian. |
| El error desaparece al corregir | ✅ | `ui.js:572`. |

## 3. Hallazgos

Gravedad: **Crítica** = resultado incorrecto presentado como correcto · **Alta** = resultado engañoso o fallo en uso normal · **Media** · **Baja**.

### 3.1 Resultados incorrectos o engañosos

| ID | Gravedad | Hallazgo | Evidencia (entrada → obtenido / correcto) | Dónde |
|---|---|---|---|---|
| E1 | Crítica | Redondeo a 12 decimales en toda la salida. La nota de la respuesta afirma «precisión completa». | P(Z ≥ 8) → `0.0` / 6,22·10⁻¹⁶. Prueba t de dos muestras → `p_valor: 0.0` / 4,83·10⁻³² (el texto de conclusión sí lo trae bien). La vista lo muestra como «p‑valor exacto: 0». | `app.py:138`; `inferencia.js:616` |
| E2 | Crítica | Curva nula equivocada. U, W y H se dibujan sobre N(0,1) con críticos ±1,96; r se dibuja sobre t(n−2); Spearman sobre t(1). | Mann‑Whitney U = 0,5, p = 0,006, «rechaza», y la gráfica lo sitúa en zona de no rechazo. Kruskal H = 7,58 sobre N(0,1) / χ²(2). Pearson r = 0,998 sobre t(6) con críticos ±2,45. Spearman con críticos ±12,7. | `app.py:1249‑1296` |
| E3 | Crítica | La alternativa solo se aplica en 6 pruebas (z y t de una y dos muestras, proporciones). Las otras 7 la ignoran, pero el selector aparece siempre y la región sombreada cambia. | Mann‑Whitney con bilateral, menor y mayor → p = 0,006027 en los tres casos; la respuesta devuelve `alternativa: "less"` y sombrea la cola izquierda. Wilcoxon y correlación: igual (lectura). | `inferencia.py:210‑250`; `inferencia.js:289,351` |
| E4 | Alta | H₁ es un texto fijo («μ ≠ μ₀ (según alternativa)») y el IC es siempre bilateral aunque el contraste sea unilateral. | t una muestra, alternativa «mayor»: p = 0,023 con IC bilateral [12,01; 13,02] y H₁ «μ ≠ μ₀». | `app.py:532‑681`; `inferencia.py` |
| E5 | Crítica | Integral Monte Carlo con a, b propios: la referencia, el error y la nota siguen fijos al intervalo por defecto. | x² en [0, 2] → estimación 2,686 (correcto ≈ 8/3), «Valor exacto» 0,3333, error absoluto 2,35, nota «en [0, 1] vale 1/3». | `app.py:1720‑1747`; `simulacion.js:208‑209,285` |
| E6 | Crítica | Coma decimal interpretada en silencio y de forma distinta en cada pantalla (hay al menos 5 analizadores). La salida usa coma (es‑ES) y la entrada exige punto. | Inferencia: `12,4 11,8 13,1 12,9` → 8 datos, p = 0,068 / 4 datos, p = 0,154. Descriptiva: `1,2,3 4,5,6` → [1,2; 3; 4,5; 6]; `3,14` → [3; 14]; `10,20 30,40` → [10,2; 30,4]. Campo numérico: `1.000` → 1; `0x1F` → 31. | `app.py:219‑258`; `descriptiva.js:30‑80`; `regresion.js:55`; `simulacion.js:51`; `ui.js:557` |
| E7 | Alta | Los bigotes del diagrama de caja se dibujan en la valla, no en el dato extremo dentro de ella. | Datos 1…11 y 50 → bigote superior 17,5 / 11. | `app.py:1064‑1065` |
| E8 | Media | Si todos los valores son distintos, todos se devuelven como modas. | 7 valores distintos → 7 «modas» / sin moda. | `app.py:1040` |
| E9 | Alta | Tres tolerancias distintas para «suma 1»: cliente 10⁻⁶, API 10⁻⁶, motor 10⁻¹². No se admiten fracciones. | Priors 0,3333333 × 3 pasan cliente y API y el motor los rechaza con «deben sumar uno». `1/3` no se puede escribir. | `app.py:1184,1219`; `probabilidad.py:37,56`; `probabilidad.js:557,768` |
| E11 | Alta | Proporciones: el aviso depende de n < 30 y no de n·p₀. No hay prueba exacta. | x = 1, n = 40, p₀ = 0,02 (n·p₀ = 0,8) → sin aviso, p = 0,82 / binomial exacta 0,55. χ² 2×2 [[3,1],[1,3]] → p = 0,157 con aviso / Fisher 0,486. | `app.py:1405`; `inferencia.py:138‑200` |
| E12 | Media | El ajuste usa evolución diferencial incluso con estimador cerrado: el resultado depende de la semilla y se pega a las cotas sin avisar. | Normal: media 48,828779 (semilla 42) y 48,828874 (semilla 1) / 48,828833. Gamma con forma real 60 → 29,9999993 (cota 30), sin aviso. | `montecarlo.py:105‑134` |
| E13 | Alta | Regresión sin diagnóstico. | Predictores casi colineales (cond ≈ 3·10¹⁵) → coeficientes ±83 493 sin aviso. `significativo` usa 0,05 aunque la confianza sea 0,99. Predicción en x = 500 con datos en 1–10, sin aviso específico. Sin t, F global ni intervalos de predicción. | `app.py:1499‑1560`; `regresion.py` |
| E14 | Media | Simulación incoherente con la confianza elegida y con n. | π al 99 %: IC del resumen [3,1153; 3,1751] y banda de convergencia [3,1225; 3,1679] (1,96 fijo); el panel dice «95 %». n = 500 000 → se devuelven 200 000 sin avisar. | `app.py:1688‑1689,1753`; `simulacion.js:188` |
| E15 | Media | Los parámetros ausentes o mal nombrados se sustituyen por el valor por defecto en silencio. | Poisson con `{"lam": 3}` → calcula con la tasa por defecto y devuelve `parametros: {}`. Normal sin `sigma` → usa 1. El comentario del código dice que «el motor rechazará desconocidos», pero se descartan antes de llegar a él. | `app.py:846‑848` |
| E17 | Media | Curvas poco fieles. | CDF de discretas dibujada como línea interpolada, no escalón (lectura). Cauchy y t(1): rejilla de ±318 con paso ≈ 4. Beta(0,5; 0,5) y χ²(1): la densidad diverge en el borde y se dibuja con extremo finito, sin marcar la asíntota. | `distribuciones.js:745‑762`; `tabla.py` |
| E18 | Media | P(a ≤ X ≤ b) se calcula como `cdf(b) − cdf(a)`: cancelación en la cola derecha. | P(8 ≤ Z ≤ 9) → 0,0 / 6,22·10⁻¹⁶. | `app.py:906` |
| E19 | Baja | Descriptiva: sesgo y curtosis valen 0 con n = 2; texto «más pesadas (o más ligeras)»; método de cuartiles no declarado (interpolación lineal: Q1 = 2,75 para 1…8); IC al 95 % fijo; límite de 50 000 en la vista y 100 000 en la API. | — | `app.py:991‑1070` |

### 3.2 Robustez, errores y seguridad

| ID | Gravedad | Hallazgo | Evidencia | Dónde |
|---|---|---|---|---|
| E10 | Alta | Combinatoria sin cotas. | 2000! → HTTP 400 «Exceeds the limit (4300 digits) for integer string conversion…». C(2·10⁶, 10⁶) bloquea 22 s y termina con el mismo error. Cualquier factorial con n ≥ 1559 falla. | `app.py:1082` |
| E16 | Media | Mensajes internos en inglés y errores mal clasificados. | 1e308 en Descriptiva → «cannot convert float NaN to integer». Ruta inexistente → texto de Werkzeug en inglés. `intervalo` como lista → 500. Cualquier `KeyError` interno → 404. `NaN` se serializa como `null` y se pinta «—». | `app.py:2071‑2105,134` |
| E21 | Alta | Ningún cálculo tiene timeout. Cancelar en el navegador no detiene el servidor. Se ejecuta sobre el servidor de desarrollo de Flask. | La skill pide 10 s por defecto. | `app.py:2165`; `main.py:53` |
| S1 | Media | Dependencias con avisos publicados: Werkzeug 3.0.0 (8 CVE; varios sobre `safe_join` en Windows, que la app usa en `/vendor/katex/…` y `/media/teoria/…`), Flask 3.0.0 (1), Markdown 3.5.1 (1). | PyPI, 10‑11‑2026. Explotabilidad sin analizar. | `requirements.txt` |
| S2 | Baja | Sin cabeceras de seguridad (CSP, `X-Content-Type-Options`, `X-Frame-Options`) ni validación de `Host` (DNS rebinding). El saneador de lecciones es una lista de prohibidos, no de permitidos. | La respuesta de `/` solo trae `Cache-Control`. El CSRF sí queda mitigado porque la API exige JSON. | `app.py`; `teoria.js:48` |

### 3.3 Interfaz, experiencia e interacción (lectura de código)

| ID | Gravedad | Hallazgo | Dónde |
|---|---|---|---|
| U1 | Alta | Texto secundario `--texto-3` (#708895) con contraste 3,72:1 sobre blanco; se usa en ayudas de campo (≈11 px) y en etiquetas de ejes (10,5 px). La skill y WCAG AA piden 4,5:1. En tema oscuro cumple (5,5:1). | `app.css:17,669,1012` |
| U2 | Media | Las series de un gráfico se distinguen solo por color: no hay estilos de línea. | `chart.js:386`; `app.css:1016` |
| U3 | Media | Gráficos sin zoom ni pan. El trazado con flechas existe, pero el globo tiene `aria-live="off"`: un lector de pantalla no recibe los valores. No hay `aria-describedby` con resumen de tendencia. | `chart.js:461,534‑545` |
| U4 | Media | El diagrama de caja no tiene tabla alternativa ni foco de teclado. | `chart.js:637‑731` |
| U5 | Media | Fórmulas de las tarjetas mini a ≈11 px y recortadas (`overflow: hidden`). Sin máscara de degradado en los contenedores con scroll. | `app.css:1717‑1718` |
| U6 | Media | En cálculo automático, un error del servidor se descarta y el panel marca «Actualizado HH:MM» con el resultado anterior a la vista. | `distribuciones.js:669‑683` |
| U7 | Media | Errores de validación mostrados solo como toast de 4,6 s en Probabilidad (Bayes, variable aleatoria). | `probabilidad.js:549‑559,760‑769` |
| U8 | Media | Atajos: existen `Ctrl+K`, `Ctrl+Enter`, `Ctrl+Shift+L`, `?`. Faltan `F1` (ayuda), `Esc` para cancelar el cálculo y un atajo para ir al gráfico. | `app.js:590‑622`; `data.js:106` |
| U9 | Baja | Contenedores de resultado completos con `aria-live="polite"`: se relee todo el panel además del anuncio breve. | vistas (24 usos) |
| U10 | Baja | Pestañas con `role="tab"` sin `tabpanel`, `aria-controls` ni navegación con flechas. | `ui.js:664‑688` |
| U11 | Baja | Tipografía muy pequeña: 39 reglas por debajo de ≈11,5 px (mínimo 0,58 rem). Elementos de leyenda de ≈20 px de alto (WCAG 2.5.8 pide 24 px). | `app.css` |
| U12 | Baja | Semilla 0 se sustituye por 42 (`Number(x) \|\| 42`). | `distribuciones.js:635` |

### 3.4 Arquitectura y mantenimiento

| ID | Gravedad | Hallazgo |
|---|---|---|
| M1 | Alta | El repositorio versiona 28 252 archivos: 14 112 en `build_temp/` (copia de build obsoleta), 13 958 en `vendor/` y 10 928 `.pyc`. Solo 182 son el proyecto. `build_temp/` y `*.pyc` están en `.gitignore` pero siguen versionados: basta ejecutar la aplicación para que Git marque como modificados cientos de `.pyc` (473 durante esta auditoría; restaurados). |
| M2 | Media | `vendor/` contiene binarios de Linux x86‑64 para CPython 3.11, mientras que el empaquetado objetivo es un `.exe` de Windows. |
| M3 | Media | `app.py` tiene 2 165 líneas y mezcla rutas, validación, catálogo de pruebas, lógica estadística (bigotes, tamaño del efecto, curva nula) y exportación. Parte de esa lógica debería vivir en el motor, donde se puede probar. |
| M4 | Media | 11 pruebas de integración para 24 rutas; el motor no tiene pruebas unitarias. Ningún caso límite cubierto. |
| M5 | Baja | Código muerto: `core/estadistica/calculadora.py` y `docs/expresiones.py` no se importan en ningún sitio. `_preservar_matematicas` está duplicado. Docstrings obsoletos («Dear PyGui», «Qt»). |
| M6 | Baja | Versiones incoherentes («3.0», «3.1», `ampu_portable_3_0`). `pyinstaller` figura en `requirements.txt` de ejecución. Las preferencias se guardan en `~/.ampu/` pero `.gitignore` lista `.ampu_data/`. |
| M7 | Baja | Las skills: `math-ux.md` tiene el formato roto desde la sección 2 (bloque de código sin cerrar, tablas como texto tabulado) y `math-ix.md` carece del `---` inicial del frontmatter; la copia del repo no tiene el último ítem del checklist. |

### 3.5 Lo que ya está bien y conviene conservar

- Validación centralizada (`Parametro`) y errores tipados (`ErrorAmPu`).
- Sin `eval`/`exec` en todo el proyecto; las funciones integrables son una lista blanca.
- Límites de tamaño en casi todas las rutas (41–401 puntos, N ≤ 10⁶, cuerpo ≤ 16 MB).
- Generador aleatorio local con semilla; resultados reproducibles.
- Colas de discretas con `sf`, intervalo de Wilson, Welch por defecto, conclusiones que no «aceptan H₀».
- Verificación cruzada de las 23 distribuciones univariantes: `cdf(ppf(0,9)) = 0,9` e `∫pdf = ΔF` coinciden (la única desviación, Cauchy, es la rejilla de E17).
- Exportación a XLSX/CSV que neutraliza la inyección de fórmulas.
- KaTeX local con `trust: false` y salida MathML; «Copiar LaTeX».
- Gráficos SVG propios con tabla de datos, leyenda conmutable y trazado por teclado.
- Tema, densidad, reducción de movimiento y estilos de impresión.

## 4. Plan de cambios

El orden responde a un criterio: primero dejar de mostrar resultados erróneos, después impedir que la entrada se malinterprete, después robustez y transparencia, y al final interacción y mantenimiento. Tamaño estimado: **S** (horas), **M** (1–3 días), **L** (una semana o más). Son estimaciones sin haber implementado nada.

### Fase 0 — Red de seguridad (previa a cualquier cambio)

| # | Cambio | Resuelve | Tamaño | Criterio de aceptación |
|---|---|---|---|---|
| 0.1 | Convertir los casos de la sección 3 en pruebas de regresión (marcadas como fallo esperado hasta su corrección). | M4 | M | Una prueba por cada ID E1–E19; la suite se ejecuta con un solo comando. |
| 0.2 | Pruebas unitarias del motor frente a valores de referencia de SciPy y a casos resueltos a mano. | M4 | M | Cada función pública de `core/` tiene al menos un caso normal y uno límite. |
| 0.3 | Dejar de versionar `build_temp/`, `vendor/` y `*.pyc`. | M1, M2 | S | `git ls-files \| wc -l` ≈ 200. Decisión D3 sobre cómo distribuir las dependencias. |

### Fase 1 — Corregir resultados erróneos

| # | Cambio | Resuelve | Tamaño | Criterio de aceptación |
|---|---|---|---|---|
| 1.1 | Eliminar `round(f, 12)` de `_valor`. Serializar el `float` completo y formatear solo en la vista. Mostrar p pequeños como `p < 0,0001 (4,83·10⁻³²)`. Corregir la nota de «precisión completa». | E1 | S | P(Z ≥ 8) y el p de la prueba t llegan al cliente distintos de cero. |
| 1.2 | Calcular las colas con `sf` y los intervalos en cola derecha con `sf(a) − sf(b)`. | E18 | S | P(8 ≤ Z ≤ 9) ≈ 6,22·10⁻¹⁶. |
| 1.3 | Rehacer la curva nula por prueba: χ²(k−1) para Kruskal; estadístico t transformado para Pearson; aproximación normal estandarizada (declarada) o ninguna curva para Mann‑Whitney, Wilcoxon y Spearman. Eliminar el `gl if gl else 1`. Mover la lógica al motor. | E2 | M | En las 13 pruebas, el marcador cae en la región sombreada si y solo si `rechaza` es verdadero. |
| 1.4 | Alternativa: pasarla a SciPy donde tiene sentido (Mann‑Whitney, Wilcoxon, correlación) y ocultar el selector en χ², ANOVA y Kruskal. El catálogo declara `admite_alternativa`. | E3 | M | Cambiar la alternativa cambia el p, o el selector no está. |
| 1.5 | Generar H₁ según la alternativa elegida y ofrecer cota unilateral de confianza cuando el contraste es unilateral, o declarar que el IC es bilateral. | E4 | S | El texto de H₁ coincide con la alternativa en las 6 pruebas que la admiten. |
| 1.6 | Integral: calcular la referencia para el intervalo pedido (primitiva conocida de cada función de la lista) o no mostrar «valor exacto». Validar el dominio (`√(1−x²)` exige \|x\| ≤ 1) con un mensaje de dominio. | E5 | S | x² en [0, 2] muestra 8/3 como referencia. |
| 1.7 | Bigotes en el dato más extremo dentro de las vallas; sin moda si todos los valores son distintos; sesgo y curtosis `null` con n insuficiente; texto de curtosis según el signo; declarar el método de cuartiles. | E7, E8, E19 | S | Datos 1…11 y 50 → bigote superior 11. |
| 1.8 | Proporciones: aviso según n·p₀ y n·(1−p₀); ofrecer la binomial exacta y Fisher en 2×2 cuando no se cumplan las condiciones. | E11 | M | El caso x = 1, n = 40, p₀ = 0,02 avisa y ofrece p = 0,554. |
| 1.9 | Simulación: banda de convergencia con el cuantil de la confianza elegida, texto dinámico, y rechazar o avisar cuando n supere el máximo. | E14 | S | Banda y resumen coinciden al 99 %. |
| 1.10 | Ajuste: estimadores cerrados para normal y exponencial, MLE de SciPy para el resto, y aviso cuando un parámetro quede en una cota. | E12 | M | El ajuste normal no depende de la semilla. |
| 1.11 | Regresión: número de condición con aviso, `significativo` según la confianza, estadístico t, F global, intervalos de predicción y aviso por fila fuera del rango observado. Resolver con `lstsq`/QR en lugar de `inv(XᵀX)`. | E13 | M | El caso casi colineal devuelve un aviso de multicolinealidad. |

### Fase 2 — Entrada sin ambigüedad

| # | Cambio | Resuelve | Tamaño | Criterio de aceptación |
|---|---|---|---|---|
| 2.1 | Un único analizador de series y matrices (un módulo JS y su equivalente en el servidor) con una regla explícita para la coma (decisión D2). Sustituye a los 5 actuales. | E6 | M | La misma cadena da los mismos números en todas las pantallas y en la API. |
| 2.2 | Vista previa de la interpretación junto a cada campo de datos: «4 valores: 12,4 · 11,8 · 13,1 · 12,9». Si la cadena admite dos lecturas, mostrar ambas y pedir elección antes de calcular. | E6, math‑ui §1, math‑ux §1 | M | `1,2,3 4,5,6` no se calcula sin que el usuario vea cómo se ha leído. |
| 2.3 | Rechazar con mensaje y posición `0x…`, `1_000`, booleanos y separadores de miles ambiguos (`1.000`). | E6 | S | Cada caso devuelve posición, token y sugerencia. |
| 2.4 | Admitir fracciones (`1/3`) en probabilidades con aritmética exacta (`fractions.Fraction`), una sola tolerancia compartida y un botón «Normalizar para que sumen 1». | E9 | M | Priors 1/3, 1/3, 1/3 se aceptan y la posterior se muestra exacta y aproximada. |
| 2.5 | Rechazar parámetros desconocidos o ausentes en la API en lugar de usar el valor por defecto. | E15 | S | `{"lam": 3}` devuelve un error que nombra el parámetro esperado. |
| 2.6 | Rellenar `campo` en los errores del servidor y usarlo en las vistas para marcar el control; los errores de validación pasan del toast al propio campo. | E16, U7 | M | Todo error de validación deja un campo con `aria-invalid` y su mensaje. |

### Fase 3 — Robustez del motor

| # | Cambio | Resuelve | Tamaño | Criterio de aceptación |
|---|---|---|---|---|
| 3.1 | Cotas en combinatoria (por número de dígitos del resultado) y, por encima, resultado en notación científica mediante `lgamma`, marcado como aproximado. | E10 | S | 2000! responde en menos de 1 s con una salida válida. |
| 3.2 | Timeout de cálculo configurable (10 s por defecto) ejecutando los cálculos pesados en un proceso trabajador cancelable; error de tipo `timeout` con acción de recuperación. | E21 | L | Un cálculo que exceda el límite devuelve el mensaje de timeout y libera la CPU. |
| 3.3 | Tipos de error diferenciados (`sintaxis`, `dominio`, `ambiguedad`, `timeout`, `fuera_de_alcance`, `interno`), todos en español; dejar de reenviar `str(error)` de excepciones ajenas; el `KeyError` genérico pasa a 500. | E16 | M | Ninguna respuesta contiene texto en inglés de Python, NumPy o Werkzeug. |
| 3.4 | Sustituir las comparaciones exactas de `float` (`np.std(x) == 0`, `ss_total == 0`…) por tolerancias. | math‑engine §3 | S | Sin `==` entre flotantes en `core/`. |
| 3.5 | Actualizar Flask, Werkzeug y Markdown; servir con un servidor WSGI de producción (por ejemplo `waitress`); añadir cabeceras de seguridad y validación de `Host`. | S1, S2, E21 | M | PyPI no lista avisos para las versiones fijadas. |

### Fase 4 — Transparencia y verificación

| # | Cambio | Resuelve | Tamaño | Criterio de aceptación |
|---|---|---|---|---|
| 4.1 | Bloque fijo «Método y supuestos» en cada resultado: método numérico, convenciones aplicadas y error estimado cuando exista. La API devuelve estos datos de forma estructurada. | math‑ux §4, math‑engine §2‑3 | M | Las 24 rutas de cálculo devuelven `metodo` y `supuestos`. |
| 4.2 | Acción «Verificar» con un método independiente: simulación frente a valor analítico, `∫pdf` frente a CDF, permutaciones frente a p asintótico, sustitución en regresión. Muestra coincidencia y tolerancia. | math‑ux §2, math‑engine §4 | L | Disponible al menos en Distribuciones, Inferencia y Regresión. |
| 4.3 | Distinción visible entre exacto y aproximado: fracción exacta cuando exista (binomial, hipergeométrica, combinatoria, Bayes) y decimal con ≈ como secundario. | math‑ux §1.4 | M | P(X ≥ 3) con n = 10, p = 0,5 muestra 121/128 ≈ 0,9453. |
| 4.4 | Alta precisión opcional con mpmath para colas extremas. | math‑engine §1 | M | Depende de la decisión D4. |
| 4.5 | Derivación colapsable del estadístico («pasos»): fórmula, sustitución de valores y resultado, con la regla como etiqueta. | math‑ui §5 | L | Disponible en las pruebas paramétricas. |

### Fase 5 — Gráficas e interacción

| # | Cambio | Resuelve | Tamaño | Criterio de aceptación |
|---|---|---|---|---|
| 5.1 | Subir `--texto-3` del tema claro hasta ≥ 4,5:1 y fijar un mínimo tipográfico (≈12 px en texto, 11 px en ejes). | U1, U11 | S | Todas las parejas texto/fondo ≥ 4,5:1 en ambos temas. |
| 5.2 | Estilo de línea por serie (continuo, discontinuo, punteado) y marcadores distintos. | U2 | S | Dos series se distinguen en escala de grises. |
| 5.3 | CDF de discretas en escalón; rejilla por cuantiles centrales en colas pesadas; marca de asíntota donde la densidad diverge. | E17 | M | Cauchy muestra el cuerpo de la curva con resolución suficiente. |
| 5.4 | Zoom y pan con botones (+, −, restablecer) y teclado, además de rueda y arrastre. Trazado (x, y) anunciado con `aria-live="polite"`. | U3 | L | Todo gesto tiene equivalente con un solo puntero y con teclado. |
| 5.5 | Tabla alternativa y descripción para el diagrama de caja; `aria-describedby` con resumen de tendencia en todos los gráficos. | U3, U4 | M | Cada gráfico tiene tabla y descripción textual. |
| 5.6 | Atajos `F1` (ayuda), `Esc` (cancelar el cálculo en curso) y uno para ir al gráfico; `AbortController` en Probabilidad y Simulación. | U8 | S | La ayuda lista los atajos y todos funcionan. |
| 5.7 | En cálculo automático, mostrar el error o marcar el resultado como desactualizado; no escribir «Actualizado» tras un fallo o una cancelación. Describir el tipo de cálculo a partir de 3 s. | U6 | S | Un fallo en modo automático es visible. |
| 5.8 | Fórmulas ≥ 16 px con scroll y máscara de degradado en las tarjetas mini; desplazamientos que respeten la preferencia de movimiento; pestañas con el patrón ARIA completo; un único anuncio breve por resultado. | U5, U9, U10 | M | — |

### Fase 6 — Arquitectura y mantenimiento

| # | Cambio | Resuelve | Tamaño |
|---|---|---|---|
| 6.1 | Dividir `app.py` en módulos por dominio (blueprints) y mover la lógica estadística al motor. | M3 | L |
| 6.2 | Eliminar código muerto o darle uso (decisión D1); unificar `_preservar_matematicas`. | M5 | S |
| 6.3 | Una sola fuente de versión; separar dependencias de ejecución y de build; integración continua con la suite de pruebas. | M6, M4 | S |
| 6.4 | Reparar el formato de `math-ux.md` y `math-ix.md`. | M7 | S |

### Decisiones que necesito de ti

| # | Decisión | Opciones | Afecta a |
|---|---|---|---|
| D1 | ¿AmPu sigue siendo un laboratorio de formularios o debe aceptar expresiones libres? | Formularios: los requisitos de parser, LaTeX de entrada y SymPy quedan fuera y `calculadora.py` se elimina. Expresiones: es un proyecto nuevo (editor, vista previa, SymPy, pasos). | 4.5, 6.2 |
| D2 | Regla de la coma en series de datos. | (a) Coma siempre decimal; separadores: espacio, `;` y salto de línea. (b) Elegir explícitamente en cada campo, con vista previa. Recomiendo (a) con la vista previa de 2.2, por coherencia con la salida en es‑ES. | 2.1–2.3 |
| D3 | Distribución de dependencias sin conexión. | Carpeta de wheels en cada release o Git LFS, en lugar de `vendor/` dentro del repositorio. | 0.3 |
| D4 | ¿Se aceptan mpmath y, si procede, SymPy en el ejecutable? | Aumentan el tamaño del `.exe`; a cambio permiten colas extremas y formas exactas. | 4.3, 4.4 |

## 5. Cómo reproducir los hallazgos principales

Con `PYTHONPATH=vendor` y `app.app.test_client()`:

| ID | Petición |
|---|---|
| E1 | `POST /api/distribucion/calcular` `{"clave":"normal","parametros":{"mu":0,"sigma":1},"x":8}` → `resumen.cola.valor` |
| E2 | `POST /api/inferencia` `{"prueba":"mann_whitney","datos":[12,13,11,14,12,13],"datos2":[15,16,14,15,17,16]}` → `curva` |
| E3 | La petición anterior con `"alternativa":"less"` y `"greater"` → `p_valor` |
| E5 | `POST /api/simulacion` `{"tipo":"integral","funcion":"cuadrado","a":0,"b":2,"n":20000,"semilla":7}` → `referencia`, `nota` |
| E6 | `POST /api/inferencia` `{"prueba":"t_una","datos":"12,4 11,8 13,1 12,9","mu0":12}` → `gl` |
| E7 | `POST /api/descriptiva` `{"datos":[1,2,3,4,5,6,7,8,9,10,11,50]}` → `caja.bigote_sup` |
| E9 | `POST /api/probabilidad/bayes` con tres hipótesis de prior 0,3333333 |
| E10 | `POST /api/probabilidad/combinatoria` `{"tipo":"factorial","n":2000}` |
| E13 | `POST /api/regresion` con `x` de dos columnas casi iguales (diferencias de 10⁻⁷) |
| E15 | `POST /api/distribucion/calcular` `{"clave":"poisson","parametros":{"lam":3},"x":2}` → `parametros` |
