# Muestreo sistemático

## Definición formal

Tras un inicio aleatorio sobre una lista ordenada, elige elementos a intervalos aproximadamente constantes.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `N` | Tamaño de la lista |
| `n` | Unidades deseadas (1 ≤ n ≤ N) |
| `r` | Inicio uniforme en [0, N/n) |

## Fórmula y procedimiento

$$
k=N/n,\qquad j_i=\lfloor r+ik\rfloor,\quad i=0,\ldots,n-1
$$

## Selección e interpretación

Un inicio uniforme genera posiciones separadas por $N/n$. Los índices internos parten de cero; los identificadores predeterminados de AmPu parten de uno. El inicio debe ser aleatorio: elegirlo por conveniencia elimina la justificación probabilística del diseño.

## Propiedades y casos especiales

Una periodicidad alineada con el salto puede aumentar mucho la varianza y producir una muestra poco representativa; no implica por sí sola sesgo del estimador si el inicio se elige realmente al azar.

## Ejemplo resuelto, paso a paso

1. **Datos.** Usa una lista de 40 unidades, tamaño 10, semilla 0 y tamaño automático desactivado.
2. **Paso.** El salto es $k=40/10=4$. La semilla da un inicio aleatorio $r\approx2{,}5478$.
3. **Selección.** Los índices desde cero son 2, 6, 10, …, 38. Como AmPu numera los identificadores desde 1, muestra **3, 7, 11, …, 39**: **10** unidades distintas.
4. **Precaución.** Una lista con periodicidad alineada con el salto puede dar una muestra poco representativa. Revisa el orden de la lista antes de aplicar el diseño.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
