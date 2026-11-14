# Combinatoria exacta

## Definición formal

Cuenta arreglos y elecciones finitas sin errores de coma flotante.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `n` | Elementos disponibles, entero ≥0 |
| `k` | Elementos elegidos, 0≤k≤n |

## Fórmula y procedimiento

$$
\begin{aligned}n!&=\prod_{j=1}^n j\\P(n,k)&=\frac{n!}{(n-k)!}\\\binom nk&=\frac{n!}{k!(n-k)!}\end{aligned}
$$

## Elige el recuento adecuado

Usa factorial para ordenar todos los elementos distintos; permutaciones para elegir y ordenar; combinaciones cuando el orden no importa. Un recuento no es una probabilidad hasta que se especifican los resultados posibles y sus probabilidades.

## Propiedades y casos especiales

Factorial 0! = 1. Con repeticiones de conteos $n_j$, las permutaciones distintas son $n!/\prod_j n_j!$.

## Ejemplo resuelto, paso a paso

1. **Datos.** Elige 3 elementos de un conjunto de 10, sin repetición y sin importar el orden.
2. **Cálculo.** $\binom{10}{3}=10\cdot9\cdot8/(3\cdot2\cdot1)=$ **120** combinaciones.
3. **Comparación.** Si el orden sí importa, cada selección admite $3!=6$ órdenes: $120\cdot6=$ **720** permutaciones.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
