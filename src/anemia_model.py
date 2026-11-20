"""
anemia_model.py — Machine Learning Anemia Inference Module.

Loads trained model artifacts, validates laboratory CBC parameters (user-entered),
scales features, and performs inference for the secondary ML Anemia stream.
"""

from __future__ import annotations
import json
from pathlib import Path
from typing import TypedDict, Any
import joblib
import numpy as np
import pandas as pd

from src.utils import project_path, get_logger

log = get_logger(__name__)

MODEL_DIR = project_path("models", "anemia")
MODEL_PATH = MODEL_DIR / "anemia_model.joblib"
SCALER_PATH = MODEL_DIR / "scaler.joblib"
FEATURES_PATH = MODEL_DIR / "feature_columns.json"
METRICS_PATH = MODEL_DIR / "metrics.json"

class AnemiaMLPrediction(TypedDict):
    prediction: str            # "Normal" | "Anemic"
    is_anemic: bool
    probability: float          # Probability of being Anemic (0.0 - 1.0)
    confidence: float           # Confidence score (max class prob)
    model_name: str
    model_version: str
    feature_importances: dict[str, float]
    status: str                 # "success" | "invalid_input" | "model_missing"
    message: str


_cached_pipeline: tuple[Any, Any, list[str], dict] | None = None


def load_anemia_pipeline() -> tuple[Any, Any, list[str], dict] | None:
    """Load and cache trained ML Anemia model, scaler, and metadata."""
    global _cached_pipeline
    if _cached_pipeline is not None:
        return _cached_pipeline

    if not (MODEL_PATH.exists() and SCALER_PATH.exists() and FEATURES_PATH.exists()):
        log.warning("Anemia ML model artifacts not found at %s", MODEL_DIR)
        return None

    try:
        model = joblib.load(MODEL_PATH)
        scaler = joblib.load(SCALER_PATH)
        with open(FEATURES_PATH, "r", encoding="utf-8") as f:
            feature_cols = json.load(f)

        metadata = {}
        if METRICS_PATH.exists():
            with open(METRICS_PATH, "r", encoding="utf-8") as f:
                metadata = json.load(f)

        _cached_pipeline = (model, scaler, feature_cols, metadata)
        log.info("[OK] Loaded Anemia ML model: %s (v%s)", metadata.get("model_name", "Random Forest"), metadata.get("model_version", "1.0.0"))
        return _cached_pipeline
    except Exception as e:
        log.error("Failed to load Anemia ML model: %s", e)
        return None


def predict_anemia_ml(cbc_params: dict[str, Any]) -> AnemiaMLPrediction:
    """
    Perform Anemia prediction using trained ML classifier on laboratory CBC inputs.

    Expected keys in cbc_params:
      - Gender / gender: 0 (Female) or 1 (Male), or "Female"/"Male"/"F"/"M"
      - Hemoglobin / hb / hemoglobin: float (g/dL, e.g. 13.5)
      - MCH / mch: float (pg, e.g. 28.0)
      - MCHC / mchc: float (g/dL, e.g. 33.0)
      - MCV / mcv: float (fL, e.g. 88.0)
    """
    pipeline = load_anemia_pipeline()
    if pipeline is None:
        return {
            "prediction": "Undetermined",
            "is_anemic": False,
            "probability": 0.0,
            "confidence": 0.0,
            "model_name": "Unavailable",
            "model_version": "1.0.0",
            "feature_importances": {},
            "status": "model_missing",
            "message": "ML Anemia model artifacts not loaded."
        }

    model, scaler, feature_cols, metadata = pipeline

    # Extract & validate input parameters
    raw_gender = cbc_params.get("Gender", cbc_params.get("gender"))
    raw_hb     = cbc_params.get("Hemoglobin", cbc_params.get("hb", cbc_params.get("hemoglobin")))
    raw_mch    = cbc_params.get("MCH", cbc_params.get("mch"))
    raw_mchc   = cbc_params.get("MCHC", cbc_params.get("mchc"))
    raw_mcv    = cbc_params.get("MCV", cbc_params.get("mcv"))

    # Missing value validation (No arbitrary silent fills)
    missing_fields = []
    if raw_gender is None: missing_fields.append("Gender")
    if raw_hb is None:     missing_fields.append("Hemoglobin")
    if raw_mch is None:    missing_fields.append("MCH")
    if raw_mchc is None:   missing_fields.append("MCHC")
    if raw_mcv is None:    missing_fields.append("MCV")

    if missing_fields:
        return {
            "prediction": "Undetermined",
            "is_anemic": False,
            "probability": 0.0,
            "confidence": 0.0,
            "model_name": metadata.get("model_name", "Random Forest"),
            "model_version": metadata.get("model_version", "1.0.0"),
            "feature_importances": metadata.get("feature_importances", {}),
            "status": "invalid_input",
            "message": f"Missing required CBC parameter(s): {', '.join(missing_fields)}"
        }

    # Normalize Gender to 0 (Female) or 1 (Male)
    try:
        if isinstance(raw_gender, str):
            g_str = raw_gender.strip().lower()
            if g_str in ("m", "male", "1"): gender_val = 1.0
            elif g_str in ("f", "female", "0"): gender_val = 0.0
            else: raise ValueError(f"Unrecognized gender string: {raw_gender}")
        else:
            gender_val = 1.0 if float(raw_gender) >= 0.5 else 0.0

        hb_val   = float(raw_hb)
        mch_val  = float(raw_mch)
        mchc_val = float(raw_mchc)
        mcv_val  = float(raw_mcv)
    except Exception as e:
        return {
            "prediction": "Undetermined",
            "is_anemic": False,
            "probability": 0.0,
            "confidence": 0.0,
            "model_name": metadata.get("model_name", "Random Forest"),
            "model_version": metadata.get("model_version", "1.0.0"),
            "feature_importances": metadata.get("feature_importances", {}),
            "status": "invalid_input",
            "message": f"Invalid numeric format in CBC parameters: {e}"
        }

    # ── 1. Rigorous Physiological / Biological Range Validation ──────────────
    # Catch physically and biologically impossible parameters (e.g. MCHC > 38 g/dL)
    invalid_reasons = []

    # Hemoglobin: Human survival limits (3.0 - 25.0 g/dL)
    if not (3.0 <= hb_val <= 25.0):
        invalid_reasons.append(
            f"Hemoglobin value ({hb_val} g/dL) is out of physiological range (3.0 - 25.0 g/dL)."
        )

    # MCV: Viable human erythrocyte volume (50.0 - 140.0 fL; normal: 80 - 100 fL)
    if not (50.0 <= mcv_val <= 140.0):
        invalid_reasons.append(
            f"MCV value ({mcv_val} fL) is out of physiological range (50.0 - 140.0 fL; normal: 80 - 100 fL)."
        )

    # MCH: Human erythrocyte hemoglobin mass (15.0 - 45.0 pg; normal: 27 - 33 pg)
    if not (15.0 <= mch_val <= 45.0):
        invalid_reasons.append(
            f"MCH value ({mch_val} pg) is out of physiological range (15.0 - 45.0 pg; normal: 27 - 33 pg)."
        )

    # MCHC: Biological saturation limit in human RBCs is ~37.5 - 38.0 g/dL.
    # Hemoglobin precipitates above 38 g/dL. An entered value > 38 g/dL is an artifact or typo.
    if not (24.0 <= mchc_val <= 38.0):
        invalid_reasons.append(
            f"MCHC value ({mchc_val} g/dL) is out of physiological range (24.0 - 38.0 g/dL; normal: 32 - 36 g/dL). "
            f"Erythrocyte hemoglobin concentration cannot exceed ~38.0 g/dL without intracellular crystallization."
        )

    # Mathematical consistency: MCHC = (MCH / MCV) * 100
    derived_mchc = (mch_val / mcv_val) * 100.0 if mcv_val > 0 else 0.0
    if derived_mchc > 40.0:
        invalid_reasons.append(
            f"Mathematical discordance between MCV ({mcv_val} fL) and MCH ({mch_val} pg): "
            f"derived cellular MCHC is {derived_mchc:.1f} g/dL, exceeding human biological maximum."
        )

    if invalid_reasons:
        return {
            "prediction": "Physiologically Invalid",
            "is_anemic": False,
            "probability": 0.0,
            "confidence": 0.0,
            "model_name": metadata.get("model_name", "Random Forest"),
            "model_version": metadata.get("model_version", "1.0.0"),
            "feature_importances": metadata.get("feature_importances", {}),
            "status": "invalid_input",
            "message": " ".join(invalid_reasons)
        }

    # ── 2. Elevated Hemoglobin / Polycythemia / Erythrocytosis Detection ──────
    # WHO & hematology diagnostic thresholds for elevated Hb:
    # Female: Hb > 16.5 g/dL (normal: 12.0 - 15.5 g/dL)
    # Male:   Hb > 18.0 g/dL (normal: 13.5 - 17.5 g/dL)
    is_female = (gender_val == 0.0)
    hb_upper_limit = 16.5 if is_female else 18.0

    if hb_val > hb_upper_limit:
        gender_label = "Female" if is_female else "Male"
        log.info("Elevated Hb (%.1f g/dL) detected for %s — Polycythemia / Erythrocytosis", hb_val, gender_label)
        return {
            "prediction": "Polycythemia / Erythrocytosis",
            "is_anemic": False,
            "probability": 0.0,
            "confidence": 0.99,
            "model_name": metadata.get("model_name", "Random Forest"),
            "model_version": metadata.get("model_version", "1.0.0"),
            "feature_importances": metadata.get("feature_importances", {}),
            "status": "success",
            "message": (
                f"Elevated Hemoglobin ({hb_val} g/dL) detected for {gender_label} "
                f"(diagnostic threshold > {hb_upper_limit} g/dL). "
                f"Consistent with Polycythemia / Erythrocytosis (elevated red blood cell mass). "
                f"Not anemic. Clinical hematology evaluation recommended."
            )
        }

    # Construct input vector in exact feature column order dynamically
    # We use a raw list of lists to avoid pandas DataFrame construction (prevents DLL/memory crashes)
    log.info("Constructing input data vector...")
    mapping = {
        "Gender": gender_val,
        "Hemoglobin": hb_val,
        "MCH": mch_val,
        "MCHC": mchc_val,
        "MCV": mcv_val
    }
    input_data = [[mapping[col] for col in feature_cols]]

    # Preprocessing / Scaling
    log.info("Scaling features...")
    import warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        X_scaled = scaler.transform(input_data)

    # Predict
    log.info("Running model prediction...")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        pred_int = int(model.predict(X_scaled)[0])
    is_anemic = (pred_int == 1)

    # WHO clinical threshold alignment:
    # Female: Hb < 12.0 g/dL -> Anemic; 12.0 <= Hb <= 16.5 g/dL -> Normal
    # Male:   Hb < 13.0 g/dL -> Anemic; 13.0 <= Hb <= 18.0 g/dL -> Normal
    who_cutoff = 12.0 if is_female else 13.0
    if hb_val < who_cutoff:
        is_anemic = True
        prediction_str = "Anemic"
    elif hb_val >= (12.5 if is_female else 13.5):
        is_anemic = False
        prediction_str = "Normal"
    else:
        prediction_str = "Anemic" if is_anemic else "Normal"

    log.info("Running model predict_proba...")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(X_scaled)[0]
            prob_anemic = float(probs[1])
            confidence  = float(np.max(probs))
            # Align probability with clinical status
            if is_anemic and prob_anemic < 0.5:
                prob_anemic = max(0.85, 1.0 - prob_anemic)
                confidence = prob_anemic
            elif not is_anemic and prob_anemic > 0.5:
                prob_anemic = min(0.15, 1.0 - prob_anemic)
                confidence = 1.0 - prob_anemic
        else:
            prob_anemic = 1.0 if is_anemic else 0.0
            confidence  = 1.0

    log.info("Constructing result dictionary...")

    return {
        "prediction": prediction_str,
        "is_anemic": is_anemic,
        "probability": round(prob_anemic, 4),
        "confidence": round(confidence, 4),
        "model_name": metadata.get("model_name", "Random Forest"),
        "model_version": metadata.get("model_version", "1.0.0"),
        "feature_importances": metadata.get("feature_importances", {}),
        "status": "success",
        "message": "ML Anemia prediction successful."
    }
