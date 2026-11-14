# Intervalos de confianza y error

## Definición formal

Un intervalo cuantifica variabilidad de un estimador, no la probabilidad posterior del parámetro fijo.

## Parámetros y rango

| Parámetro | Significado y rango |
|---|---|
| `1−α` | Cobertura nominal en (0,1) |
| `s` | Desviación muestral |
| `n` | Observaciones; n ≥2 |

## Fórmula y procedimiento

$$
IC_{1-\alpha}(\mu)=\bar x\pm t_{1-\alpha/2,n-1}\frac{s}{\sqrt n}
$$

## Cobertura y supuestos

Con datos normales independientes y desviación poblacional desconocida, la media usa la referencia t. La confianza describe la cobertura del procedimiento en muestreos repetidos. Para una proporción, AmPu muestra Wilson en la prueba z o Clopper–Pearson en la binomial exacta; no se debe reutilizar la fórmula t.

## Propiedades y casos especiales

Para proporciones se usa Wilson, estable incluso con 0 o n éxitos. Error relativo = $|\hat\theta-\theta|/|\theta|$, indefinido si $\theta=0$.

## Ejemplo resuelto, paso a paso

1. **Datos.** Supón una muestra normal con $n=16$, media 20, desviación muestral 4 y confianza del 95 %.
2. **Margen.** Con 15 grados de libertad, $t_{0{,}975;15}\approx2{,}13145$ y $s/\sqrt n=1$.
3. **Intervalo.** $20\pm2{,}13145$ produce aproximadamente **[17,87; 22,13]**.
4. **Interpretación.** El método tiene cobertura del 95 % bajo sus supuestos en muestreos repetidos. No asigna un 95 % de probabilidad posterior al parámetro fijo de esta muestra.

## Referencias

- Casella, G., & Berger, R. L. (2002). *Statistical Inference* (2.ª ed.). Duxbury.
- Virtanen, P., et al. (2020). SciPy 1.0: Fundamental algorithms for scientific computing in Python. *Nature Methods, 17*, 261–272. https://doi.org/10.1038/s41592-019-0686-2
