# Regresión lineal simple y múltiple

## Definición formal

Estima la respuesta a partir de predictores usando mínimos cuadrados ordinarios.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `y` | Variable respuesta numérica |
| `X` | Matriz de predictores de rango completo |
| `β` | Intercepto y coeficientes estimados |


## Función, estadístico o regla de selección

$$
\hat{\boldsymbol\beta}=(X^\top X)^{-1}X^\top\boldsymbol y,\quad\hat y_i=\hat\beta_0+\sum_j\hat\beta_j x_{ij}
$$

## Función de distribución acumulada (CDF)

CDF de referencia o del estimador bajo las hipótesis indicadas.

$$
F_{T_j}(t)=F_{t_{n-k-1}}(t),\quad T_j=\frac{\hat\beta_j}{\operatorname{SE}(\hat\beta_j)}
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}[\hat\beta_j]=\beta_j,\quad\operatorname{Var}(\hat{\boldsymbol\beta})=\sigma^2(X^\top X)^{-1}
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

La implementación resuelve por SVD (estable numéricamente), no invierte X para ajustar. $R^2$ y p-valores no prueban causalidad.

![Esquema de Regresión lineal simple y múltiple](../imagenes/regresion.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Para puntos $(1,3),(2,5),(3,7)$, estime pendiente 2 e intercepto 1.
2. Prediga $\hat y(4)=1+2(4)=9$.
3. Compare residuos, $R^2$ e IC t si hay grados de libertad residuales.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
