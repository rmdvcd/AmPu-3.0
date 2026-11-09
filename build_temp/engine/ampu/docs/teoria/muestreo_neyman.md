# Asignación de Neyman

## Definición formal

Distribuye tamaño estratificado según el tamaño y la variabilidad de cada estrato, a costes iguales.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `N_h` | Unidades en el estrato |
| `S_h` | Desviación esperada (≥0) |
| `n` | Tamaño total |


## Función, estadístico o regla de selección

$$
n_h\approx n\frac{N_hS_h}{\sum_j N_jS_j}
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

Se redondea preservando la suma y la capacidad. Si todas las $S_h=0$, no hay asignación informativa por dispersión.

![Esquema de Asignación de Neyman](../imagenes/muestreo.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Tome $(N_1,S_1)=(100,8)$, $(N_2,S_2)=(200,4)$, $n=40$.
2. Los pesos de Neyman son 800 y 800.
3. Asigne $n_1=n_2=20$, en vez de los tamaños proporcionales 13 y 27.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
