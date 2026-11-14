# Muestreo estratificado proporcional

## Definición formal

Divide la población en estratos disjuntos; toma una muestra aleatoria sin reemplazo en cada uno.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `N_h` | Tamaño entero de cada estrato |
| `N` | Suma de N_h |
| `n` | Tamaño de muestra total |

## Fórmula y procedimiento

$$
n_h\approx n\frac{N_h}{N},\qquad\sum_h n_h=n
$$

## Selección e inclusión

Los estratos forman una partición de la población. Dentro del estrato $h$, se seleccionan $n_h$ unidades sin reemplazo; su probabilidad de inclusión es $n_h/N_h$. Los redondeos deben conservar el tamaño total sin superar el tamaño de ningún estrato.

## Propiedades y casos especiales

Se usan mayores restos para obtener enteros de suma exactamente $n$. Cada $n_h$ está acotado por $N_h$; se reproducen sorteos con una sola semilla.

## Ejemplo resuelto, paso a paso

1. **Datos.** Define dos estratos, A con 100 unidades y B con 200, y fija un tamaño total de 30.
2. **Asignación.** $n_A=30(100/300)=$ **10** y $n_B=30(200/300)=$ **20**.
3. **Selección.** Desactiva el tamaño automático, elige el diseño proporcional y usa la semilla 42. Extrae 10 identificadores de A y 20 de B, sin reemplazo.
4. **Interpretación.** Para estimar una media poblacional, combina las medias de los estratos con pesos $100/300$ y $200/300$.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
