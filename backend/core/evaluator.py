class ArtifactEvaluator:

    def __init__(self, engine):
        self.engine = engine

    def evaluate(
        self,
        utility="CV",
        risk_lambda=0.0,
        threshold_gain=0.0,
    ):
        result = self.engine.expected_utility(
            utility=utility,
            risk_lambda=risk_lambda,
        )

        recommendation = (
            "UPGRADE" if result["expected_gain"] > threshold_gain else "DO NOT UPGRADE"
        )

        result["recommendation"] = recommendation

        return result
