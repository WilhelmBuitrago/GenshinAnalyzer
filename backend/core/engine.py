# engine.py

import numpy as np
from data import *
from combinatorics import *
from distributions import *
import random
from utilities import UtilityRegistry
from collections import Counter


class ArtifactEngine:

    def __init__(self, artifact):
        self.artifact = artifact
        self.rarity = artifact.rarity
        self.level = artifact.level
        self.substats = artifact.substats.copy()
        self.main_stat = artifact.main_stat

    # -----------------------
    # UTILIDADES INTERNAS
    # -----------------------

    def next_levels(self):
        return [lvl for lvl in UPGRADE_LEVELS[self.rarity] if lvl > self.level]

    def max_level(self):
        return UPGRADE_LEVELS[self.rarity][-1]

    def remaining_events(self):
        return len(self.next_levels())

    def available_substats(self):
        return [
            s for s in SUBSTAT_WEIGHTS if s not in self.substats and s != self.main_stat
        ]

    def decompose_events(self):
        total = self.remaining_events()
        missing = max(0, 4 - len(self.substats))
        appearance = min(missing, total)
        upgrades = total - appearance
        return appearance, upgrades

    # -----------------------
    # MODE 1
    # -----------------------
    def distribution_events(self):
        next_levels = self.next_levels()
        if not next_levels:
            return {"info": "Artifact already at max level."}

        next_level = next_levels[0]
        max_level = self.max_level()
        current_stats = set(self.substats.keys())

        # Total de eventos según rareza
        total_events = {3: 4, 4: 5, 5: 5}[self.rarity]

        # ============================================================
        # PARTE 1: NEXT EVENT
        # ============================================================
        next_distribution = {}
        max_substats = {3: 4, 4: 4, 5: 4}[self.rarity]

        if len(current_stats) < max_substats:
            # Evento = aparición
            pool = [
                s
                for s in SUBSTAT_WEIGHTS
                if s not in current_stats and s != self.main_stat
            ]
            total_weight = sum(SUBSTAT_WEIGHTS[s] for s in pool)
            for s in SUBSTAT_WEIGHTS:
                next_distribution[s] = (
                    SUBSTAT_WEIGHTS[s] / total_weight if s in pool else 0.0
                )
        else:
            # Evento = upgrade
            k = len(current_stats)
            for s in SUBSTAT_WEIGHTS:
                next_distribution[s] = 1.0 / k if s in current_stats else 0.0

        # ============================================================
        # PARTE 2: MAX LEVEL — Probabilidad de cada stat al LV máximo
        # ============================================================
        appearance_events = max(0, max_substats - len(current_stats))
        upgrade_events = max(0, total_events - appearance_events)

        max_distribution = {}
        pool = [
            s for s in SUBSTAT_WEIGHTS if s not in current_stats and s != self.main_stat
        ]
        total_weight = sum(SUBSTAT_WEIGHTS[s] for s in pool)

        # Probabilidad de que todos los upgrades vayan a un mismo stat
        p_all_upgrades = (
            (1 / len(current_stats)) ** upgrade_events
            if upgrade_events > 0 and current_stats
            else 0.0
        )

        for s in SUBSTAT_WEIGHTS:
            if s == self.main_stat:
                max_distribution[s] = 0.0
                continue

            if s in current_stats and upgrade_events > 0:
                max_distribution[s] = p_all_upgrades
                continue

            if s not in pool or appearance_events == 0:
                max_distribution[s] = 0.0
                continue

            # Probabilidad exacta de aparecer en los eventos de aparición
            from itertools import permutations

            p_appear = 0.0
            for perm in permutations(pool, appearance_events):
                if s in perm:
                    prob = 1.0
                    remaining_weight_local = total_weight
                    for stat in perm:
                        prob *= SUBSTAT_WEIGHTS[stat] / remaining_weight_local
                        remaining_weight_local -= SUBSTAT_WEIGHTS[stat]
                    p_appear += prob

            max_distribution[s] = (
                p_appear * p_all_upgrades if upgrade_events > 0 else p_appear
            )

        return {
            "next_artifact": {
                "level": next_level,
                "states": next_distribution,
            },
            "max_artifact": {
                "level": max_level,
                "states": max_distribution,
            },
        }

    # -----------------------
    # MODE 2
    # -----------------------
    def probability_upgrade_vector(self, upgrade_counts, next_stats=None):

        if self.rarity == 3:
            return {
                "probability": 0.0,
                "status": "Rarity 3 artifacts cannot be upgraded",
            }

        appearance_events, upgrade_events = self.decompose_events()

        # ==========================================================
        # 1️⃣ Validaciones estructurales
        # ==========================================================

        if sum(upgrade_counts) != upgrade_events:
            return {
                "probability": 0.0,
                "status": f"Sum of upgrade_counts must equal {upgrade_events}",
            }

        # Substats actuales
        substats = self.substats.copy()

        # ==========================================================
        # 2️⃣ Resolver apariciones
        # ==========================================================

        if appearance_events > 0:

            pool = self.available_substats()
            total_weight = sum(SUBSTAT_WEIGHTS[s] for s in pool)

            # ------------------------------------------------------
            # CASO A: marginalizar
            # ------------------------------------------------------
            if next_stats is None:

                total_prob = 0.0

                # Enumerar combinaciones ordenadas posibles
                for first in pool:

                    p_first = SUBSTAT_WEIGHTS[first] / total_weight

                    remaining_pool = [s for s in pool if s != first]
                    remaining_weight = total_weight - SUBSTAT_WEIGHTS[first]

                    if appearance_events == 1:

                        new_sub = substats.copy()
                        new_sub[first] = 0

                        total_prob += p_first * self._upgrade_vector_prob(
                            new_sub, upgrade_events, upgrade_counts
                        )

                    else:  # appearance_events == 2

                        for second in remaining_pool:

                            p_second = SUBSTAT_WEIGHTS[second] / remaining_weight

                            new_sub = substats.copy()
                            new_sub[first] = 0
                            new_sub[second] = 0

                            total_prob += (
                                p_first
                                * p_second
                                * self._upgrade_vector_prob(
                                    new_sub, upgrade_events, upgrade_counts
                                )
                            )

                return {"probability": total_prob, "status": "OK"}

            # ------------------------------------------------------
            # CASO B: aparición forzada
            # ------------------------------------------------------
            else:

                if len(next_stats) != appearance_events:
                    return {
                        "probability": 0.0,
                        "status": f"Expected {appearance_events} next_stats, got {len(next_stats)}",
                    }

                base_prob = 1.0

                for s in next_stats:

                    if s not in pool:
                        return {"probability": 0.0, "status": f"Stat {s} cannot appear"}

                    p_s = SUBSTAT_WEIGHTS[s] / total_weight
                    base_prob *= p_s

                    total_weight -= SUBSTAT_WEIGHTS[s]
                    pool.remove(s)
                    substats[s] = 0

                return {
                    "probability": base_prob
                    * self._upgrade_vector_prob(
                        substats, upgrade_events, upgrade_counts
                    ),
                    "status": "OK",
                }

        # ==========================================================
        # 3️⃣ Si no hay apariciones
        # ==========================================================

        return self._upgrade_vector_prob(substats, upgrade_events, upgrade_counts)

    def _upgrade_vector_prob(self, substats, upgrades, counts):

        k = len(substats)

        if len(counts) != k:
            raise ValueError(
                f"Upgrade vector length {len(counts)} does not match number of substats {k}"
            )

        if sum(counts) != upgrades:
            raise ValueError(
                f"Sum of upgrade_counts must equal {upgrades}, got {sum(counts)}"
            )

        return multinomial_probability(counts, upgrades)

    # -----------------------
    # MODE 3
    # -----------------------

    def probability_minimum_threshold(self, thresholds, next_stats=None):

        if self.rarity == 3:
            return 0.0

        appearance, upgrades = self.decompose_events()
        print(appearance, upgrades)

        substats = self.substats.copy()

        if appearance > 0:
            pool = self.available_substats()
            total_weight = sum(SUBSTAT_WEIGHTS[s] for s in pool)

            if next_stats is None:
                total = 0
                for s in pool:
                    p_s = SUBSTAT_WEIGHTS[s] / total_weight
                    new_sub = substats.copy()
                    new_sub[s] = 0
                    total += p_s * self._threshold_prob(new_sub, upgrades, thresholds)
                return total
            else:
                base_prob = 1
                for s in next_stats:
                    p_s = SUBSTAT_WEIGHTS[s] / total_weight
                    base_prob *= p_s
                    total_weight -= SUBSTAT_WEIGHTS[s]
                    substats[s] = 0
                return base_prob * self._threshold_prob(substats, upgrades, thresholds)

        return self._threshold_prob(substats, upgrades, thresholds)

    def _threshold_prob(self, substats, upgrades, thresholds):

        stats = sorted(substats.keys())
        total_prob = 0

        for counts in possible_upgrade_distributions(len(stats), upgrades):

            multi_p = multinomial_probability(counts, upgrades)
            joint = 1

            for stat, k in zip(stats, counts):
                if stat in thresholds:
                    dist, probs = roll_distribution(stat, self.rarity, k)
                    final_vals = dist + substats.get(stat, 0)
                    joint *= probs[final_vals >= thresholds[stat]].sum()

            total_prob += multi_p * joint

        return total_prob

    # -----------------------
    # MODE 4
    # -----------------------

    def simulate_to_max(simulator):
        roll_table = ROLL_VALUES[simulator.rarity]

        appearance, upgrades = simulator.decompose_events()

        # Aparición de nuevas substats
        for _ in range(appearance):
            pool = simulator.available_substats()
            weights = [SUBSTAT_WEIGHTS[s] for s in pool]
            new_stat = random.choices(pool, weights=weights)[0]
            simulator.substats[new_stat] = random.choice(roll_table[new_stat])

        # Upgrades
        for _ in range(upgrades):
            chosen = random.choice(list(simulator.substats.keys()))
            tier = random.choice(roll_table[chosen])
            simulator.substats[chosen] += tier

        return simulator.substats.copy()

    def monte_carlo_distribution(self, N=10000):
        all_results = []

        for _ in range(N):
            simulator = ArtifactEngine(self.artifact)
            final_stats = simulator.simulate_to_max()
            all_results.append(final_stats)

        # Obtener todas las posibles substats
        all_stat_names = set().union(*all_results)

        summary = {}

        for stat in all_stat_names:
            values = [res.get(stat, 0) for res in all_results]

            summary[stat] = {
                "mean": float(np.mean(values)),
                "max": float(np.max(values)),
                "min": float(np.min(values)),
                "values": values,
            }

        return summary

    def monte_carlo_top_k(self, N=50000, k=5):

        counter = Counter()

        for _ in range(N):
            simulator = ArtifactEngine(self.artifact)
            final_stats = simulator.simulate_to_max()

            key = tuple(sorted(final_stats.items()))
            counter[key] += 1

        total = sum(counter.values())

        top = counter.most_common(k)

        result = []

        for key, count in top:
            result.append(
                {"stats": dict(key), "probability": count / total, "frequency": count}
            )

        return {"N": N, "top_k": result}

    # ===============================
    # DECISION ENGINE (HYBRID)
    # ===============================

    def expected_utility(
        self,
        utility,
        to="max",
        mc_samples=2000,
        risk_lambda=0.0,
    ):

        if isinstance(utility, str):
            utility_fn = UtilityRegistry.get(utility)
        else:
            utility_fn = utility

        if to == "next":
            return self._expected_next_utility(
                utility_fn,
                mc_samples,
                risk_lambda,
            )

        elif to == "max":
            return self._expected_max_utility(
                utility_fn,
                mc_samples,
                risk_lambda,
            )

        else:
            raise ValueError("to must be 'max' or 'next'")

    def _expected_max_utility(
        self,
        utility_fn,
        mc_samples,
        risk_lambda,
    ):

        appearance, upgrades = self.decompose_events()
        base_substats = self.substats.copy()

        expected = 0.0
        second_moment = 0.0
        probability_positive = 0.0

        # --------------------------------------------------
        # CASO 1: No hay apariciones
        # --------------------------------------------------
        if appearance == 0:

            return self._evaluate_upgrade_stage(
                base_substats,
                upgrades,
                utility_fn,
                mc_samples,
                risk_lambda,
            )

        # --------------------------------------------------
        # CASO 2: Hay apariciones
        # --------------------------------------------------
        pool = self.available_substats()
        total_weight = sum(SUBSTAT_WEIGHTS[s] for s in pool)

        from itertools import permutations

        for perm in permutations(pool, appearance):

            prob_appearance = 1.0
            remaining_weight = total_weight
            new_substats = base_substats.copy()

            for stat in perm:
                p = SUBSTAT_WEIGHTS[stat] / remaining_weight
                prob_appearance *= p
                remaining_weight -= SUBSTAT_WEIGHTS[stat]

                tier = np.mean(ROLL_VALUES[self.rarity][stat])
                new_substats[stat] = tier

            result = self._evaluate_upgrade_stage(
                new_substats,
                upgrades,
                utility_fn,
                mc_samples,
                risk_lambda,
            )

            expected += prob_appearance * result["expected_utility"]
            second_moment += prob_appearance * (
                result["variance"] + result["expected_utility"] ** 2
            )
            probability_positive += prob_appearance * result["probability_positive"]

        variance = second_moment - expected**2
        adjusted = expected - risk_lambda * variance
        current_u = utility_fn(self.substats)
        adjusted_gain = adjusted - current_u

        return {
            "expected_utility": float(expected),
            "variance": float(variance),
            "risk_adjusted": float(adjusted),
            "probability_positive": float(probability_positive),
            "current_utility": float(current_u),
            "expected_gain": float(expected - current_u),
            "probability_of_improvement": float(probability_positive),
            "recommendation": ("CONTINUE" if adjusted_gain > 0 else "STOP"),
        }

    def _evaluate_upgrade_stage(
        self,
        substats,
        upgrades,
        utility_fn,
        mc_samples,
        risk_lambda,
    ):

        expected = 0.0
        second_moment = 0.0
        probability_positive = 0.0
        current_u = utility_fn(self.substats)

        stats_sorted = sorted(substats.keys())

        for counts in possible_upgrade_distributions(len(stats_sorted), upgrades):

            p_counts = multinomial_probability(counts, upgrades)

            if p_counts == 0:
                continue

            utilities = []

            for _ in range(mc_samples):

                sim_stats = substats.copy()

                for stat, k in zip(stats_sorted, counts):
                    for _ in range(k):
                        tier = random.choice(ROLL_VALUES[self.rarity][stat])
                        sim_stats[stat] += tier

                utilities.append(utility_fn(sim_stats))

            utilities = np.array(utilities)

            mean_u = utilities.mean()
            var_u = utilities.var()
            prob_positive = (utilities > current_u).mean()

            expected += p_counts * mean_u
            second_moment += p_counts * (var_u + mean_u**2)
            probability_positive += p_counts * prob_positive

        variance = second_moment - expected**2
        adjusted = expected - risk_lambda * variance
        adjusted_gain = adjusted - current_u

        return {
            "expected_utility": float(expected),
            "variance": float(variance),
            "risk_adjusted": float(adjusted),
            "probability_positive": float(probability_positive),
            "current_utility": float(current_u),
            "expected_gain": float(expected - current_u),
            "probability_of_improvement": float(probability_positive),
            "recommendation": ("CONTINUE" if adjusted_gain > 0 else "STOP"),
        }

    def _expected_next_utility(
        self,
        utility_fn,
        mc_samples,
        risk_lambda,
    ):

        current_u = utility_fn(self.substats)

        next_levels = self.next_levels()
        if not next_levels:
            return {
                "expected_gain": 0.0,
                "variance": 0.0,
                "risk_adjusted": 0.0,
                "probability_positive": 0.0,
                "recommendation": "MAX LEVEL",
            }

        gains = []

        for _ in range(mc_samples):

            simulator = ArtifactEngine(self.artifact)
            sim_stats = simulator.substats.copy()

            if len(sim_stats) < 4:
                pool = simulator.available_substats()
                weights = [SUBSTAT_WEIGHTS[s] for s in pool]
                new_stat = random.choices(pool, weights=weights)[0]
                tier = random.choice(ROLL_VALUES[self.rarity][new_stat])
                sim_stats[new_stat] = tier
            else:
                chosen = random.choice(list(sim_stats.keys()))
                tier = random.choice(ROLL_VALUES[self.rarity][chosen])
                sim_stats[chosen] += tier

            gains.append(utility_fn(sim_stats) - current_u)

        gains = np.array(gains)

        expected_gain = gains.mean()
        variance = gains.var()
        adjusted = expected_gain - risk_lambda * variance
        prob_positive = (gains > 0).mean()

        return {
            "expected_gain": float(expected_gain),
            "variance": float(variance),
            "risk_adjusted": float(adjusted),
            "probability_positive": float(prob_positive),
            "recommendation": ("CONTINUE" if adjusted > 0 else "STOP"),
        }
