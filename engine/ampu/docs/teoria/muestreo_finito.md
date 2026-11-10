# Aleatorio simple · población finita

## Definición formal

Cada subconjunto de $n$ unidades distintas entre $N$ tiene igual probabilidad; se selecciona sin reemplazo.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `N` | Entero positivo; tamaño de población |
| `n` | Entero entre 1 y N; tamaño de muestra |
| `p, d` | Proporción esperada y margen absoluto positivo |


## Función, estadístico o regla de selección

$$
n=\left\lceil\frac{Nn_0}{N-1+n_0}\right\rceil,\quad n_0=\frac{z_{1-\alpha/2}^2p(1-p)}{d^2}
$$

## Función de distribución acumulada (CDF)

CDF del indicador de inclusión o aproximación de diseño; no existe una única CDF de toda la técnica.

$$
P(I_i\le t)=\begin{cases}0,&t<0\\1-n/N,&0\le t<1\\1,&t\ge1\end{cases}
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}[I_i]=\pi_i=\frac nN,\quad\operatorname{Var}(I_i)=\pi_i(1-\pi_i),\quad\sigma_i=\sqrt{\pi_i(1-\pi_i)}
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

El tamaño de diseño no supera $N$ y se redondea **hacia arriba**. La corrección finita supone unidades igualmente probables.

![Esquema de Aleatorio simple · población finita](../imagenes/muestreo.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Para $N=1000$, $p=0,5$, confianza 95 % y $d=0,05$, calcule $z=1,960$.
2. Obtenga $n_0=1,960^2(0,5)(0,5)/0,05^2=384,16$.
3. Corrija: $n=\lceil1000(384,16)/(999+384,16)\rceil=278$. Seleccione 278 identificadores distintos con semilla.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
