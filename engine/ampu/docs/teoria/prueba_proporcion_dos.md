# Prueba z · dos proporciones

## Definición formal

Contrasta la igualdad de dos proporciones independientes con tasa agrupada bajo H₀.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `x₁,x₂` | Éxitos de cada grupo |
| `n₁,n₂` | Tamaños positivos |
| `α` | Significación |

## Fórmula y procedimiento

$$
Z=\frac{\hat p_1-\hat p_2}{\sqrt{\hat p(1-\hat p)(1/n_1+1/n_2)}},\quad\hat p=\frac{x_1+x_2}{n_1+n_2}
$$

## Aproximación y prueba exacta

Para contrastar igualdad, la aproximación z usa la proporción combinada de ambos grupos en el error estándar. Cuando las frecuencias esperadas son pequeñas, AmPu usa la prueba exacta de Fisher. Los dos grupos deben ser independientes.

## Propiedades y casos especiales

La diferencia IC usa error **no agrupado**. Si todos son éxitos o todos fracasos, la varianza nula impide esta aproximación.

## Ejemplo resuelto, paso a paso

1. **Datos.** Compara 40 éxitos de 100 en A con 20 de 100 en B, en muestras independientes.
2. **Estadístico.** Bajo igualdad de proporciones, la estimación combinada es $60/200=0{,}3$. El error estándar es $\sqrt{0{,}3\cdot0{,}7(1/100+1/100)}$, y $z\approx$ **3,086067**.
3. **Resultado.** El p-valor bilateral es **0,002028**.
4. **Conclusión.** Rechaza la igualdad al 5 %. La diferencia estimada es 0,2: **20 puntos porcentuales**, no un aumento relativo del 20 %.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
