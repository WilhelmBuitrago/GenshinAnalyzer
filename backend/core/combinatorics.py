# combinatorics.py

import numpy as np
from math import factorial


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
