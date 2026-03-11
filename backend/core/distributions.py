# combinatorics.py

import numpy as np
from math import factorial
from data import ROLL_VALUES


def multinomial_probability(counts, N):
    counts = np.array(counts)
    if counts.sum() != N:
        return 0.0

    k = len(counts)
    p = 1.0 / k

    coeff = factorial(N)
    for c in counts:
        coeff //= factorial(int(c))

    return coeff * (p**N)


def possible_upgrade_distributions(num_stats, N):
    if num_stats == 1:
        yield (N,)
        return

    for i in range(N + 1):
        for tail in possible_upgrade_distributions(num_stats - 1, N - i):
            yield (i,) + tail


def roll_distribution(stat: str, rarity: int, k: int):
    """
    Devuelve la distribución exacta de la suma de k rolls
    para un stat dado y una rareza dada.

    Retorna:
        values: np.array de posibles valores acumulados
        probs:  np.array de probabilidades asociadas
    """

    # Caso sin upgrades
    if k == 0:
        return np.array([0.0]), np.array([1.0])

    if rarity not in ROLL_VALUES:
        raise ValueError(f"No roll values defined for rarity {rarity}")

    if stat not in ROLL_VALUES[rarity]:
        raise ValueError(f"No roll values defined for stat {stat} at rarity {rarity}")

    base_values = np.array(ROLL_VALUES[rarity][stat], dtype=float)
    base_probs = np.ones(len(base_values)) / len(base_values)

    # Primera convolución (k=1)
    values = base_values.copy()
    probs = base_probs.copy()

    # Convoluciones sucesivas
    for _ in range(k - 1):
        new_vals = []
        new_probs = []

        for v1, p1 in zip(values, probs):
            for v2, p2 in zip(base_values, base_probs):
                new_vals.append(v1 + v2)
                new_probs.append(p1 * p2)

        values = np.array(new_vals)
        probs = np.array(new_probs)

    return values, probs
