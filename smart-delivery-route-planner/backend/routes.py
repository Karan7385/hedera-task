from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, validator
from typing import List, Literal, Optional, Dict, Any
from tsp_dp import solve_tsp_dp
from tsp_heuristic import solve_tsp_heuristic
from utils import haversine_km, group_by_priority, compute_route_distance_km
import time

router = APIRouter()

Priority = Literal["high", "medium", "low"]

class PointIn(BaseModel):
    id: int
    lat: float
    lon: float
    priority: Priority

class Options(BaseModel):
    mode: Literal["strict", "optimized"] = "optimized"
    algorithm: Literal["dp", "heuristic", "auto"] = "auto"
    dp_limit: int = 12

    @validator("dp_limit")
    def dp_limit_positive(cls, v):
        if v < 1 or v > 16:
            raise ValueError("dp_limit must be between 1 and 16")
        return v

class OptimizeRequest(BaseModel):
    points: List[PointIn]
    options: Optional[Options] = Options()

class GroupStats(BaseModel):
    count: int
    distance: float

class OptimizeResponse(BaseModel):
    ordered_points: List[PointIn]
    total_distance: float
    group_stats: Dict[str, GroupStats]
    runtime_ms: float

@router.post("/optimize", response_model=OptimizeResponse)
def optimize_route(req: OptimizeRequest):
    start_time = time.perf_counter()

    pts = req.points
    opts = req.options or Options()

    # validate unique ids
    ids = [p.id for p in pts]
    if len(ids) != len(set(ids)):
        raise HTTPException(status_code=400, detail="Duplicate point ids are not allowed")

    # if strict mode — keep original ordering grouped by priority
    if opts.mode == "strict":
        ordered = []
        group_stats: Dict[str, Dict[str, Any]] = {}
        for pr in ["high", "medium", "low"]:
            group = [p for p in pts if p.priority == pr]
            ordered.extend(group)
            group_stats[pr] = {
                "count": len(group),
                "distance": float(compute_route_distance_km(group))
            }
        total_distance = float(compute_route_distance_km(ordered))
        runtime_ms = (time.perf_counter() - start_time) * 1000.0
        return {
            "ordered_points": ordered,
            "total_distance": total_distance,
            "group_stats": group_stats,
            "runtime_ms": runtime_ms
        }

    # optimized mode: group and solve each group
    groups = group_by_priority(pts)  # returns dict with keys high/medium/low and list of points
    final_order = []
    group_stats = {}

    for pr in ["high", "medium", "low"]:
        group = groups.get(pr, [])
        n = len(group)
        if n == 0:
            group_stats[pr] = {"count": 0, "distance": 0.0}
            continue

        # choose algorithm
        algo = opts.algorithm
        if algo == "auto":
            algo = "dp" if n <= opts.dp_limit else "heuristic"

        if algo == "dp":
            # build distance matrix
            coords = [(p.lat, p.lon) for p in group]
            dist = [[haversine_km(a[0], a[1], b[0], b[1]) for b in coords] for a in coords]
            order_idx = solve_tsp_dp(dist)  # returns list of indices in visiting order
            ordered_group = [group[i] for i in order_idx]
        else:
            # heuristic
            coords = [(p.lat, p.lon) for p in group]
            order_idx = solve_tsp_heuristic(coords)
            ordered_group = [group[i] for i in order_idx]

        final_order.extend(ordered_group)
        group_stats[pr] = {
            "count": n,
            "distance": float(compute_route_distance_km(ordered_group))
        }

    total_distance = float(compute_route_distance_km(final_order))
    runtime_ms = (time.perf_counter() - start_time) * 1000.0

    response = {
        "ordered_points": final_order,
        "total_distance": total_distance,
        "group_stats": group_stats,
        "runtime_ms": runtime_ms
    }
    return response