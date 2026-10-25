<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# This repository is Aitta only

`Beastro12/Mise` holds one app: **Aitta**, the household meal planner and shopping list (S-market + Lidl, Turku), plus its Mac helpers in `helper/`.

- **Don't start a different project here**, not even in a subfolder. If the task is a new or unrelated app (a video pipeline, a learning app, …), stop and ask the owner to create a separate GitHub repository for it, then work there.
- New *features of Aitta* (e.g. a new tab) belong here, on a feature branch with a PR.
- Other projects that were started here by mistake have moved: `edu_video` → `Beastro12/edu_video`, Lab → `Beastro12/lab`.
