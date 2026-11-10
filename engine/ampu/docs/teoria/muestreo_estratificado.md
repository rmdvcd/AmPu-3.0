# Muestreo estratificado proporcional

## Definición formal

Divide la población en estratos disjuntos; toma una muestra aleatoria sin reemplazo en cada uno.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `N_h` | Tamaño entero de cada estrato |
| `N` | Suma de N_h |
| `n` | Tamaño de muestra total |


## Función, estadístico o regla de selección

$$
n_h\approx n\frac{N_h}{N},\qquad\sum_h n_h=n
$$

## Función de distribución acumulada (CDF)

CDF del indicador de inclusión o aproximación de diseño; no existe una única CDF de toda la técnica.

$$
P(I_{hi}\le t)=\begin{cases}0,&t<0\\1-n_h/N_h,&0\le t<1\\1,&t\ge1\end{cases}
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}[I_{hi}]=n_h/N_h,\quad\operatorname{Var}(I_{hi})=(n_h/N_h)(1-n_h/N_h)
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

Se usan mayores restos para obtener enteros de suma exactamente $n$. Cada $n_h$ está acotado por $N_h$; se reproducen sorteos con una sola semilla.

![Esquema de Muestreo estratificado proporcional](../imagenes/muestreo.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Dos estratos tienen $N_1=100$, $N_2=200$ y $n=30$.
2. Los tamaños proporcionales son $n_1=30(100/300)=10$, $n_2=20$.
3. Sortea 10 unidades del primero y 20 del segundo, sin reemplazo.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
