# models.py

from dataclasses import dataclass


@dataclass
class Artifact:
    rarity: int
    level: int
    main_stat: str
    substats: dict
