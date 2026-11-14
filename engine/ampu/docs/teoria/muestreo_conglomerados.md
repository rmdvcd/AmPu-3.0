# Muestreo por conglomerados

## Definición formal

Selecciona grupos completos en una etapa o, en dos etapas, selecciona además unidades dentro de los grupos elegidos.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `G` | Cantidad de conglomerados |
| `g` | Conglomerados elegidos, g ≤ G |
| `m` | Unidades por grupo en segunda etapa, opcional |

## Fórmula y procedimiento

$$
P(C_j\ \mathrm{seleccionado})=\frac{g}{G}
$$

## Una o dos etapas

En una etapa se incluyen todas las unidades de los grupos elegidos y su probabilidad de inclusión es $g/G$. En dos etapas, si se sortean $m_j$ de las $N_j$ unidades del grupo seleccionado, la inclusión individual es $(g/G)(m_j/N_j)$. No confundas número de conglomerados con número total de personas.

## Propiedades y casos especiales

Elegir grupos suele ser barato, pero su homogeneidad interna aumenta el error respecto a MAS. En dos etapas: $\pi_{ij}=(g/G)(m_j/N_j)$.

## Ejemplo resuelto, paso a paso

1. **Datos.** Define 5 escuelas con 100 alumnos cada una y selecciona 2 conglomerados, con semilla 42.
2. **Inclusión.** Cada escuela tiene probabilidad $2/5=0{,}4$ de ser elegida.
3. **Una etapa.** Deja vacío el tamaño por grupo: se incluyen todos los alumnos de las escuelas elegidas, **200** en total.
4. **Dos etapas.** Si eliges 10 alumnos por escuela seleccionada, obtienes 20 en total. La probabilidad individual pasa a ser $(2/5)(10/100)=0{,}04$.

## Referencias

- Cochran, W. G. (1977). *Sampling Techniques* (3.ª ed.). Wiley.
- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
