# QQ-plot y comparación de datos

## Definición formal

Enfrenta cuantiles empíricos ordenados con cuantiles de un modelo para descubrir colas y asimetrías.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `x_(i)` | i-ésimo dato ordenado |
| `n` | Tamaño de muestra |
| `Q` | Función cuantil teórica |

## Fórmula y procedimiento

$$
q_i=F^{-1}\left(\frac{i-1/2}{n}\right),\quad i=1,\ldots,n
$$

## Cómo leer el gráfico

Cada punto enfrenta un cuantil teórico con una observación ordenada. Una alineación aproximada sugiere formas compatibles; curvaturas y separaciones en los extremos pueden indicar asimetría o colas distintas. La pendiente y el intercepto también dependen de la escala y la localización.

## Propiedades y casos especiales

Puntos aproximadamente lineales sugieren concordancia; desviaciones sistemáticas en extremos señalan colas distintas.

## Ejemplo resuelto, paso a paso

1. **Datos.** Usa `-1,2 -0,5 0 0,5 1,2` y una normal con media 0 y desviación 1.
2. **Posiciones.** Para 5 datos, las probabilidades son 0,1; 0,3; 0,5; 0,7; 0,9.
3. **Cuantiles.** Los cuantiles teóricos son aproximadamente −1,281552; −0,524401; 0; 0,524401; 1,281552. El primer par del gráfico es (−1,281552; −1,2).
4. **Interpretación.** Los puntos quedan cerca de una recta. Esto sugiere compatibilidad de forma, pero no demuestra normalidad, especialmente con solo cinco datos.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
