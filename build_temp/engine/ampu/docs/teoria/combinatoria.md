# Combinatoria exacta

## Definición formal

Cuenta arreglos y elecciones finitas sin errores de coma flotante.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `n` | Elementos disponibles, entero ≥0 |
| `k` | Elementos elegidos, 0≤k≤n |


## Función, estadístico o regla de selección

$$
n!=\prod_{j=1}^n j,\quad P(n,k)=\frac{n!}{(n-k)!},\quad\binom nk=\frac{n!}{k!(n-k)!}
$$

## Función de distribución acumulada (CDF)

CDF de referencia o del estimador bajo las hipótesis indicadas.

$$
F_X(t)=\sum_{x\le t}P(X=x)\quad\text{una vez asignadas probabilidades a los arreglos}
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}[X]=\sum_x xP(X=x),\quad\operatorname{Var}(X)=\sum_x(x-\operatorname{E}[X])^2P(X=x)
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

Factorial 0! = 1. Con repeticiones de conteos $n_j$, las permutaciones distintas son $n!/\prod_j n_j!$.

![Esquema de Combinatoria exacta](../imagenes/analisis.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Elegir 3 de 10 sin orden da $\binom{10}{3}$.
2. Calcule $10·9·8/(3·2·1)=120$.
3. Si importa el orden, multiplique por $3!=6$ para 720 arreglos.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
