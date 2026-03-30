# Deploy

This project is a static site.
There is no build step right now.

## Fastest Local Run

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\start-local.ps1
```

Then open:

```text
http://127.0.0.1:4173
```

## Fastest Public Hosting Options

### Netlify Drop

Best when you want something live quickly without setting up a repo.

1. Open the Netlify Drop site.
2. Drag this entire folder into it.
3. Use the generated public URL.

`netlify.toml` is included, but the project works even without it because the site is fully static.

### Vercel

Best when you want a cleaner long-term static deployment flow.

1. Create a new Vercel project from this folder or import it into a repo later.
2. Keep the output as a static site with no build command.
3. Deploy.

`vercel.json` is included for a minimal static config.

## What To Host

Upload the root folder contents, including:

- `index.html`
- `app.js`
- `style.css`

The markdown design docs do not affect runtime, but they can stay in the project folder.

## Important Notes

- Query-string parameters such as `?dev=1`, `?signal=...`, `?mode=...`, and `?channel=...` are part of the current authoring flow.
- The default public experience should not use `?dev=1`.
- The app uses browser local storage for contact memory in the current prototype.
