# Tamaños para diferencias de medias y proporciones

## Definición formal

Estima el tamaño **por grupo** de dos muestras independientes de igual tamaño.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `σ₁, σ₂` | Desviaciones poblacionales positivas |
| `p₁, p₂` | Proporciones de diseño en (0,1) |
| `d` | Margen absoluto |

## Fórmula y procedimiento

Para una confianza $1-\alpha$, usa el cuantil normal $z=z_{1-\alpha/2}$. Al 95 %, $z\approx1{,}959964$.

$$
\begin{aligned}n_{\bar X_1-\bar X_2}&=\left\lceil\frac{z^2(\sigma_1^2+\sigma_2^2)}{d^2}\right\rceil\\[4pt]n_{\hat p_1-\hat p_2}&=\left\lceil\frac{z^2[p_1(1-p_1)+p_2(1-p_2)]}{d^2}\right\rceil\end{aligned}
$$

## Diseño y alcance

Ambas fórmulas suponen grupos independientes del mismo tamaño y devuelven $n$ **por grupo**. Se basan en un margen normal aproximado; no incluyen potencia, efecto mínimo detectable, no respuesta ni un diseño por conglomerados.

## Propiedades y casos especiales

No redondees desviaciones ni proporciones antes de calcular. Toma el techo al final y considera por separado pérdidas, no respuesta y efecto del diseño.

## Ejemplo resuelto, paso a paso

1. **Datos.** Para dos medias independientes, usa $\sigma_1=3$, $\sigma_2=4$, margen $d=2$ y confianza del 95 %.
2. **Sustitución.** $n_0=z^2(3^2+4^2)/2^2\approx24{,}0091$.
3. **Tamaño.** Redondea hacia arriba: **25** unidades en cada grupo, **50** en total.
4. **Interpretación.** Este cálculo controla el margen de una diferencia de medias. No es un cálculo de potencia para detectar un efecto. Para diferencias de proporciones, usa la fórmula específica y un margen entre 0 y 1.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
