# Hostel asset boundary

`HostelItemModel` currently renders inexpensive procedural shapes. Each catalogue
entry has a stable `modelKey`; its future asset path is
`/models/hostel/<modelKey>.glb`. Replace the model resolver, not inventory IDs,
purchase records or room placements. Use metres, Y up, +Z forward, floor at Y=0.
Keep floor pieces within 1.5 × 1.5 metres, desk pieces under 0.6 metres, and wall
pieces shallow. Anchors reserve the doorway and mattress. No GLBs ship in this pass.
