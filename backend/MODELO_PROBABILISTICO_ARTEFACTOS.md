# Modelo probabilístico de artefactos (Genshin Analyzer)

Este documento describe matemáticamente el modelo implementado en `backend/core` para pronosticar resultados de un artefacto: aparición de substats, upgrades, umbrales, simulación Monte Carlo y utilidad esperada.

---

## 1) Variables y notación

- Rareza: $r \in \{3,4,5\}$
- Nivel actual: $\ell$
- Niveles de evento por rareza: $L_r$
- Substats actuales: conjunto $S$, con $|S|\le 4$
- Main stat: $m$
- Pool elegible de aparición: $\Omega = \{s \neq m : s \notin S\}$
- Peso de aparición por stat: $w_s$
- Valores por roll para stat $s$ y rareza $r$: $R_{r,s} = \{v_1,v_2,v_3,v_4\}$

Eventos restantes:
$
N_{\text{events}} = |\{x \in L_r : x > \ell\}|
$

Descomposición de eventos:
$
N_{\text{appear}} = \min(\max(0,4-|S|), N_{\text{events}}), \quad
N_{\text{up}} = N_{\text{events}} - N_{\text{appear}}
$

---

## 2) Parámetros del modelo

### 2.1 Niveles de upgrade por rareza

| Rareza | Niveles de evento | Máx. eventos (de 0 al tope) |
|---|---|---|
| 3★ | [4, 8, 12] | 3 |
| 4★ | [4, 8, 12, 16] | 4 |
| 5★ | [4, 8, 12, 16, 20] | 5 |

### 2.2 `MAX_UPGRADES` (usado en frontend para discretización)

| Rareza | `MAX_UPGRADES` |
|---|---:|
| 3★ | 1 |
| 4★ | 3 |
| 5★ | 5 |

### 2.3 Pesos relativos de aparición de substats (`SUBSTAT_WEIGHTS`)

| Stat | Peso |
|---|---:|
| HP | 6 |
| ATK | 6 |
| DEF | 6 |
| HP% | 4 |
| ATK% | 4 |
| DEF% | 4 |
| ER | 4 |
| EM | 4 |
| CR | 3 |
| CD | 3 |

Probabilidad condicional de aparición de $s$ en un paso dado el pool actual $\Omega_t$:
$
P(s\mid \Omega_t)=\frac{w_s}{\sum_{j\in\Omega_t} w_j}
$

### 2.4 Valores por roll (`ROLL_VALUES`)

#### Rareza 3★

| Stat | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---:|---:|---:|---:|
| HP | 100.38 | 114.72 | 129.06 | 143.40 |
| ATK | 6.54 | 7.47 | 8.40 | 9.34 |
| DEF | 7.78 | 8.89 | 10.00 | 11.11 |
| HP% | 2.45 | 2.80 | 3.15 | 3.50 |
| ATK% | 2.45 | 2.80 | 3.15 | 3.50 |
| DEF% | 3.06 | 3.50 | 3.93 | 4.37 |
| EM | 9.79 | 11.19 | 12.59 | 13.99 |
| ER | 2.72 | 3.11 | 3.50 | 3.89 |
| CR | 1.63 | 1.86 | 2.10 | 2.33 |
| CD | 3.26 | 3.73 | 4.20 | 4.66 |

#### Rareza 4★

| Stat | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---:|---:|---:|---:|
| HP | 167.30 | 191.20 | 215.10 | 239.00 |
| ATK | 10.89 | 12.45 | 14.00 | 15.56 |
| DEF | 12.96 | 14.82 | 16.67 | 18.52 |
| HP% | 3.26 | 3.73 | 4.20 | 4.66 |
| ATK% | 3.26 | 3.73 | 4.20 | 4.66 |
| DEF% | 4.08 | 4.66 | 5.25 | 5.83 |
| EM | 13.06 | 14.92 | 16.79 | 18.65 |
| ER | 3.63 | 4.14 | 4.66 | 5.18 |
| CR | 2.18 | 2.49 | 2.80 | 3.11 |
| CD | 4.35 | 4.97 | 5.60 | 6.22 |

#### Rareza 5★

| Stat | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---:|---:|---:|---:|
| HP | 209.13 | 239.00 | 268.88 | 298.75 |
| ATK | 13.62 | 15.56 | 17.51 | 19.45 |
| DEF | 16.20 | 18.52 | 20.83 | 23.15 |
| HP% | 4.08 | 4.66 | 5.25 | 5.83 |
| ATK% | 4.08 | 4.66 | 5.25 | 5.83 |
| DEF% | 5.10 | 5.83 | 6.56 | 7.29 |
| EM | 16.32 | 18.65 | 20.98 | 23.31 |
| ER | 4.53 | 5.18 | 5.83 | 6.48 |
| CR | 2.72 | 3.11 | 3.50 | 3.89 |
| CD | 5.44 | 6.22 | 6.99 | 7.77 |

Supuesto en el código para cada roll: tier equiprobable.
$
P(V=v_i)=\frac14
$

---

## 3) Probabilidad de distribución de upgrades entre 4 substats

El motor usa distribución multinomial uniforme cuando hay $k$ substats activas:
$
(c_1,\dots,c_k) \sim \text{Multinomial}\big(N_{\text{up}}, p_i=1/k\big)
$

Probabilidad de un vector específico $\mathbf c$:
$
P(\mathbf c)=\frac{N_{\text{up}}!}{\prod_i c_i!}\left(\frac1k\right)^{N_{\text{up}}},
\quad \sum_i c_i=N_{\text{up}}
$

### Caso típico $k=4$: ratios agregados por patrón

#### 3★ (`MAX_UPGRADES=1`)

| Patrón (ordenado) | Probabilidad |
|---|---:|
| (1,0,0,0) | 1.000000 |

#### 4★ (`MAX_UPGRADES=3`)

| Patrón (ordenado) | Probabilidad agregada |
|---|---:|
| (3,0,0,0) | 0.062500 |
| (2,1,0,0) | 0.562500 |
| (1,1,1,0) | 0.375000 |

#### 5★ (`MAX_UPGRADES=5`)

| Patrón (ordenado) | Probabilidad agregada |
|---|---:|
| (5,0,0,0) | 0.003906 |
| (4,1,0,0) | 0.058594 |
| (3,2,0,0) | 0.117188 |
| (3,1,1,0) | 0.234375 |
| (2,2,1,0) | 0.351562 |
| (2,1,1,1) | 0.234375 |

---

## 4) Modo 1: `distribution_events`

### 4.1 Next event

- Si $|S|<4$: el siguiente evento es aparición, con probabilidad ponderada por pesos sobre el pool elegible.
- Si $|S|=4$: el siguiente evento es upgrade uniforme entre substats actuales.

### 4.2 Max level (resumen implementado)

- Descompone en apariciones y upgrades restantes.
- Calcula probabilidad de aparición de cada stat mediante suma sobre permutaciones ponderadas sin reemplazo.
- Multiplica por $p_{\text{all upgrades}}=(1/|S|)^{N_{\text{up}}}$ cuando corresponde para la parte “todos los upgrades a ese stat”.

---

## 5) Modo 2: `probability_upgrade_vector`

Objetivo: $P(\mathbf c)$ para un vector de upgrades deseado.

- Valida que $\sum c_i=N_{\text{up}}$.
- Si hay apariciones pendientes:
  - `next_stats=None`: marginaliza sobre posibles apariciones ponderadas.
  - `next_stats` dado: condiciona en esa secuencia de aparición.
- Finalmente usa multinomial uniforme para los upgrades.

Salida base:
- `probability`: probabilidad final.
- `status`: estado/validación.

---

## 6) Modo 3: `probability_minimum_threshold`

Para cada vector de upgrades $\mathbf c$:

1. Probabilidad multinomial $P(\mathbf c)$.
2. Para cada stat restringido por umbral $T_s$:
  - Obtiene distribución exacta de suma de $k=c_s$ rolls por convolución discreta.
   - Ajusta con valor base actual del stat.
  - Multiplica la probabilidad de cumplir $X_s \ge T_s$.
3. Suma total:
$
P(\text{cumple umbrales}) = \sum_{\mathbf c} P(\mathbf c)\prod_{s\in\Theta}P(X_s\ge T_s\mid c_s)
$

Si hay apariciones pendientes, también marginaliza (o condiciona) sobre ellas.

---

## 7) Modo 4: `monte_carlo_distribution`

- Ejecuta $N$ simulaciones completas hasta nivel máximo.
- En cada simulación:
  - Resuelve apariciones con `random.choices` ponderado por pesos.
  - Resuelve upgrades con elección uniforme de stat + tier uniforme de roll.
- Resume por stat: media, mínimo, máximo y muestras.

---

## 8) Modo 5: `expected_utility`

Sea $U(\cdot)$ la función de utilidad (predefinida o custom).

### 8.1 Rama `to="next"`

- Simula $mc\_samples$ veces solo el siguiente evento.
- Ganancia por muestra: $G = U(S')-U(S)$.
- Métricas:
$
\mathbb E[G],\quad \mathrm{Var}(G),\quad
\text{risk\_adjusted}=\mathbb E[G]-\lambda\mathrm{Var}(G),\quad
P(G>0)
$
- Recomendación: `CONTINUE` si `risk_adjusted > 0`, si no `STOP`.

### 8.2 Rama `to="max"`

- Si no hay apariciones: evalúa directamente la etapa de upgrades.
- Si hay apariciones:
  - recorre permutaciones de aparición ponderadas,
  - fija tier inicial nuevo como media de tiers del stat,
  - integra esperanza y segundo momento sobre cada rama.

Métricas en salida:
- `expected_utility = $\mathbb E[U(S_{max})]$`
- `variance = $\mathbb E[U^2]-\mathbb E[U]^2$`
- `risk_adjusted = $\mathbb E[U]-\lambda\,\mathrm{Var}(U)$`
- `current_utility = $U(S_{actual})$`
- `expected_gain = $\mathbb E[U]-U(S_{actual})$`
- `probability_positive` (estimada vía Monte Carlo interno de upgrades)
- `recommendation = CONTINUE` si `(risk_adjusted - current_utility) > 0`, si no `STOP`

---

## 9) Funciones de utilidad registradas

- `CV`: $2\cdot CR + CD$
- `ATK_WEIGHTED`: $2\cdot CR + CD + 0.5\cdot ATK\%$
- `ER_REQUIREMENT`: 0 si $ER<200$, si no $2\cdot CR + CD$
- `RAW_SUM`: suma directa de todos los substats presentes.

---

## 10) Supuestos y alcance del modelo

1. Los tiers de roll son equiprobables.
2. Upgrade target uniforme entre substats activas.
3. Apariciones sin reemplazo ponderadas por pesos de `SUBSTAT_WEIGHTS`.
4. El valor inicial de una substat recién aparecida en `expected_max` se aproxima por media de tiers.
5. El modelo usa mezcla exacta (combinatoria/convolución) y Monte Carlo según el modo.

Estos supuestos están alineados con la implementación actual del motor.