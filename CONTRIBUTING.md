# Contributing to FUNAAB Life

Thanks for your interest in improving FUNAAB Life. Contributions of bug fixes, documentation, tests, and thoughtful features are welcome.

## Before you start

- Search existing issues and discussions to avoid duplicating work.
- For a significant feature or behavior change, open an issue first to discuss the approach.
- Keep changes focused and follow the conventions already used in the affected area.

## Development setup

1. Install Node.js 20 or newer and npm.
2. Run `npm ci`.
3. Copy `.env.example` to `.env` and configure only the public Supabase URL/key if needed. For local testing without Supabase, `VITE_ENABLE_GUEST_MODE=true` enables guest mode.
4. Run `npm run server` and `npm run dev` in separate terminals.

Database-backed features may require a local Supabase project with the migrations in `supabase/migrations/` applied. The Cloudflare Worker can be run locally with `npm run worker:dev`.

## Tests and checks

Run the checks relevant to your change:

```sh
npm run build
npm run worker:typecheck
```

Focused suites are available through `npm run test:student`, `npm run test:hostel`, `npm run test:campus`, `npm run test:room`, and `npm run test:keke:worker`. Database and browser test scripts may require extra local services or configuration.

If a check cannot be run, mention that and the reason in your pull request.

## Pull requests

- Use a clear title and explain the user-facing change and its motivation.
- Keep the diff focused; include tests and documentation updates for changed behavior.
- Describe how you tested the change and note any required migration or environment setup.
- Confirm that generated files, local data, and credentials are not included.

## Security and configuration

- Never commit `.env`, `.dev.vars`, API credentials, service-role keys, signing secrets, real user data, or production database exports.
- Do not place secrets in `VITE_` variables. Vite exposes those values to every browser user.
- Put Worker credentials in local ignored `.dev.vars` for development or configure them with `wrangler secret put` for deployment.
- Use synthetic values in tests and examples.

By submitting a contribution, you agree that it is provided under the project's [MIT License](./LICENSE).
