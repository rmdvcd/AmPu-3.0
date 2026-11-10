# Muestreo sistemático

## Definición formal

Tras un inicio aleatorio sobre una lista ordenada, elige elementos a intervalos aproximadamente constantes.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `N` | Tamaño de la lista |
| `n` | Unidades deseadas (1 ≤ n ≤ N) |
| `r` | Inicio uniforme en [0, N/n) |


## Función, estadístico o regla de selección

$$
k=N/n,\qquad j_i=\lfloor r+ik\rfloor,\quad i=0,\ldots,n-1
$$

## Función de distribución acumulada (CDF)

CDF del indicador de inclusión o aproximación de diseño; no existe una única CDF de toda la técnica.

$$
P(I_i\le t)=\begin{cases}0,&t<0\\1-n/N,&0\le t<1\\1,&t\ge1\end{cases}
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}[I_i]=n/N,\quad\operatorname{Var}(I_i)=(n/N)(1-n/N)
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

Una periodicidad de la lista correlacionada con $k$ puede sesgar la muestra; se debe aleatorizar la lista si procede.

![Esquema de Muestreo sistemático](../imagenes/muestreo.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Si $N=40$ y $n=10$, el paso es $k=4$.
2. Con inicio $r=2$, los índices (desde cero) son 2, 6, 10, …, 38.
3. Extraiga esas 10 unidades, en orden y sin duplicados.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
