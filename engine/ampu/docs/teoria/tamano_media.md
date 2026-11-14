# Tamaño muestral para estimar medias

## Definición formal

Con desviación poblacional estimada $\sigma$, determina observaciones necesarias para un margen $d$.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `σ` | Desviación esperada >0 |
| `d` | Margen absoluto >0 |
| `N` | Población finita, opcional |

## Fórmula y procedimiento

Para una confianza $1-\alpha$, usa el cuantil normal $z=z_{1-\alpha/2}$. Al 95 %, $z\approx1{,}959964$.

$$
\begin{aligned}n_0&=\left(\frac{z_{1-\alpha/2}\sigma}{d}\right)^2\\n_\infty&=\lceil n_0\rceil,\qquad n_F=\left\lceil\frac{Nn_0}{N-1+n_0}\right\rceil\end{aligned}
$$

## Margen y corrección finita

El margen está en unidades de la variable y requiere una estimación previa razonable de $\sigma$. Para población finita y muestreo aleatorio simple sin reemplazo, corrige $n_0$ sin redondear y toma el techo al final. No es un cálculo de potencia.

## Propiedades y casos especiales

Es una aproximación normal; para poblaciones finitas se aplica factor de corrección y tamaño ≤N.

## Ejemplo resuelto, paso a paso

1. **Datos.** Usa desviación esperada $\sigma=12$, margen absoluto $d=2$ y confianza del 95 %.
2. **Población grande.** $n_0=(z\cdot12/2)^2\approx138{,}2925$. Al redondear hacia arriba necesitas **139** observaciones.
3. **Población finita.** Si $N=500$, aplica la corrección a $n_0$ sin redondear y después toma el techo: **109** observaciones.
4. **Interpretación.** El margen está en las unidades originales de la variable. La precisión depende de que la desviación esperada y el diseño supuesto sean razonables.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
