# Intervalos de confianza y error

## Definición formal

Un intervalo cuantifica variabilidad de un estimador, no la probabilidad posterior del parámetro fijo.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `1−α` | Cobertura nominal en (0,1) |
| `s` | Desviación muestral |
| `n` | Observaciones; n ≥2 |


## Función, estadístico o regla de selección

$$
IC_{1-\alpha}(\mu)=\bar x\pm t_{1-\alpha/2,n-1}\frac{s}{\sqrt n}
$$

## Función de distribución acumulada (CDF)

CDF de referencia o del estimador bajo las hipótesis indicadas.

$$
P\!\left(\bar X\le t\mid \mu,\sigma\right)\approx\Phi\left(\frac{t-\mu}{\sigma/\sqrt n}\right)
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}[\bar X]=\mu,\quad\operatorname{Var}(\bar X)=\sigma^2/n,\quad\sigma_{\bar X}=\sigma/\sqrt n
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

Para proporciones se usa Wilson, estable incluso con 0 o n éxitos. Error relativo = $|\hat\theta-\theta|/|\theta|$, indefinido si $\theta=0$.

![Esquema de Intervalos de confianza y error](../imagenes/inferencia.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Muestra de $n=16$, media 20, $s=4$ y confianza 95 %.
2. Con 15 grados de libertad, $t_{0,975}=2,131$.
3. IC: $20\pm2,131(4/4)=[17,87;22,13]$.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
