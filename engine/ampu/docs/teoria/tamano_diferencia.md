# Tamaños para diferencias de medias y proporciones

## Definición formal

Estima el tamaño **por grupo** de dos muestras independientes de igual tamaño.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `σ₁, σ₂` | Desviaciones poblacionales positivas |
| `p₁, p₂` | Proporciones de diseño en (0,1) |
| `d` | Margen absoluto |


## Función, estadístico o regla de selección

$$
n_{\bar X_1-\bar X_2}=\left\lceil\frac{z^2(\sigma_1^2+\sigma_2^2)}{d^2}\right\rceil,\quad n_{\hat p_1-\hat p_2}=\left\lceil\frac{z^2[p_1(1-p_1)+p_2(1-p_2)]}{d^2}\right\rceil
$$

## Función de distribución acumulada (CDF)

CDF de referencia o del estimador bajo las hipótesis indicadas.

$$
P(D\le t)\approx\Phi\left(\frac{t-\operatorname{E}[D]}{\sqrt{\operatorname{Var}(D)}}\right)
$$

## Media, varianza y desviación estándar

$$
\operatorname{Var}(\bar X_1-\bar X_2)=\frac{\sigma_1^2+\sigma_2^2}{n},\quad\sigma_D=\sqrt{\operatorname{Var}(D)}
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

Los tamaños son por brazo y suponen independencia; no incorporan potencia de prueba de hipótesis.

![Esquema de Tamaños para diferencias de medias y proporciones](../imagenes/muestreo.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Con $\sigma_1=3$, $\sigma_2=4$, $d=2$ y confianza 95 %, use $z=1,960$.
2. Calcule $n=\lceil1,960²(9+16)/4\rceil=25$.
3. Seleccione 25 unidades **en cada grupo**; total 50.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
