# Muestreo por conglomerados

## Definición formal

Sortea grupos completos en una etapa, o sorteos adicionales dentro de grupos elegidos en dos etapas.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `G` | Cantidad de conglomerados |
| `g` | Conglomerados elegidos, g ≤ G |
| `m` | Unidades por grupo en segunda etapa, opcional |


## Función, estadístico o regla de selección

$$
P(C_j\ \mathrm{seleccionado})=\frac{g}{G}
$$

## Función de distribución acumulada (CDF)

CDF del indicador de inclusión o aproximación de diseño; no existe una única CDF de toda la técnica.

$$
P(I_j\le t)=\begin{cases}0,&t<0\\1-g/G,&0\le t<1\\1,&t\ge1\end{cases}
$$

## Media, varianza y desviación estándar

$$
\operatorname{E}[I_j]=g/G,\quad\operatorname{Var}(I_j)=(g/G)(1-g/G)
$$

Si no se explicita $\sigma=\sqrt{\operatorname{Var}}$, se obtiene como raíz cuadrada de la varianza; cuando no existe, no debe reportarse un valor numérico.

## Propiedades y casos especiales

Elegir grupos suele ser barato, pero su homogeneidad interna aumenta el error respecto a MAS. En dos etapas: $\pi_{ij}=(g/G)(m_j/N_j)$.

![Esquema de Muestreo por conglomerados](../imagenes/muestreo.png)

*Figura 1. Representación orientativa del procedimiento o de su distribución de referencia.*

## Ejemplo resuelto, paso a paso

1. Enumere $G=5$ escuelas y sortee $g=2$ sin reemplazo.
2. La probabilidad de inclusión de cada escuela es $2/5=0,4$.
3. Incluya a todos los alumnos seleccionados, o sortee $m$ en cada escuela.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
