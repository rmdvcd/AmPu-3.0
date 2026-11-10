# Prueba z · una proporción

## Definición formal

Contrasta $H_0:p=p_0$ usando error estándar bajo la hipótesis nula.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `x` | Éxitos observados entre 0 y n |
| `n` | Ensayos positivos |
| `p₀` | Proporción nula en (0,1) |


## Función, estadístico o regla de selección

$$
Z=\frac{\hat p-p_0}{\sqrt{p_0(1-p_0)/n}},\quad\hat p=x/n
$$

## Función de distribución acumulada (CDF)

CDF de referencia o del estimador bajo las hipótesis indicadas.

$$
F_Z(z)\approx\Phi(z)\quad\text{si }np_0,n(1-p_0)\text{ son suficientes}
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}_{H_0}[Z]\approx0,\quad\operatorname{Var}_{H_0}(Z)\approx1
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

Para pocos ensayos conviene una prueba binomial exacta; el intervalo descriptivo es de Wilson, incluso con 0 éxitos.

![Esquema de Prueba z · una proporción](../imagenes/inferencia.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Observe 50 éxitos de 100 con $p_0=0,3$.
2. $z=(0,5-0,3)/\sqrt{0,3(0,7)/100}\approx4,364$.
3. La p bilateral es muy pequeña; rechace H₀ al 5 %.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
