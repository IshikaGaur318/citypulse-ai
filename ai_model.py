import json
import sys

import numpy as np
from sklearn.ensemble import RandomForestRegressor


def predict_next(values):
    values = np.asarray(values, dtype=float)

    if len(values) < 10:
        return {
            "ready": False,
            "message": "At least 10 historical readings are required.",
            "readings": int(len(values)),
        }

    window = 5
    X = np.array([
        values[i - window:i]
        for i in range(window, len(values))
    ])
    y = values[window:]

    model = RandomForestRegressor(
        n_estimators=100,
        random_state=42,
    )
    model.fit(X, y)

    prediction = float(
        model.predict(values[-window:].reshape(1, -1))[0]
    )

    return {
        "ready": True,
        "prediction": round(prediction, 2),
        "readings": int(len(values)),
        "model": "RandomForestRegressor",
    }


if __name__ == "__main__":
    try:
        payload = json.load(sys.stdin)
        print(json.dumps(predict_next(payload.get("values", []))))
    except Exception as exc:
        print(json.dumps({"ready": False, "error": str(exc)}))
        sys.exit(1)
