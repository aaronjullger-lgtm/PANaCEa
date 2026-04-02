"""
FSRS Optimizer Cloud Function (Google Cloud Functions 2nd Gen).

Accepts a JSON payload of review history (card_id, review_time, review_rating,
review_state, review_duration, telemetry_quality?, brier_score?), runs
fsrs-optimizer, and returns the 21 w[] parameters plus metadata.

Sprint 5 enhancement: reviews are weighted by telemetry quality and user
calibration score. Full-telemetry reviews contribute more to parameter fitting.

Payload: { "reviews": [...], "timezone": "UTC", "next_day_starts_at": 0 }
Response: { "success": true, "w": [...], "sampleSize": N, "brierScore": ..., ... }
"""

import json
import os
import shutil
import tempfile
from typing import Any

import functions_framework


# Optional: validate request with a shared secret (set via env in GCF)
def _check_auth(request) -> bool:
    key = os.environ.get("FSRS_OPTIMIZER_SECRET")
    if not key:
        return True
    return request.headers.get("X-FSRS-Optimizer-Key") == key


def _json_response(data: dict, status: int = 200) -> tuple[str, int, dict]:
    return json.dumps(data), status, {"Content-Type": "application/json"}


@functions_framework.http
def optimize(request):
    if request.method == "OPTIONS":
        return ("", 204, {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-FSRS-Optimizer-Key"})

    if request.method != "POST":
        return _json_response({"success": False, "error": "Method not allowed"}, 405)

    if not _check_auth(request):
        return _json_response({"success": False, "error": "Unauthorized"}, 401)

    try:
        body = request.get_json(silent=True) or {}
    except Exception as e:
        return _json_response({"success": False, "error": f"Invalid JSON: {e}"}, 400)

    reviews = body.get("reviews") or []
    timezone = body.get("timezone", "UTC")
    next_day_starts_at = int(body.get("next_day_starts_at", 0))
    enable_quality_weighting = bool(body.get("enable_quality_weighting", True))

    # Cap payload size to avoid abuse (e.g. 50k reviews)
    if len(reviews) > 50_000:
        return _json_response(
            {"success": False, "error": "Too many reviews (max 50000)"},
            400,
        )

    if len(reviews) < 500:
        return _json_response(
            {
                "success": False,
                "error": "Insufficient reviews (minimum 500 for optimization)",
                "reviewsReceived": len(reviews),
            },
            400,
        )

    # ── Sprint 5: Telemetry quality weighting ──
    # Weight reviews by their telemetry fidelity and user calibration.
    # Since fsrs-optimizer doesn't support per-sample weights natively, we
    # use probabilistic downsampling: full→100%, partial→60%, minimal→30%.
    # This ensures high-fidelity behavioral data drives parameter fitting.
    QUALITY_KEEP_PROB = {
        "full": 1.0,
        "partial": 0.6,
        "minimal": 0.3,
    }

    import random
    quality_stats = {"full": 0, "partial": 0, "minimal": 0, "unknown": 0}

    if enable_quality_weighting:
        weighted_reviews = []
        for r in reviews:
            quality = str(r.get("telemetry_quality", "minimal")).lower()
            quality_stats[quality] = quality_stats.get(quality, 0) + 1
            keep_prob = QUALITY_KEEP_PROB.get(quality, 0.3)
            # Also factor in user calibration: well-calibrated reviews are more trustworthy
            brier = r.get("brier_score")
            if brier is not None and isinstance(brier, (int, float)):
                calibration_weight = max(0.5, 1.0 - float(brier))
                keep_prob *= calibration_weight
            if random.random() < keep_prob:
                weighted_reviews.append(r)
        # Only use weighted reviews if we still have enough
        if len(weighted_reviews) >= 400:
            reviews = weighted_reviews
    else:
        for r in reviews:
            quality = str(r.get("telemetry_quality", "unknown")).lower()
            quality_stats[quality] = quality_stats.get(quality, 0) + 1

    # Build revlog DataFrame and run optimizer in a temp directory
    # (fsrs-optimizer reads ./revlog.csv and writes ./revlog_history.tsv)
    import pandas as pd
    from fsrs_optimizer.fsrs_optimizer import Optimizer

    tmpdir = tempfile.mkdtemp(prefix="fsrs_")
    cwd = os.getcwd()
    try:
        os.chdir(tmpdir)

        # Revlog columns expected by create_time_series (same as Anki revlog export)
        df = pd.DataFrame(
            [
                {
                    "review_time": int(r.get("review_time", 0)),
                    "card_id": str(r.get("card_id", "")),
                    "review_rating": int(r.get("review_rating", 3)),
                    "review_duration": int(r.get("review_duration", 0)),
                    "review_state": int(r.get("review_state", 2)),
                }
                for r in reviews
            ]
        )
        # Sort by card then time (required by optimizer)
        df.sort_values(by=["card_id", "review_time"], inplace=True, ignore_index=True)
        df.to_csv("revlog.csv", index=False)

        opt = Optimizer(float_delta_t=False, enable_short_term=True)
        # create_time_series reads ./revlog.csv, writes ./revlog_history.tsv
        opt.create_time_series(
            timezone=timezone,
            revlog_start_date="2006-01-01",
            next_day_starts_at=next_day_starts_at,
            analysis=False,
        )
        opt.define_model()
        opt.initialize_parameters(dataset=None, verbose=False)
        opt.train(verbose=False, split_by_time=False, recency_weight=False)

        # Evaluate: loss_before (default params), loss_after (optimized)
        loss_before, loss_after = opt.evaluate(save_to_file=False)
        sample_size = len(opt.dataset)
        improvement = (
            (float(loss_before - loss_after) / float(loss_before) * 100.0)
            if loss_before and loss_before > 0
            else 0.0
        )
        w_list = [round(float(x), 6) for x in opt.w.tolist()]

        return _json_response(
            {
                "success": True,
                "w": w_list,
                "sampleSize": sample_size,
                "brierScore": round(float(loss_after), 6),
                "defaultBrierScore": round(float(loss_before), 6),
                "improvementOverDefault": round(improvement, 2),
                "iterations": None,
                "qualityWeighting": enable_quality_weighting,
                "qualityStats": quality_stats,
            },
            200,
        )
    except ValueError as e:
        msg = str(e)
        if "inadequate" in msg.lower() or "data" in msg.lower():
            return _json_response(
                {"success": False, "error": msg, "reviewsReceived": len(reviews)},
                400,
            )
        return _json_response({"success": False, "error": msg}, 400)
    except Exception as e:
        return _json_response(
            {"success": False, "error": str(e), "reviewsReceived": len(reviews)},
            500,
        )
    finally:
        os.chdir(cwd)
        shutil.rmtree(tmpdir, ignore_errors=True)
