# Tamaño muestral para proporciones

## Definición formal

Planifica precisión de proporciones; el caso conservador si $p$ no se conoce es $p=0,5$.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `p` | Proporción de diseño en (0,1) |
| `d` | Error absoluto |
| `N` | Tamaño finito opcional |

## Fórmula y procedimiento

Para una confianza $1-\alpha$, usa el cuantil normal $z=z_{1-\alpha/2}$. Al 95 %, $z\approx1{,}959964$.

$$
\begin{aligned}
n_0&=\frac{z_{1-\alpha/2}^2p(1-p)}{d^2}\\[4pt]
n_\infty&=\lceil n_0\rceil\\[4pt]
n_F&=\left\lceil\frac{Nn_0}{N-1+n_0}\right\rceil
\end{aligned}
$$

## Margen y corrección finita

El margen es absoluto: 0,05 significa 5 puntos porcentuales. Si no hay una estimación previa, $p=0{,}5$ maximiza $p(1-p)$ y da el tamaño más conservador dentro de esta aproximación. La corrección finita solo corresponde a diseños sin reemplazo.

## Propiedades y casos especiales

Para $p=0$ o $1$ esta aproximación de diseño no informa sobre dispersión; se recomienda un estudio piloto.

## Ejemplo resuelto, paso a paso

1. **Datos.** Usa proporción esperada 0,5, confianza del 95 % y margen de 0,05, es decir, 5 puntos porcentuales.
2. **Sustitución.** $n_0=z^2(0{,}5)(1-0{,}5)/(0{,}05)^2\approx384{,}1459$.
3. **Tamaño.** Redondea hacia arriba: **385** observaciones si no aplicas corrección finita.
4. **Interpretación.** Para una población de 1 000 unidades y muestreo aleatorio simple sin reemplazo, la corrección reduce el requisito a **278**. No añadas esa corrección a un diseño con reemplazo.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
