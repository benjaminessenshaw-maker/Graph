# Changelog & Agent Log

## Recent Actions

- Verification & Refinement of Node Position Persistence: Restarted and debugged FastAPI backend missing `NodePartialUpdate` import. Backend patch endpoint `PATCH /api/knowledge/nodes/{id}` functions securely.
- Verification & Refinement of Dual UI Views: Ensured frontend mapping `apiToNodes` carried the `is_exposed` boolean. Prompting View properly filters active nodes while Database View shows everything.
- Edge Deletion Prep: Modified `knowledge_repository.py` to add `delete_relationship()` helper mapping, laying the ground work for upcoming double-click-delete graph functionality.
- Advanced Edge Features Completed: Color coding implemented. Parallel Connections offset geometrically. Double-Click modal added. Deletion backend endpoint successfully connected and tested.
- Edge Readability Enhanced: Implemented geometric repeating arrows using SVG `<textPath>` to clearly indicate directionality along all relationship curves.
