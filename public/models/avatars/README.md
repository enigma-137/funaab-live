Avatar asset contract
=====================

No Blender assets are required by this release. AvatarBody is the rendering boundary.
Use src/config/modelManifest.ts to register future GLBs by existing avatar option ID.

Use metres, Y-up, +Z forward and ground origin. Target approximately 2.1m avatar height.
Use shared materials, tintable skin/top/bottom slots and modest mobile texture sizes.
Bind interchangeable hair to head and clothes to a common armature. Export idle, walk,
run, sit and wave clips with consistent bone names. Test seated Keke/classroom poses.
Add GLB loading and procedural fallbacks inside AvatarBody, then validate one body and
one hairstyle before expanding the catalogue. Profile schema and presence stay stable.
