# Prueba z · dos medias

## Definición formal

Compara dos medias independientes cuando ambas desviaciones poblacionales son conocidas.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `σ₁, σ₂` | Desviaciones poblacionales >0 |
| `n₁, n₂` | Tamaños muestrales independientes |
| `α` | Significación |

## Fórmula y procedimiento

$$
Z=\frac{\bar X_1-\bar X_2}{\sqrt{\sigma_1^2/n_1+\sigma_2^2/n_2}}
$$

## Distribución de referencia

Bajo igualdad de medias, el estadístico es normal estándar si las poblaciones son normales y las desviaciones son conocidas. Los grupos deben ser independientes. La prueba bilateral usa $2[1-\Phi(|z|)]$.

## Propiedades y casos especiales

El IC de la diferencia usa el mismo error estándar pero no presupone igualdad de medias.

## Ejemplo resuelto, paso a paso

1. **Datos.** Compara A: `10 12 14 12` y B: `8 10 12 10`, con desviaciones poblacionales conocidas $\sigma_A=\sigma_B=2$ y grupos independientes.
2. **Estadístico.** Las medias son 12 y 10. El error estándar es $\sqrt{4/4+4/4}=\sqrt2$ y $z=2/\sqrt2\approx$ **1,414214**.
3. **Resultado.** El p-valor bilateral es **0,157299**.
4. **Conclusión.** A $\alpha=0{,}05$, no rechaces la igualdad de medias. Esto no demuestra que las medias poblacionales sean idénticas.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
