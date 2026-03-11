import numpy as np


class UtilityRegistry:

    _registry = {}

    @classmethod
    def register(cls, name):
        def decorator(func):
            cls._registry[name] = func
            return func

        return decorator

    @classmethod
    def get(cls, name):
        if name not in cls._registry:
            raise ValueError(f"Utility '{name}' not registered.")
        return cls._registry[name]

    @classmethod
    def available(cls):
        return list(cls._registry.keys())


# ================================
# UTILIDADES PREDEFINIDAS
# ================================


@UtilityRegistry.register("CV")
def crit_value(stats):
    return 2 * stats.get("CR", 0) + stats.get("CD", 0)


@UtilityRegistry.register("ATK_WEIGHTED")
def atk_weighted(stats):
    return 2 * stats.get("CR", 0) + stats.get("CD", 0) + 0.5 * stats.get("ATK%", 0)


@UtilityRegistry.register("ER_REQUIREMENT")
def er_requirement(stats):
    if stats.get("ER", 0) < 200:
        return 0
    return 2 * stats.get("CR", 0) + stats.get("CD", 0)


@UtilityRegistry.register("RAW_SUM")
def raw_sum(stats):
    return sum(stats.values())
