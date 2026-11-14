# Prueba de Mann–Whitney U

## Definición formal

Prueba no paramétrica para dos grupos independientes basada en rangos.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `n₁,n₂` | Tamaños de los dos grupos |
| `R₁` | Suma de rangos del primero |

## Fórmula y procedimiento

$$
U_1=R_1-\frac{n_1(n_1+1)}2
$$

## Referencia y supuestos

Bajo igualdad de distribuciones, la referencia se obtiene de los rangos conjuntos. AmPu usa la referencia exacta si no hay empates y algún grupo tiene como máximo 8 datos; en los demás casos usa la aproximación normal con correcciones por empates y continuidad. No presupone normalidad.

## Propiedades y casos especiales

La interpretación como comparación de medianas presupone formas distribucionales similares; la referencia asintótica corrige el efecto de los empates.

## Ejemplo resuelto, paso a paso

1. **Datos.** Usa dos grupos independientes: A: `1 2 3` y B: `4 5 6`, con alternativa bilateral.
2. **Rangos.** La suma de rangos de A es 6 y $U_A=6-3\cdot4/2=$ **0**.
3. **Resultado.** Sin empates, el p-valor bilateral exacto es **0,1**.
4. **Conclusión.** No rechaces $H_0$ al 5 %. Incluso una separación completa puede no ser concluyente con solo tres observaciones por grupo.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
