# Estadística descriptiva

## Definición formal

Resume un conjunto de observaciones con medidas robustas y gráficos exploratorios.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `xᵢ` | Datos numéricos finitos |
| `n` | Tamaño n≥2 |
| `s` | Desviación muestral |

## Fórmula y procedimiento

$$
\bar x=\frac1n\sum_i x_i,\quad s^2=\frac1{n-1}\sum_i(x_i-\bar x)^2
$$

## Dispersión y error estándar

La desviación muestral $s$ describe la dispersión de los datos. Si las observaciones son independientes, el error estándar de la media se estima mediante $s/\sqrt n$. La media y la desviación son sensibles a valores extremos; acompáñalas de mediana, cuartiles y gráficos.

## Propiedades y casos especiales

El coeficiente de variación $s/|\bar x|$ no está definido con media cero y puede ser poco informativo cerca de cero. AmPu usa interpolación lineal en los cuartiles e informa todas las modas empatadas.

## Ejemplo resuelto, paso a paso

1. **Datos.** Introduce `1 2 2 4 5`: hay 5 observaciones y su suma es 14.
2. **Centro.** La media es $14/5=$ **2,8**. La mediana y la moda son **2**.
3. **Dispersión.** La suma de desviaciones cuadradas es 10,8. Divide por $n-1=4$: $s^2=$ **2,7** y $s\approx$ **1,643168**.
4. **Interpretación.** La varianza está en unidades al cuadrado; la desviación está en las unidades originales. No confundas desviación estándar con error estándar de la media.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
