from tsp_dp import solve_tsp_dp
from tsp_heuristic import solve_tsp_heuristic
import math

def simple_square_coords():
    return [(0,0),(0,1),(1,1),(1,0)]

def test_dp_on_square():
    coords = simple_square_coords()
    # build euclidean dist
    dist = [[math.hypot(a[0]-b[0], a[1]-b[1]) for b in coords] for a in coords]
    order = solve_tsp_dp(dist)
    assert set(order) == set(range(len(coords)))
    assert len(order) == 4

def test_heuristic_on_square():
    coords = simple_square_coords()
    order = solve_tsp_heuristic(coords)
    assert set(order) == set(range(len(coords)))
    assert len(order) == 4
