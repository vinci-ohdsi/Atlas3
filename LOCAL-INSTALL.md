# Local Atlas3 install

This guide records the frontend setup used with the sibling WebAPI 3.0 checkout.
It assumes Node.js 18+ and a running WebAPI at `http://localhost:8080/WebAPI`.

## Install and run

```bash
npm install
npm run dev
```

The development server runs at `http://localhost:5173`. It proxies requests for
`/WebAPI` to `http://localhost:8080`, so the default relative API URL avoids a
browser CORS request.

Build and serve the static bundle locally with:

```bash
npm run build
npm run preview
```

Vite preview normally serves on `http://localhost:4173`.

## Runtime configuration

Atlas loads the optional `config-local.json` at runtime from the same
directory as `index.html`. Copy
[`public/config-local.example.json`](public/config-local.example.json)
to `public/config-local.json`, then adjust only the fields required
locally.  The real config file is ignored by Git and is copied into
`dist/` by the Vite build. For development, on a system that supports
it, a symlink to the config that makes this file available for both
local development and the built application.

For development, prefer the relative URL so Vite's proxy is used:

```json
{
  "api": {
    "url": "/WebAPI"
  },
  "userAuthenticationEnabled": true,
  "authProviders": [
    {
      "name": "Database",
      "url": "user/login/db",
      "ajax": true,
      "icon": "mdi-database",
      "isUseCredentialsForm": true
    }
  ]
}
```

If the frontend must call WebAPI using an absolute URL, for example from a
static server that does not proxy `/WebAPI`, configure:

```json
{
  "api": {
    "url": "http://localhost:8080/WebAPI"
  }
}
```

In that case WebAPI must permit the frontend's exact origin. For local Vite
development and preview, set these WebAPI values and restart WebAPI:

```yaml
security:
  cors:
    allowed-origins:
      - http://localhost:5173
      - http://localhost:4173
```

`http://localhost` alone is not enough: ports are part of a browser origin.

## Database login prerequisites and WebAPI coordination

The Database login form requires WebAPI configuration; no password or database
secret belongs in Atlas's `config-local.json`.

On WebAPI, enable `security.auth.db.enabled`, configure its
`security.auth.db.datasource` from environment-variable placeholders, and seed
credentials in `webapi.auth_user`. Follow the DB-auth and secret-handling
sections of [`../WebAPI/LOCAL-INSTALL.md`](../WebAPI/LOCAL-INSTALL.md).

After WebAPI starts, verify it advertises the DB provider:

```bash
curl -s http://localhost:8080/WebAPI/auth/providers
```

Only then should Atlas be configured with the Database provider shown above.
