# Estadística descriptiva

## Definición formal

Resume un conjunto de observaciones con medidas robustas y gráficos exploratorios.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `xᵢ` | Datos numéricos finitos |
| `n` | Tamaño n≥2 |
| `s` | Desviación muestral |


## Función, estadístico o regla de selección

$$
\bar x=\frac1n\sum_i x_i,\quad s^2=\frac1{n-1}\sum_i(x_i-\bar x)^2
$$

## Función de distribución acumulada (CDF)

CDF de referencia o del estimador bajo las hipótesis indicadas.

$$
F_n(t)=\frac1n\sum_i\boldsymbol1(x_i\le t)
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}[\bar X]=\mu,\quad\operatorname{Var}(\bar X)=\sigma^2/n,\quad\sigma_{\bar X}=\sigma/\sqrt n
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

CV=$s/|\bar x|$ no se define con media cero. Cuartiles usan interpolación lineal; se reportan todas las modas empatadas.

![Esquema de Estadística descriptiva](../imagenes/analisis.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Datos (1,2,2,4,5), suma 14 y media 2,8.
2. Mediana y moda = 2; la varianza muestral se divide por $n-1=4$.
3. Constrúyase tabla de frecuencias y compare histograma con boxplot.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
