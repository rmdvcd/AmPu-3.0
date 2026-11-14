# Aleatorio simple · población grande

## Definición formal

Dimensiona un diseño de proporciones sin corrección finita; si se muestrea con reemplazo, cada sorteo es independiente.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `p` | Proporción supuesta (0,1) |
| `d` | Error absoluto tolerado >0 |
| `1−α` | Confianza estrictamente entre 0 y 1 |

## Fórmula y procedimiento

Para una confianza $1-\alpha$, usa el cuantil normal $z=z_{1-\alpha/2}$. Al 95 %, $z\approx1{,}959964$.

$$
n_0=\frac{z_{1-\alpha/2}^{2}p(1-p)}{d^2},\qquad n=\lceil n_0\rceil
$$

## Selección con reemplazo

En AmPu, cada sorteo elige uniformemente un identificador de la lista y lo devuelve antes del siguiente. Cada extracción tiene probabilidad $1/N$; la probabilidad de que una unidad aparezca al menos una vez es $1-(1-1/N)^n$, no $n/N$.

## Propiedades y casos especiales

Si $p$ es desconocida, usa $p=0{,}5$ como opción conservadora. Sin reemplazo, la independencia es una aproximación cuando la fracción de muestreo es pequeña.

## Ejemplo resuelto, paso a paso

1. **Datos.** Usa $p=0{,}5$, margen $d=0{,}05$ y confianza del 95 %, sin corrección de población finita.
2. **Cálculo.** $n_0=z^2(0{,}25)/0{,}05^2\approx384{,}1459$.
3. **Redondeo.** Necesitas **385** observaciones. En AmPu, este diseño sortea con reemplazo: un identificador puede repetirse.
4. **Interpretación.** El margen se refiere a estimar una proporción bajo el modelo supuesto; no equivale a una garantía para cualquier variable o diseño complejo.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
