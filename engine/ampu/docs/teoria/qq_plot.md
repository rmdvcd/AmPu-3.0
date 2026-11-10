# QQ-plot y comparación de datos

## Definición formal

Enfrenta cuantiles empíricos ordenados con cuantiles de un modelo para descubrir colas y asimetrías.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `x_(i)` | i-ésimo dato ordenado |
| `n` | Tamaño de muestra |
| `Q` | Función cuantil teórica |


## Función, estadístico o regla de selección

$$
q_i=F^{-1}\left(\frac{i-1/2}{n}\right),\quad i=1,\ldots,n
$$

## Función de distribución acumulada (CDF)

CDF de referencia o del estimador bajo las hipótesis indicadas.

$$
F_X(x)=P(X\le x),\quad F^{-1}(p)=\inf\{x:F(x)\ge p\}
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}[X]=\int x\,\mathrm{d}F(x),\quad\sigma_X=\sqrt{\operatorname{Var}(X)}
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

Puntos aproximadamente lineales sugieren concordancia; desviaciones sistemáticas en extremos señalan colas distintas.

![Esquema de QQ-plot y comparación de datos](../imagenes/analisis.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Ordene 5 valores reales $x_{(1)},\ldots,x_{(5)}$.
2. Calcule probabilidades (0,1;0,3;0,5;0,7;0,9) y sus cuantiles normales.
3. Trace pares (cuantil teórico, valor empírico) y compare con la recta de referencia.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
