# Xano snapshots

Read-only exports of the Xano functions and endpoints this repo changes, so changes can be reviewed in git and rolled back.

- `flutter-v2-sandbox/`: workspace 1 ("Social Bees"), branch `flutter-v2-sandbox`. Never edit the live `v1` branch from here.
- The source of truth is still Xano. After changing an object in Xano, re-export it here in the same commit.
- To roll back, paste the committed `.xs` file back into the object in Xano (or `updateFunction` / `updateAPI` through the Xano MCP).
- `CHANGELOG.md` lists every Xano change: object, branch, what it does, status, and how it was tested. Update it in the same commit as the `.xs` file.
