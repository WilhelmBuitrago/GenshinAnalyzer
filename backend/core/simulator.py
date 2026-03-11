# test_example.py
import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from evaluator import ArtifactEvaluator
from models import Artifact
from engine import ArtifactEngine
from distributions import roll_distribution

artifact = Artifact(
    rarity=5,
    level=0,
    main_stat="ATK",
    substats={"CR": 2.72, "ATK%": 4.08, "ER": 4.53},
)

engine = ArtifactEngine(artifact)
evaluator = ArtifactEvaluator(engine)


r = engine.monte_carlo_top_k(N=1000000)
print(r)
