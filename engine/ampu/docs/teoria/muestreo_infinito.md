# Aleatorio simple · población grande

## Definición formal

Dimensiona un diseño de proporciones sin corrección finita; si se muestrea con reemplazo, cada sorteo es independiente.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `p` | Proporción supuesta (0,1) |
| `d` | Error absoluto tolerado >0 |
| `1−α` | Confianza estrictamente entre 0 y 1 |


## Función, estadístico o regla de selección

$$
n_0=\left\lceil\frac{z_{1-\alpha/2}^{2}p(1-p)}{d^2}\right\rceil
$$

## Función de distribución acumulada (CDF)

CDF del indicador de inclusión o aproximación de diseño; no existe una única CDF de toda la técnica.

$$
P(I_i\le t)=\begin{cases}0,&t<0\\1-p_i,&0\le t<1\\1,&t\ge1\end{cases}
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}[I_i]=p_i,\quad\operatorname{Var}(I_i)=p_i(1-p_i),\quad\sigma_i=\sqrt{p_i(1-p_i)}
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

Si $p$ es desconocida, usar $p=0,5$ es conservador. Independencia real requiere reemplazo o población suficientemente grande.

![Esquema de Aleatorio simple · población grande](../imagenes/muestreo.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Fije confianza 95 %, $p=0,5$ y error $d=0,05$.
2. Calcule $n_0=1,960^2(0,25)/0,0025=384,16$.
3. Redondee hacia arriba: 385 observaciones. Con reemplazo, una misma unidad puede repetirse.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
