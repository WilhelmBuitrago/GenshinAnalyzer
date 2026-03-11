from fastapi import FastAPI

import os
import sys

sys.path.append(
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "core")
)
from pydantic import BaseModel
from typing import Dict, List, Optional
from engine import ArtifactEngine
from data import ROLL_VALUES, MAX_SUBSTATS, MAX_UPGRADES
from utilities import UtilityRegistry
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Genshin Artifact Analyzer API")
origins = [
    "http://localhost:3000",  # tu frontend
    "http://127.0.0.1:3000",
    # agrega más orígenes si es necesario
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ArtifactModel(BaseModel):
    rarity: int
    level: int
    main_stat: str
    substats: Dict[str, float]


class UpgradeVectorRequest(BaseModel):
    artifact: ArtifactModel
    upgrade_counts: List[int]
    next_stats: Optional[List[str]] = None


class ThresholdRequest(BaseModel):
    artifact: ArtifactModel
    thresholds: Dict[str, float]
    next_stats: Optional[List[str]] = None


class MonteCarloRequest(BaseModel):
    artifact: ArtifactModel
    simulations: int = 10000


class ExpectedUtilityRequest(BaseModel):
    artifact: ArtifactModel
    utility_function: Optional[str] = None  # Name of a predefined utility function
    to: Optional[str] = "max"  # "max" or "next"
    mc_samples: Optional[int] = 3000
    risk_lambda: Optional[float] = 0.1


class UpdateValuesRequest(BaseModel):
    artifact: ArtifactModel


class MoteCarloTopKRequest(BaseModel):
    artifact: ArtifactModel
    simulations: int = 10000
    k: Optional[int] = 3  # Número de combinaciones más probables a retornar


@app.get("/")
def root():
    return {"status": "API running"}


@app.post("/distribution-events")
def distribution_events(artifact: ArtifactModel):
    engine = ArtifactEngine(artifact)
    return engine.distribution_events()


@app.post("/probability-upgrade-vector")
def probability_upgrade_vector(request: UpgradeVectorRequest):
    engine = ArtifactEngine(request.artifact)
    return engine.probability_upgrade_vector(
        request.upgrade_counts,
        request.next_stats,
    )


@app.post("/probability-threshold")
def probability_threshold(request: ThresholdRequest):
    engine = ArtifactEngine(request.artifact)
    return engine.probability_minimum_threshold(
        request.thresholds,
        request.next_stats,
    )


@app.post("/monte-carlo")
def monte_carlo(request: MonteCarloRequest):
    engine = ArtifactEngine(request.artifact)
    return engine.monte_carlo_distribution(request.simulations)


@app.post("/expected-utility")
def expected_utility(request: ExpectedUtilityRequest):
    engine = ArtifactEngine(request.artifact)
    try:
        result = engine.expected_utility(
            utility=request.utility_function,
            to=request.to,
            mc_samples=request.mc_samples,
            risk_lambda=request.risk_lambda,
        )
    except Exception as e:
        return {"error": str(e)}
    return result


@app.post("/monte-carlo-top-k")
def monte_carlo_top_k(request: MoteCarloTopKRequest):
    engine = ArtifactEngine(request.artifact)
    return engine.monte_carlo_top_k(N=request.simulations, k=request.k)


@app.get("/roll_values")
def get_roll_update_values():
    return ROLL_VALUES


@app.get("/utility_functions")
def get_utility_functions():
    return UtilityRegistry.available()


@app.get("/max_substats")
def get_max_substats():
    return MAX_SUBSTATS


@app.get("/max_update_values")
def get_max_update_values():
    return MAX_UPGRADES
