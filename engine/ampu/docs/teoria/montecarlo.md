# Integración y simulación Monte Carlo

## Definición formal

Estima integrales o probabilidades por promedios de valores aleatorios con semilla.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `N` | Número de simulaciones ≥2 |
| `a,b` | Extremos finitos con a<b |
| `semilla` | Semilla para reproducir la simulación |

## Fórmula y procedimiento

$$
\hat I_N=(b-a)\frac1N\sum_{j=1}^N f(U_j),\quad U_j\sim U(a,b)
$$

## Error de simulación

Con simulaciones independientes y varianza finita, el error estándar disminuye aproximadamente como $1/\sqrt N$. Para reducirlo a la mitad hacen falta unas cuatro veces más repeticiones. La semilla permite reproducir el resultado; no aumenta su precisión.

## Propiedades y casos especiales

El intervalo normal cubre error de simulación, no sesgos de modelo. En la estimación de π, cuatro veces la fracción de puntos en cuarto de círculo.

## Ejemplo resuelto, paso a paso

1. **Configuración.** En «Estimar π», usa **10 000** repeticiones, semilla **42** y confianza del 95 %.
2. **Conteo.** De los 10 000 puntos uniformes en el cuadrado unitario, 7 900 cumplen $u^2+v^2\le1$.
3. **Estimación.** $\hat\pi=4\cdot7900/10000=$ **3,16**, con error estándar aproximado **0,016293**.
4. **Incertidumbre.** El intervalo normal es aproximadamente **[3,128066; 3,191934]**. Describe error de simulación, no garantiza que toda ejecución incluya el valor exacto.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
