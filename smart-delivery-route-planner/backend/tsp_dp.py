from typing import List, Tuple

def solve_tsp_dp(dist: List[List[float]]) -> List[int]:
    """
    Held-Karp dynamic programming approach for TSP open path (no return to start).
    Returns list of node indices in visiting order that minimize total path length.
    Works for up to ~14-16 nodes depending on performance.
    """
    n = len(dist)
    if n == 0:
        return []
    if n == 1:
        return [0]
    # dp[mask][j] = min cost to visit nodes in mask (bitmask) and end at j
    N = 1 << n
    INF = float("inf")
    dp = [ [INF] * n for _ in range(N) ]
    parent = [ [-1] * n for _ in range(N) ]

    # initialize single-node paths
    for i in range(n):
        dp[1 << i][i] = 0.0

    for mask in range(N):
        for last in range(n):
            if not (mask & (1 << last)):
                continue
            cur_cost = dp[mask][last]
            if cur_cost == INF:
                continue
            # try extend by next
            rem = (~mask) & (N - 1)
            j = rem
            while j:
                lsb = j & -j
                nxt = (lsb.bit_length() - 1)
                new_mask = mask | (1 << nxt)
                new_cost = cur_cost + dist[last][nxt]
                if new_cost < dp[new_mask][nxt]:
                    dp[new_mask][nxt] = new_cost
                    parent[new_mask][nxt] = last
                j -= lsb

    full_mask = N - 1
    # find best end node (open path — any end allowed)
    best_cost = INF
    best_end = -1
    for end in range(n):
        if dp[full_mask][end] < best_cost:
            best_cost = dp[full_mask][end]
            best_end = end

    # reconstruct path
    order = []
    mask = full_mask
    cur = best_end
    while cur != -1:
        order.append(cur)
        prev = parent[mask][cur]
        mask = mask & ~(1 << cur)
        cur = prev

    order.reverse()
    return order
