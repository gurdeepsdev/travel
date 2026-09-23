# Artictern reel delivery diagnostic

Browser proof page for the UAT video delivery contract. It uses
`startupStreamUrl`, preloads the next two reels, and reports manifest and
first-frame timings.

Serve it from an origin allowed by the R2 CORS policy:

```bash
cd frontend/reel-diagnostics
python3 -m http.server 8080
```

For Chrome testing from `http://localhost:8080`, add that origin to the UAT R2
CORS policy. Safari can use native HLS. The deployable demo should be hosted on
`https://apitest.artictern.com` or `https://artictern.com`, which are already
allowed.

Playback selection order:

```text
startupStreamUrl -> streamUrl -> url
```
