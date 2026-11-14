# Regresión lineal simple y múltiple

## Definición formal

Estima la respuesta a partir de predictores usando mínimos cuadrados ordinarios.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `y` | Variable respuesta numérica |
| `X` | Matriz de predictores de rango completo |
| `β` | Intercepto y coeficientes estimados |

## Fórmula y procedimiento

$$
\hat{\boldsymbol\beta}=(X^\top X)^{-1}X^\top\boldsymbol y,\quad\hat y_i=\hat\beta_0+\sum_j\hat\beta_j x_{ij}
$$

En esta notación, $X$ incluye una columna de unos para el intercepto. La fórmula matricial supone rango completo; el algoritmo numérico no necesita formar la inversa.

## Predicción e incertidumbre

La respuesta media estimada es $\hat y=\boldsymbol{x}^{\top}\hat{\boldsymbol\beta}$. Los intervalos clásicos suponen errores independientes, homocedásticos y aproximadamente normales. Un intervalo para una observación nueva es más ancho que el intervalo de su media porque incluye variación individual.

## Propiedades y casos especiales

AmPu resuelve el ajuste por SVD, sin invertir explícitamente la matriz. $R^2$ no prueba causalidad. Añadir predictores no reduce $R^2$ en un ajuste OLS con intercepto sobre los mismos datos, pero sí puede reducir el $R^2$ ajustado.

## Ejemplo resuelto, paso a paso

1. **Datos.** Usa X: `1 2 3 4` e Y: `3 4 7 8`. Las medias son 2,5 y 5,5.
2. **Ajuste.** La pendiente es $9/5=$ **1,8** y el intercepto es $5{,}5-1{,}8\cdot2{,}5=$ **1**. La recta es $\hat y=1+1{,}8x$.
3. **Predicción.** Para $x=2{,}5$, la respuesta media estimada es **5,5**.
4. **Diagnóstico.** Los residuos son 0,2; −0,6; 0,6; −0,2 y $R^2\approx$ **0,952941**. Revisa los supuestos antes de interpretar intervalos o extrapolar.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
