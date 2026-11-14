# Prueba t de Welch · dos medias

## Definición formal

Compara medias independientes sin asumir varianzas iguales.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `s₁, s₂` | Desviaciones muestrales |
| `n₁, n₂` | Tamaños de grupo ≥2 |
| `α` | Significación |

## Fórmula y procedimiento

$$
\begin{aligned}T&=\frac{\bar X_1-\bar X_2}{\sqrt{s_1^2/n_1+s_2^2/n_2}}\\[4pt]\nu&=\frac{(s_1^2/n_1+s_2^2/n_2)^2}{(s_1^2/n_1)^2/(n_1-1)+(s_2^2/n_2)^2/(n_2-1)}\end{aligned}
$$

## Distribución de referencia

La distribución de referencia es aproximadamente $t_\nu$, con grados de libertad de Welch–Satterthwaite. No exige varianzas poblacionales iguales. Para muestras pequeñas, requiere que cada población sea aproximadamente normal.

## Propiedades y casos especiales

Welch es preferible a imponer varianzas iguales sin justificación. El IC se basa en grados de libertad de Satterthwaite.

## Ejemplo resuelto, paso a paso

1. **Datos.** Compara A: `4 5 6 7 8` y B: `1 2 3 4 5`. Usa alternativa bilateral y $\alpha=0{,}05$.
2. **Estadístico.** Las medias son 6 y 3, y ambas varianzas muestrales son 2,5. El error estándar es $\sqrt{2{,}5/5+2{,}5/5}=1$, así que $t=$ **3**.
3. **Referencia.** La fórmula de Welch da 8 grados de libertad y p-valor **0,017072**.
4. **Conclusión.** Rechaza la igualdad de medias al 5 %. La independencia entre grupos no se comprueba con el p-valor: depende del diseño de recogida de datos.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
