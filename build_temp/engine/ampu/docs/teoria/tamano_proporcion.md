# Tamaño muestral para proporciones

## Definición formal

Planifica precisión de proporciones; el caso conservador si $p$ no se conoce es $p=0,5$.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `p` | Proporción de diseño en (0,1) |
| `d` | Error absoluto |
| `N` | Tamaño finito opcional |


## Función, estadístico o regla de selección

$$
n_0=\left\lceil\frac{z_{1-\alpha/2}^2p(1-p)}{d^2}\right\rceil
$$

## Función de distribución acumulada (CDF)

CDF de referencia o del estimador bajo las hipótesis indicadas.

$$
P(\hat p\le t)\approx\Phi\left(\frac{t-p}{\sqrt{p(1-p)/n}}\right)
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}[\hat p]=p,\quad\operatorname{Var}(\hat p)=\frac{p(1-p)}n
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

Para $p=0$ o $1$ esta aproximación de diseño no informa sobre dispersión; se recomienda un estudio piloto.

![Esquema de Tamaño muestral para proporciones](../imagenes/muestreo.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Defina $p=0,5$, confianza 95 % y $d=0,05$.
2. Sustituya $n_0=1,960²(0,25)/(0,05²)=384,16$.
3. Requiera al menos 385 elementos; menos si la población finita es pequeña.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
