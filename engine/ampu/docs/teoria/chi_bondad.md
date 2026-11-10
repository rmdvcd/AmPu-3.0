# Chi-cuadrado · bondad de ajuste

## Definición formal

Compara frecuencias observadas con frecuencias esperadas por un modelo categórico.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `Oᵢ` | Frecuencia observada ≥0 |
| `Eᵢ` | Frecuencia esperada positiva |
| `m` | Parámetros estimados de estos datos |


## Función, estadístico o regla de selección

$$
X^2=\sum_{i=1}^{k}\frac{(O_i-E_i)^2}{E_i},\quad\nu=k-1-m
$$

## Función de distribución acumulada (CDF)

CDF de referencia o del estimador bajo las hipótesis indicadas.

$$
F_{X^2}(x)=\frac{\gamma(\nu/2,x/2)}{\Gamma(\nu/2)}
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}[X^2]=\nu,\quad\operatorname{Var}(X^2)=2\nu,\quad\sigma=\sqrt{2\nu}
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

Pocas frecuencias esperadas (<5) debilitan la aproximación asintótica. El p-valor es cola derecha.

![Esquema de Chi-cuadrado · bondad de ajuste](../imagenes/inferencia.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Tome observadas (12,15,23) y esperadas (15,15,20).
2. $X^2=(12-15)^2/15+0+(23-20)^2/20=1,05$.
3. Con $\nu=2$, p $\approx0,592$; no rechace H₀ al 5 %.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
