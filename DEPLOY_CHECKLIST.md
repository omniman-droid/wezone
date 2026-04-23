# Wezone Netlify Deploy Checklist

If you still see **"Frutiger Aero MMO"** on the page, Netlify is serving an older deploy.

## Expected latest markers
- Page should show a start screen with a **"Start Wezone"** button.
- It should show **Build: 2026-04-23-codex-7** on that screen.
- Browser tab title should include `Wezone (2026-04-23-codex-7)`.

## Netlify settings to verify
1. **Site → Build & deploy → Continuous deployment**
   - Correct GitHub repo selected.
   - Correct branch selected (usually `main`).
2. **Build settings**
   - Base directory: empty
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
3. Trigger a new deploy:
   - "Deploys" → "Trigger deploy" → "Deploy site".
4. Open latest deploy URL in a private/incognito tab.

## Common cause
A site can stay attached to an older repo/branch, so pushing new code to GitHub won't affect that Netlify URL.
