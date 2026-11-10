# Prueba z · dos medias

## Definición formal

Compara dos medias independientes cuando ambas desviaciones poblacionales son conocidas.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `σ₁, σ₂` | Desviaciones poblacionales >0 |
| `n₁, n₂` | Tamaños muestrales independientes |
| `α` | Significación |


## Función, estadístico o regla de selección

$$
Z=\frac{\bar X_1-\bar X_2}{\sqrt{\sigma_1^2/n_1+\sigma_2^2/n_2}}
$$

## Función de distribución acumulada (CDF)

CDF de referencia o del estimador bajo las hipótesis indicadas.

$$
F_Z(z)=\Phi(z)\quad\text{bajo }H_0:\mu_1=\mu_2
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}_{H_0}[Z]=0,\quad\operatorname{Var}_{H_0}(Z)=1,\quad\sigma_Z=1
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

El IC de la diferencia usa el mismo error estándar pero no presupone igualdad de medias.

![Esquema de Prueba z · dos medias](../imagenes/inferencia.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. $\bar x_1=12$, $\bar x_2=10$, $\sigma_1=\sigma_2=3$, $n_1=n_2=18$.
2. $SE=\sqrt{9/18+9/18}=1$ y $z=2$.
3. p bilateral $\approx0,0455$; rechace H₀ al 5 %.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
