# Referencia técnica de `backend/core`

Este documento describe qué contiene cada archivo Python de `core`, y detalla funciones/métodos con **entradas, salidas y cálculo interno**.

---

## `core/__init__.py`

- Archivo de paquete.
- Contenido actual: vacío.
- Rol: permitir importación del directorio como módulo Python.

---

## `core/models.py`

### `Artifact` (dataclass)

**Propósito**
- Estructura de datos mínima para representar un artefacto de entrada.

**Campos (inputs del modelo)**
- `rarity: int` → 3, 4 o 5.
- `level: int` → nivel actual del artefacto.
- `main_stat: str` → stat principal.
- `substats: dict` → mapa `{stat: valor_actual}`.

**Output**
- Instancia tipada consumida por `ArtifactEngine`.

**Cálculo interno**
- No hay lógica matemática; es un contenedor de datos.

---

## `core/data.py`

Contiene **constantes del modelo**:

- `UPGRADE_LEVELS`: niveles donde ocurre evento por rareza.
- `MAX_UPGRADES`: límite usado por frontend para discretización de valores de substats.
- `SUBSTAT_WEIGHTS`: pesos relativos de aparición.
- `ROLL_VALUES`: tiers de roll por rareza y stat.
- `MAX_SUBSTATS`: topes de valor de substats por rareza/stat.

**Uso interno**
- Consumido por `engine.py`, `combinatorics.py` y frontend (vía API) para cálculos y validaciones.

---

## `core/utilities.py`

### Clase `UtilityRegistry`

#### `register(name)`
- **Input:** `name: str`.
- **Output:** decorador que registra una función en `_registry[name]`.
- **Cálculo:** asociación nombre → callable.

#### `get(name)`
- **Input:** `name: str`.
- **Output:** función de utilidad registrada.
- **Cálculo:** lookup en diccionario; si no existe, `ValueError`.

#### `available()`
- **Input:** ninguno.
- **Output:** lista de nombres de funciones disponibles.
- **Cálculo:** `list(_registry.keys())`.

### Funciones de utilidad predefinidas

#### `crit_value(stats)` (`CV`)
- **Input:** `stats: dict`.
- **Output:** escalar de utilidad.
- **Fórmula:** `2*CR + CD`.

#### `atk_weighted(stats)` (`ATK_WEIGHTED`)
- **Input:** `stats: dict`.
- **Output:** escalar de utilidad.
- **Fórmula:** `2*CR + CD + 0.5*ATK%`.

#### `er_requirement(stats)` (`ER_REQUIREMENT`)
- **Input:** `stats: dict`.
- **Output:** escalar de utilidad.
- **Fórmula:**
  - Si `ER < 200` → `0`.
  - Si `ER >= 200` → `2*CR + CD`.

#### `raw_sum(stats)` (`RAW_SUM`)
- **Input:** `stats: dict`.
- **Output:** suma de todos los valores.
- **Fórmula:** `sum(stats.values())`.

---

## `core/combinatorics.py`

### `multinomial_probability(counts, N)`
- **Input:**
  - `counts`: vector de conteos por stat.
  - `N`: total de upgrades.
- **Output:** `float` de probabilidad.
- **Cálculo interno:**
  - valida `sum(counts) == N`; si no, retorna `0.0`.
  - asume probabilidad uniforme por stat `p=1/k` con `k=len(counts)`.
  - aplica multinomial:
    \[
    \frac{N!}{\prod_i c_i!}\,p^N
    \]

### `possible_upgrade_distributions(num_stats, N)`
- **Input:** número de stats activas y total de upgrades.
- **Output:** generador de todas las tuplas no negativas que suman `N`.
- **Cálculo interno:** recursión por composición entera de `N`.

### `roll_distribution(stat, rarity, k)`
- **Input:**
  - `stat: str`
  - `rarity: int`
  - `k: int` cantidad de rolls
- **Output:** `(values, probs)` arrays con distribución exacta de la suma de `k` rolls.
- **Cálculo interno:**
  - base `k=0` → valor `0` con probabilidad `1`.
  - valida existencia de tabla `ROLL_VALUES` para rareza/stat.
  - parte de distribución de 1 roll (4 tiers equiprobables).
  - aplica convolución discreta iterativa `k-1` veces.

---

## `core/distributions.py`

- En el estado actual del proyecto, contiene la misma implementación de combinatoria/distribución discreta (`multinomial_probability`, `possible_upgrade_distributions`, `roll_distribution`).
- `engine.py` importa `from distributions import *`; por eso este archivo participa directamente en cálculos de umbrales y upgrades.

**Nota técnica:**
- Hay solapamiento funcional con `combinatorics.py`. Si se busca mantenimiento más simple, conviene centralizar estas funciones en un solo módulo y ajustar imports.

---

## `core/engine.py`

Clase principal: `ArtifactEngine`.

### Constructor `__init__(artifact)`
- **Input:** instancia `Artifact`.
- **Output:** estado interno listo para inferencia.
- **Cálculo interno:** copia `rarity`, `level`, `main_stat`, `substats`.

### Utilidades internas

#### `next_levels()`
- **Output:** lista de niveles de evento restantes.
- **Cálculo:** filtra `UPGRADE_LEVELS[rarity]` por `> level`.

#### `max_level()`
- **Output:** último nivel de evento para esa rareza.

#### `remaining_events()`
- **Output:** entero con cantidad de eventos pendientes.
- **Cálculo:** `len(next_levels())`.

#### `available_substats()`
- **Output:** lista de substats que pueden aparecer.
- **Cálculo:** todas excepto las ya presentes y la `main_stat`.

#### `decompose_events()`
- **Output:** `(appearance, upgrades)`.
- **Cálculo:**
  - `total = remaining_events()`
  - `missing = max(0, 4 - len(substats))`
  - `appearance = min(missing, total)`
  - `upgrades = total - appearance`

---

### Modo 1: `distribution_events()`

**Input:** estado actual del artefacto.

**Output:**
```json
{
  "next_artifact": {"level": ..., "states": {...}},
  "max_artifact": {"level": ..., "states": {...}}
}
```

**Cálculo interno:**
1. Si ya está al máximo, retorna mensaje informativo.
2. `next_artifact.states`:
   - si faltan substats: aparición ponderada por `SUBSTAT_WEIGHTS`.
   - si ya hay 4: upgrade uniforme entre substats actuales.
3. `max_artifact.states`:
   - integra aparición por permutaciones ponderadas sin reemplazo.
   - combina con factor de upgrades (caso “todos los upgrades al mismo stat”).

---

### Modo 2: `probability_upgrade_vector(upgrade_counts, next_stats=None)`

**Inputs:**
- `upgrade_counts: List[int]` vector objetivo de upgrades.
- `next_stats: Optional[List[str]]` para forzar secuencia de aparición (opcional).

**Output:** dict con `probability` y `status`.

**Cálculo interno:**
1. Si rareza 3 → retorna 0 con estado explicativo.
2. Valida `sum(upgrade_counts) == upgrades`.
3. Si hay apariciones:
   - Sin `next_stats`: marginaliza sobre posibles apariciones ponderadas.
   - Con `next_stats`: condiciona en esa secuencia y multiplica probabilidad base.
4. Para la fase de upgrades usa `_upgrade_vector_prob`.

#### `_upgrade_vector_prob(substats, upgrades, counts)`
- **Input:** estado con substats activas, upgrades restantes, vector counts.
- **Output:** probabilidad multinomial.
- **Cálculo:** validaciones de dimensión/suma + `multinomial_probability`.

---

### Modo 3: `probability_minimum_threshold(thresholds, next_stats=None)`

**Inputs:**
- `thresholds: Dict[str, float]`
- `next_stats` opcional.

**Output:** `float` probabilidad total de cumplir umbrales.

**Cálculo interno:**
1. Si rareza 3 → retorna `0.0`.
2. Si hay apariciones:
   - sin `next_stats`: marginaliza sobre posibles apariciones.
   - con `next_stats`: condiciona y multiplica probabilidad base.
3. Evalúa `_threshold_prob` para la etapa de upgrades.

#### `_threshold_prob(substats, upgrades, thresholds)`
- **Input:** estado parcial, upgrades y umbrales.
- **Output:** probabilidad total.
- **Cálculo:**
  - enumera todas las distribuciones de upgrades.
  - pondera con multinomial.
  - para cada stat con umbral, usa `roll_distribution` y acumula probabilidad de exceder umbral.
  - multiplica contribuciones y suma sobre vectores.

---

### Modo 4: simulación Monte Carlo

#### `simulate_to_max(simulator)`
- **Input:** instancia de `ArtifactEngine` (parámetro llamado `simulator`).
- **Output:** copia de substats simuladas al máximo.
- **Cálculo:**
  - ejecuta apariciones ponderadas por pesos,
  - ejecuta upgrades con elección uniforme de stat objetivo + tier aleatorio.

#### `monte_carlo_distribution(N=10000)`
- **Input:** número de simulaciones.
- **Output:** resumen por stat (`mean`, `max`, `min`, `values`).
- **Cálculo:** repite `simulate_to_max` `N` veces y resume estadísticos.

---

### Modo 5: utilidad esperada (motor de decisión)

#### `expected_utility(utility, to="max", mc_samples=2000, risk_lambda=0.0)`
- **Inputs:**
  - `utility`: nombre registrado o función callable.
  - `to`: `"next"` o `"max"`.
  - `mc_samples`: muestras Monte Carlo.
  - `risk_lambda`: penalización de varianza.
- **Output:** dict de métricas según rama.
- **Cálculo:** resuelve `utility_fn` y delega a rama correspondiente.

#### `_expected_max_utility(utility_fn, mc_samples, risk_lambda)`
- **Output actual:**
  - `expected_utility`, `variance`, `risk_adjusted`,
  - `probability_positive`, `current_utility`, `expected_gain`,
  - `probability_of_improvement`, `recommendation`.
- **Cálculo:**
  1. descompone eventos (aparición/upgrades),
  2. si no hay apariciones, evalúa `_evaluate_upgrade_stage`,
  3. si hay apariciones, integra sobre permutaciones ponderadas,
  4. combina esperanza y segundo momento,
  5. aplica ajuste por riesgo: `risk_adjusted = E[U] - λ Var(U)`.

#### `_evaluate_upgrade_stage(substats, upgrades, utility_fn, mc_samples, risk_lambda)`
- **Output:** métricas de utilidad en la fase de upgrades.
- **Cálculo interno:**
  - enumera todos los vectores de conteos `counts`,
  - pondera cada vector con multinomial,
  - para cada vector, simula `mc_samples` draws de tiers,
  - estima media/varianza de utilidad y probabilidad de mejora positiva,
  - agrega resultados con pesos multinomiales.

#### `_expected_next_utility(utility_fn, mc_samples, risk_lambda)`
- **Output:**
  - `expected_gain`, `variance`, `risk_adjusted`,
  - `probability_positive`, `recommendation`.
- **Cálculo:**
  - simula únicamente el próximo evento,
  - construye distribución de ganancias `U(next)-U(current)`,
  - calcula media, varianza, probabilidad positiva y recomendación.

---

## `core/evaluator.py`

Clase auxiliar: `ArtifactEvaluator`.

### `evaluate(utility="CV", risk_lambda=0.0, threshold_gain=0.0)`
- **Inputs:** nombre de utilidad, lambda de riesgo, umbral de ganancia.
- **Output:** resultado de `engine.expected_utility` + etiqueta final `recommendation`.
- **Cálculo interno:**
  - llama a `expected_utility`,
  - define recomendación binaria de negocio:
    - `UPGRADE` si `expected_gain > threshold_gain`
    - `DO NOT UPGRADE` en caso contrario.

---

## `core/simulator.py`

Script de ejemplo/ensayo manual (no endpoint productivo):

- Construye un `Artifact`.
- Instancia `ArtifactEngine` y `ArtifactEvaluator`.
- Define una utilidad custom.
- Ejecuta:
  - `expected_utility(..., to="max")`
  - `expected_utility(..., to="next")`
- Incluye bloque comentado para histograma de Monte Carlo.

Útil para pruebas locales y validación exploratoria del motor.

---

## Resumen de flujo entre archivos

1. `models.py` define la estructura de entrada.
2. `data.py` aporta parámetros tabulados del juego/modelo.
3. `utilities.py` aporta funciones objetivo para decisión.
4. `combinatorics.py` / `distributions.py` aportan cálculo exacto discreto.
5. `engine.py` integra todo en 5 modos de inferencia.
6. `evaluator.py` aplica criterio de negocio final sobre la salida del motor.
7. `simulator.py` sirve como sandbox de ejecución.