from typing import List
import math

def distance(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])

def nearest_neighbor_route(coords: List[tuple], start_idx: int) -> List[int]:
    n = len(coords)
    visited = [False] * n
    order = [start_idx]
    visited[start_idx] = True
    cur = start_idx
    for _ in range(n - 1):
        best = None
        best_d = float("inf")
        for j in range(n):
            if visited[j]:
                continue
            d = distance(coords[cur], coords[j])
            if d < best_d:
                best_d = d
                best = j
        visited[best] = True
        order.append(best)
        cur = best
    return order

def two_opt_swap(route, i, k):
    new_route = route[:i] + route[i:k+1][::-1] + route[k+1:]
    return new_route

def route_length(route, coords):
    s = 0.0
    for i in range(1, len(route)):
        a = coords[route[i-1]]
        b = coords[route[i]]
        s += distance(a,b)
    return s

def two_opt(route, coords, max_iter=200):
    n = len(route)
    if n <= 2:
        return route
    improved = True
    it = 0
    best_route = route
    best_len = route_length(best_route, coords)
    while improved and it < max_iter:
        improved = False
        for i in range(1, n - 1):
            for k in range(i+1, n):
                new_route = two_opt_swap(best_route, i, k)
                new_len = route_length(new_route, coords)
                if new_len + 1e-9 < best_len:
                    best_route = new_route
                    best_len = new_len
                    improved = True
                    break
            if improved:
                break
        it += 1
    return best_route

def solve_tsp_heuristic(coords: List[tuple]) -> List[int]:
    n = len(coords)
    if n <= 1:
        return list(range(n))
    # try NN from each start and take best
    best_route = None
    best_len = float("inf")
    for s in range(n):
        r = nearest_neighbor_route(coords, s)
        r = two_opt(r, coords, max_iter=200)
        l = route_length(r, coords)
        if l < best_len:
            best_len = l
            best_route = r
    return best_route
