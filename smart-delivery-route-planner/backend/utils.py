# backend/utils.py
from typing import List, Dict, Any
from math import radians, cos, sin, asin, sqrt

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance between two lat/lon points in kilometers."""
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    c = 2 * asin(min(1, sqrt(a)))
    return R * c

def group_by_priority(points: List[Any]) -> Dict[str, List[Any]]:
    """
    Group a sequence of point-like objects/dicts by priority.
    Each point is expected to have a `.priority` attribute or key.
    Returns a dict with keys 'high', 'medium', 'low'.
    """
    res = {"high": [], "medium": [], "low": []}
    for p in points:
        # support both dataclass / pydantic model attributes and plain dicts
        pr = getattr(p, "priority", None) if not isinstance(p, dict) else p.get("priority")
        pr = pr if pr in res else "low"
        res[pr].append(p)
    return res

def compute_route_distance_km(ordered_points: List[Any]) -> float:
    """
    Compute total haversine distance for an ordered sequence of points.
    Each point must expose lat and lon (either attributes or dict keys).
    """
    if not ordered_points or len(ordered_points) < 2:
        return 0.0
    total = 0.0
    for i in range(1, len(ordered_points)):
        a = ordered_points[i-1]
        b = ordered_points[i]
        lat_a = a.lat if not isinstance(a, dict) else a["lat"]
        lon_a = a.lon if not isinstance(a, dict) else a["lon"]
        lat_b = b.lat if not isinstance(b, dict) else b["lat"]
        lon_b = b.lon if not isinstance(b, dict) else b["lon"]
        total += haversine_km(lat_a, lon_a, lat_b, lon_b)
    return total
