# Aleatorio simple · población finita

## Definición formal

Cada subconjunto de $n$ unidades distintas entre $N$ tiene igual probabilidad; se selecciona sin reemplazo.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `N` | Entero positivo; tamaño de población |
| `n` | Entero entre 1 y N; tamaño de muestra |
| `p, d` | Proporción esperada y margen absoluto positivo |

## Fórmula y procedimiento

Para una confianza $1-\alpha$, usa el cuantil normal $z=z_{1-\alpha/2}$. Al 95 %, $z\approx1{,}959964$.

$$
n=\left\lceil\frac{Nn_0}{N-1+n_0}\right\rceil,\quad n_0=\frac{z_{1-\alpha/2}^2p(1-p)}{d^2}
$$

## Selección e inclusión

En un muestreo aleatorio simple sin reemplazo, cada conjunto de $n$ unidades tiene probabilidad $1/\binom{N}{n}$ y cada unidad tiene inclusión $n/N$. La corrección finita del tamaño se aplica al valor continuo antes de redondear hacia arriba.

## Propiedades y casos especiales

El tamaño de diseño no supera $N$ y se redondea **hacia arriba**. La corrección finita supone unidades igualmente probables.

## Ejemplo resuelto, paso a paso

1. **Datos.** Usa población $N=1000$, proporción esperada $p=0{,}5$, margen $d=0{,}05$ y confianza del 95 %.
2. **Tamaño inicial.** Con el cuantil normal sin redondear, $n_0=z^2(0{,}25)/0{,}05^2\approx384{,}1459$.
3. **Corrección.** Aplica $Nn_0/(N-1+n_0)$ y redondea solo al final: **278** unidades.
4. **Selección.** Traslada ese tamaño al diseño finito, fija una semilla y sortea. Los 278 identificadores deben ser distintos porque no hay reemplazo.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
