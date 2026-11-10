---
name: math-engine
description: >-
  Skill de dominio para el motor de cálculo de un Asistente Matemático en
  Python (SymPy, NumPy, SciPy, mpmath). Úsala al implementar o auditar
  resolución simbólica, cálculo numérico, precisión, manejo de dominios y
  supuestos, verificación de resultados y seguridad de la evaluación de
  expresiones. Cubre los errores silenciosos más frecuentes y cómo evitarlos.
---

# Motor Matemático: Corrección, Precisión y Seguridad

Esta skill define las reglas del **núcleo de cálculo** de un asistente matemático en Python. Un motor que devuelve un resultado incorrecto con formato impecable es peor que un error visible: el usuario confiará en él y lo usará en un examen, una factura o un diseño de ingeniería.

## 1. Separación de motores

| Motor | Cuándo usarlo | Cuándo no |
|---|---|---|
| **SymPy** | Álgebra simbólica, derivadas, integrales exactas, ecuaciones, simplificación | Cálculo numérico de gran volumen; expresiones que no simplifican |
| **NumPy** | Álgebra lineal numérica, operaciones vectorizadas sobre arrays | Resultados simbólicos; matrices simbólicas |
| **SciPy** | Optimización, integración numérica, EDOs, estadística | Cuando existe forma cerrada exacta |
| **mpmath** | Precisión arbitraria, funciones especiales, evaluación numérica de alta precisión | Cálculos masivos de baja precisión |

**Regla:** el resultado simbólico es la fuente de la verdad cuando existe. La aproximación numérica es un **complemento**, nunca un sustituto silencioso.

## 2. Dominio, supuestos y singularidades

- Toda operación simbólica debe declarar sus supuestos. `sqrt(x^2)` no es `x` en general; es `|x|` si `x ∈ ℝ`, y `x` solo si `x ≥ 0`. SymPy permite declarar `Symbol('x', real=True, positive=True)`; hazlo explícito y muéstralo al usuario.
- Al resolver ecuaciones, **enumera todas las soluciones** en el dominio declarado y **señala las extrañas** (introducidas por elevar al cuadrado, etc.). Verifica cada solución sustituyéndola en la ecuación original.
- Las integrales impropias deben reportar su convergencia. Una integral divergente no es “un número grande”.
- Para funciones con discontinuidades (tan, 1/x, log), identifica y muestra los puntos excluidos del dominio.

## 3. Precisión numérica

- Usa `mpmath` o `decimal.Decimal` cuando el usuario pida precisión arbitraria; no uses `float` para resultados que se muestran con más de 15 dígitos.
- No compares números de punto flotante con `==`. Usa tolerancias (`math.isclose`, `numpy.allclose`) con `rtol` y `atol` explícitos.
- En resultados numéricos, muestra el **método** y una **estimación de error** cuando sea posible (ej. regla de Simpson con estimación por refinamiento).
- **Nunca redondees en pasos intermedios.** Redondea solo en la presentación final; conserva precisión completa en el pipeline.

## 4. Verificación de resultados

Todo resultado debe pasar por al menos una verificación independiente antes de mostrarse:

| Operación | Verificación |
|---|---|
| Derivada `f'` | Diferenciación numérica en puntos aleatorios; comparar con `f'` simbólica |
| Integral `F` | Derivar `F` y comparar con el integrando original |
| Solución de ecuación | Sustituir en la ecuación original y comprobar que se anula |
| Simplificación | Evaluar numéricamente la expresión original y la simplificada en puntos aleatorios |
| Sistema lineal | Sustituir la solución y comprobar el residuo |

Si la verificación falla, **no muestres el resultado como válido**. Muestra una advertencia y el resultado sin validar, con una explicación.

## 5. Seguridad de la evaluación

- **Nunca uses `eval()` ni `exec()` sobre la entrada del usuario.** Usa `sympy.sympify` con un diccionario de símbolos permitidos, o `asteval`/`asteval`-like con un namespace restringido.
- Limita el **tiempo de cálculo** (timeout configurable, por defecto 10 s) y la **profundidad de recursión** para evitar expresiones que cuelguen el servidor.
- Limita el **tamaño de la entrada** (longitud máxima de expresión, número máximo de nodos del árbol sintáctico).
- En Web, el cálculo ocurre en el backend Python; el frontend nunca evalúa expresiones. En Desktop, si se usa un intérprete local, debe ser el mismo motor restringido.

## 6. Checklist del motor

- [ ] ¿Se usa SymPy para simbólico, NumPy/SciPy para numérico y mpmath para alta precisión, sin mezclarlos sin justificación?
- [ ] ¿Los supuestos (real, positivo, entero) están declarados y se muestran al usuario?
- [ ] ¿Las soluciones de ecuaciones se verifican por sustitución y se marcan las extrañas?
- [ ] ¿Las integrales impropias reportan convergencia?
- [ ] ¿Los resultados numéricos incluyen método y estimación de error?
- [ ] ¿Se redondea solo en la presentación final?
- [ ] ¿La evaluación de expresiones está restringida (sin `eval`/`exec`, con timeout y límites de tamaño)?
- [ ] ¿Los resultados pasan una verificación independiente antes de mostrarse?