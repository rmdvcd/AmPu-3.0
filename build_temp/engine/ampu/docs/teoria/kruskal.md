# Prueba de Kruskal–Wallis

## Definición formal

Alternativa no paramétrica a ANOVA para dos o más grupos independientes.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `k` | Número de grupos ≥2 |
| `R_h` | Suma de rangos por grupo |
| `N` | Total de observaciones |


## Función, estadístico o regla de selección

$$
H=\frac{12}{N(N+1)}\sum_{h=1}^k\frac{R_h^2}{n_h}-3(N+1)
$$

## Función de distribución acumulada (CDF)

CDF de referencia o del estimador bajo las hipótesis indicadas.

$$
F_H(h)\approx F_{\chi^2_{k-1}}(h)
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}[H]\approx k-1,\quad\operatorname{Var}(H)\approx2(k-1)
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

SciPy ajusta empates; el rechazo global no dice cuáles grupos difieren. Si todos los valores son iguales, no hay contraste.

![Esquema de Prueba de Kruskal–Wallis](../imagenes/inferencia.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Reúna tres grupos de al menos dos datos y ordene todas las observaciones.
2. Calcule los rangos medios de empates, sus sumas $R_h$ y el estadístico $H$.
3. Consulte cola chi-cuadrado con 2 grados de libertad.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
