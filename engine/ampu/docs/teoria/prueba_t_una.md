# Prueba t · una media

## Definición formal

Contrasta una media sin conocer la desviación poblacional, con varianza muestral $s^2$.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `μ₀` | Media hipotética |
| `n` | Muestra independiente de tamaño ≥2 |
| `s` | Desviación muestral positiva |

## Fórmula y procedimiento

$$
T=\frac{\bar X-\mu_0}{s/\sqrt n}\overset{H_0}{\sim}t_{n-1}
$$

## Distribución de referencia

Bajo $H_0$, observaciones independientes de una población normal producen un estadístico con distribución $t_{n-1}$. En la prueba bilateral, el p-valor es $2P(t_{n-1}\ge |t_{\mathrm{obs}}|)$. Con muestras grandes, la aproximación puede ser útil sin normalidad exacta.

## Propiedades y casos especiales

Con muestras pequeñas conviene explorar normalidad; varianza cero no permite prueba t.

## Ejemplo resuelto, paso a paso

1. **Datos.** Usa `4 5 6 7 8` y contrasta $H_0:\mu=4$ frente a una alternativa bilateral, con $\alpha=0{,}05$.
2. **Estadístico.** $n=5$, $\bar x=6$ y $s=\sqrt{2{,}5}$. El error estándar es $s/\sqrt5\approx0{,}707107$; por tanto, $t\approx$ **2,828427**.
3. **Probabilidad de referencia.** Con 4 grados de libertad, el p-valor bilateral es **0,047421**.
4. **Conclusión.** Como $p<0{,}05$, rechaza $H_0$ bajo los supuestos de la prueba. Con una muestra tan pequeña, la normalidad de la población es especialmente importante.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
