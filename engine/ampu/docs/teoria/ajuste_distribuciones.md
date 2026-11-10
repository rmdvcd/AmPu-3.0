# Ajuste y comparación de distribuciones

## Definición formal

Busca parámetros que maximizan verosimilitud con límites declarados usando scipy.stats.fit.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `xᵢ` | Muestra numérica finita ≥5 |
| `θ` | Parámetros del modelo dentro de límites |
| `AIC` | Criterio de información para comparar modelos |


## Función, estadístico o regla de selección

$$
\hat\theta=\operatorname*{arg\,max}_{\theta}\sum_{i=1}^n\log f(x_i;\theta),\quad\mathrm{AIC}=2k-2\log L(\hat\theta)
$$

## Función de distribución acumulada (CDF)

CDF de referencia o del estimador bajo las hipótesis indicadas.

$$
F_{\hat\theta}(x)=\int_{-\infty}^{x}f(t;\hat\theta)\,\mathrm{d}t
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}_{\hat\theta}[X]=\int x f(x;\hat\theta)\,\mathrm{d}x,\quad\sigma=\sqrt{\operatorname{Var}_{\hat\theta}(X)}
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

KS tras estimar parámetros es **exploratoria**: su p sin corrección no debe usarse como prueba formal. Compare AIC solo en los mismos datos.

![Esquema de Ajuste y comparación de distribuciones](../imagenes/analisis.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Cargue una muestra positiva y elija exponencial.
2. Limite localización en cero y ajuste escala por máxima verosimilitud.
3. Revise histograma vs PDF, AIC y QQ-plot antes de concluir.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
