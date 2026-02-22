# Project Tasks

## Current Phase: Graph UI/UX Upgrades (Phase 2 & 3)

### Ongoing / Remaining

- [x] **Advanced Connections Navigation**
  - [x] **Color Coding:** Define a color palette mapped to relationship types and apply colors to edge renders in `fetchGraph()`.
  - [x] **Double Click Edit:** Add an `onEdgeDoubleClick` listener in ReactFlow to surface an Edge Edit/Delete modal.
  - [x] **Parallel Connections Support:** Implement a custom edge calculation function to curve parallel edges apart (e.g., A → B and B → A) so they are individually distinct and clickable.
  
- [x] **Backend Connections Deletion**
  - [x] Add the `DELETE /api/knowledge/relationships` endpoint to the frontend Double Click Edit logic.

### Completed

- [x] **Minimalist Node Appearance** (Refactored `KnowledgeNode.tsx`)
- [x] **Node Position Persistence** (Added `x`/`y` backend fields and `onNodeDragStop` frontend hook)
- [x] **Dual Page System & 'Expose' Toggle** (Added `is_exposed` toggle in sidebar, applied UI filtering)
- [x] **Drag-to-Connect Base Feature** (Added UI handlers for interactive edges mapping to `POST /api/knowledge/relationships`)
