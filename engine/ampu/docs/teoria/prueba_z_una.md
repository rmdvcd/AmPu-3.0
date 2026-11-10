# Prueba z · una media

## Definición formal

Contrasta $H_0:\mu=\mu_0$ si se conoce la desviación poblacional $\sigma$.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `μ₀` | Media bajo H₀ |
| `σ` | Desviación poblacional >0 |
| `α` | Nivel de significación en (0,1) |


## Función, estadístico o regla de selección

$$
Z=\frac{\bar X-\mu_0}{\sigma/\sqrt n}\overset{H_0}{\sim}N(0,1)
$$

## Función de distribución acumulada (CDF)

CDF de referencia o del estimador bajo las hipótesis indicadas.

$$
F_Z(z)=\Phi(z)=\int_{-\infty}^{z}\frac{e^{-u^2/2}}{\sqrt{2\pi}}\,\mathrm{d}u
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}_{H_0}[Z]=0,\quad\operatorname{Var}_{H_0}(Z)=1,\quad\sigma_Z=1
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

Ofrece alternativas bilateral y unilaterales; p menor que α permite rechazar H₀, no prueba causalidad.

![Esquema de Prueba z · una media](../imagenes/inferencia.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Sea $n=25$, $\bar x=52$, $\mu_0=50$ y $\sigma=5$.
2. $z=(52-50)/(5/5)=2$.
3. p bilateral $=2[1-\Phi(2)]\approx0,0455$; a 5 %, rechace H₀.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
