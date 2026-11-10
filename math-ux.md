---
name: math-ux
description: >-
  Guía de UX para un Asistente Matemático. Úsala al diseñar el flujo de
  resolución, la comunicación de errores de sintaxis y dominio, la progresión
  de dificultad, el manejo de ambigüedad y la transparencia del motor de
  cálculo. Cubre feedback de validación, explicación de pasos y confianza en
  el resultado.
---

# UX del Asistente Matemático: Flujo, Errores y Transparencia

Esta skill define las decisiones de experiencia de usuario de un asistente matemático. Mientras `math-ui` cubre cómo se ve una fórmula, `math-ux` cubre **qué se le dice al usuario, en qué orden, con qué nivel de detalle y cómo se gestiona la incertidumbre del cálculo**.

## 1. Principios rectores

1. **La respuesta primero, la explicación después.** El usuario quiere el resultado; los pasos son un apoyo, no un requisito para obtenerlo.
2. **Nunca calcules en silencio una interpretación ambigua.** Si `1/2x` puede ser `(1/2)x` o `1/(2x)`, muestra la interpretación elegida y permite corregirla antes de resolver.
3. **El error de sintaxis es una conversación, no un veredicto.** Indica la posición del error y sugiere la corrección: “Falta un paréntesis de cierre en la posición 7”.
4. **La distinción entre exacto y aproximado debe ser visible.** `π` no es `3.1416`. Muestra siempre la forma exacta cuando exista y la aproximación como secundaria.
5. **Declara los límites del motor.** Si una integral no tiene forma cerrada, dilo: “No se encontró una forma cerrada; se muestra la aproximación numérica”.

## 2. Flujo canónico de resolución

```text
1. El usuario introduce la expresión.
2. El sistema muestra la interpretación canónica (renderizada) y pide confirmación si es ambigua.
3. El sistema clasifica el problema (álgebra, cálculo, estadística, etc.) y muestra el tipo detectado.
4. Se muestra el resultado final destacado.
5. Se ofrecen los pasos colapsables, agrupados por regla aplicada.
6. Se ofrece la gráfica (si aplica) y la tabla de valores.
7. Se ofrece “Verificar” con un método alternativo (ej. derivar la integral propuesta, sustituir la solución en la ecuación).

La verificación es un diferenciador clave: un asistente que solo da respuestas genera desconfianza; uno que verifica su propia respuesta con un método independiente genera confianza.

3. Manejo de errores
Tipo de error	Mensaje UX
Sintaxis	Posición del error, token inesperado y corrección sugerida. No solo “Expresión inválida”.
Dominio	“La función no está definida para x = 0. Se excluye ese punto del dominio.”
Ambigüedad	“Se interpretó 1/2x como (1/2)·x. ¿Era 1/(2x)?” con botón para cambiar.
Sin solución cerrada	“No se encontró una forma exacta. Se muestra la aproximación numérica con 8 decimales.”
Timeout	“El cálculo excedió el tiempo límite. Intenta simplificar la expresión o aumentar el límite en Ajustes.”
Fuera de alcance	“Este tipo de problema no está soportado todavía. Tipos soportados: …”
4. Transparencia del motor de cálculo
El usuario debe poder saber qué motor resolvió su problema y con qué supuestos:

Indica si el resultado es simbólico (SymPy), numérico (NumPy/SciPy) o híbrido.

Muestra los supuestos aplicados: “Se asume x ∈ ℝ”, “Se asume n entero positivo”.

Para resultados numéricos, muestra el método y el error estimado: “Integración por Simpson, error estimado < 1e-8”.

Permite cambiar el dominio (reales, complejos, enteros) desde el propio resultado, no solo desde ajustes.

5. Progresión y microcopy
Usa voz activa en botones: “Resolver”, “Graficar”, “Verificar”, no “Aceptar”.

Los pasos se etiquetan con la regla matemática aplicada, no con “Paso 1, Paso 2”.

Evita jargon innecesario en el resultado principal; resérvalo para los pasos detallados.

En problemas de varios pasos (sistemas de ecuaciones, optimización), muestra el estado intermedio después de cada fase.

6. Checklist de UX
□ ¿El resultado final aparece antes que los pasos?
□ ¿Las expresiones ambiguas se muestran interpretadas y se pide confirmación antes de calcular?
□ ¿Los errores de sintaxis indican posición y corrección sugerida?
□ ¿Se distingue visualmente entre resultado exacto y aproximado?
□ ¿El sistema declara el motor usado y los supuestos aplicados?
□ ¿Existe una acción de “Verificar” con método independiente?
□ ¿Los límites del motor (timeout, fuera de alcance) se comunican con una acción de recuperación?