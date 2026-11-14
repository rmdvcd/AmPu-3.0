# Probabilidad condicional y Bayes

## Definición formal

Actualiza la probabilidad de una hipótesis tras una observación mediante una partición exhaustiva.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `Bᵢ` | Hipótesis disjuntas que suman 1 |
| `A` | Evidencia de probabilidad positiva |

## Fórmula y procedimiento

$$
P(B_i\mid A)=\frac{P(A\mid B_i)P(B_i)}{\sum_jP(A\mid B_j)P(B_j)}
$$

## Cómo aplicar la regla

Las hipótesis $B_i$ deben ser disjuntas y exhaustivas. Multiplica cada probabilidad previa por su verosimilitud, suma para obtener $P(A)$ y divide cada producto entre esa suma. Si $P(A)=0$, no hay una posterior definida por esta regla.

## Propiedades y casos especiales

Dos eventos son independientes si $P(A\cap B)=P(A)P(B)$; condicionar en un evento imposible no está definido.

## Ejemplo resuelto, paso a paso

1. **Datos.** Usa dos hipótesis con probabilidades previas 0,4 y 0,6. Las verosimilitudes de la evidencia son 0,5 y 0,1, respectivamente.
2. **Evidencia.** Multiplica y suma: $P(A)=0{,}4\cdot0{,}5+0{,}6\cdot0{,}1=$ **0,26**.
3. **Actualización.** La primera probabilidad posterior es $0{,}20/0{,}26=10/13\approx$ **0,769231**. La segunda es $3/13\approx0{,}230769$.
4. **Comprobación.** Las posteriores suman 1. La evidencia ha aumentado la probabilidad de la primera hipótesis, pero no la ha convertido en certeza.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
