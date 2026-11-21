# Graph Report - GAMSUNG  (2026-11-21)

## Corpus Check
- Corpus is ~3,670 words - fits in a single context window. You may not need a graph.

## Summary
- 14 nodes · 16 edges · 5 communities (1 shown, 4 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Game Loop & Camera
- Joystick Input
- Movement & Collision
- Pixel Sprites
- World Generation

## God Nodes (most connected - your core abstractions)
1. `frame()` - 4 edges
2. `cameraTarget()` - 3 edges
3. `update()` - 3 edges
4. `render()` - 3 edges
5. `fit()` - 2 edges
6. `moveAxis()` - 2 edges
7. `drawPlayer()` - 2 edges
8. `Input` - 1 edges
9. `Sprites` - 1 edges
10. `World` - 1 edges

## Surprising Connections (you probably didn't know these)
- `frame()` --calls--> `update()`  [EXTRACTED]
  js/main.js → js/main.js  _Bridges community 2 → community 0_

## Import Cycles
- None detected.

## Communities (5 total, 4 thin omitted)

### Community 0 - "Game Loop & Camera"
Cohesion: 0.60
Nodes (5): cameraTarget(), drawPlayer(), fit(), frame(), render()

## Knowledge Gaps
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `frame()` connect `Game Loop & Camera` to `Movement & Collision`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `update()` connect `Movement & Collision` to `Game Loop & Camera`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._