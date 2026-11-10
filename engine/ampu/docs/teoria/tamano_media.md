# Tamaño muestral para estimar medias

## Definición formal

Con desviación poblacional estimada $\sigma$, determina observaciones necesarias para un margen $d$.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `σ` | Desviación esperada >0 |
| `d` | Margen absoluto >0 |
| `N` | Población finita, opcional |


## Función, estadístico o regla de selección

$$
n_0=\left\lceil\left(\frac{z_{1-\alpha/2}\sigma}{d}\right)^2\right\rceil,\quad n_F=\left\lceil\frac{Nn_0}{N-1+n_0}\right\rceil
$$

## Función de distribución acumulada (CDF)

CDF de referencia o del estimador bajo las hipótesis indicadas.

$$
P(\bar X\le t)\approx\Phi\left(\frac{t-\mu}{\sigma/\sqrt{n}}\right)
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}[\bar X]=\mu,\quad\operatorname{Var}(\bar X)=\sigma^2/n,\quad\sigma_{\bar X}=\sigma/\sqrt n
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

Es una aproximación normal; para poblaciones finitas se aplica factor de corrección y tamaño ≤N.

![Esquema de Tamaño muestral para estimar medias](../imagenes/muestreo.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Suponga $\sigma=12$, $d=2$ y confianza 95 %.
2. Calcule $n_0=\lceil(1,960·12/2)^2\rceil=139$.
3. Si $N=500$, aplique corrección finita antes de extraer unidades.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
