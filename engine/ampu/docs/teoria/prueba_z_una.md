# Prueba z · una media

## Definición formal

Contrasta $H_0:\mu=\mu_0$ si se conoce la desviación poblacional $\sigma$.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `μ₀` | Media bajo H₀ |
| `σ` | Desviación poblacional >0 |
| `α` | Nivel de significación en (0,1) |

## Fórmula y procedimiento

$$
Z=\frac{\bar X-\mu_0}{\sigma/\sqrt n}\overset{H_0}{\sim}N(0,1)
$$

## Distribución de referencia

Con desviación poblacional conocida y población normal, el estadístico es normal estándar bajo $H_0$. Para muestras grandes puede usarse una aproximación por el teorema central del límite. La prueba bilateral usa $2[1-\Phi(|z|)]$.

## Propiedades y casos especiales

Ofrece alternativas bilateral y unilaterales; p menor que α permite rechazar H₀, no prueba causalidad.

## Ejemplo resuelto, paso a paso

1. **Datos.** Usa `49 51 53 55`, una desviación poblacional conocida $\sigma=2$ y $H_0:\mu=50$. Supón población normal.
2. **Estadístico.** La media es 52 y el error estándar es $2/\sqrt4=1$. Por tanto, $z=(52-50)/1=$ **2**.
3. **Resultado.** El p-valor bilateral es $2[1-\Phi(2)]\approx$ **0,0455**.
4. **Conclusión.** A $\alpha=0{,}05$, rechaza $H_0$. La desviación conocida debe proceder de información externa; no sustituyas la desviación muestral para justificar una prueba z.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
