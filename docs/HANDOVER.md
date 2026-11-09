# Handover note

## Implemented

A complete static Swiss climate explorer with official annual MeteoSwiss grids
for temperature, precipitation, and sunshine plus NBCN hot-day stations. The app
supports 1961–2025, a real 1961–1990 baseline, play/pause, map and station
inspection, four languages, About/privacy content, and local scientific assets.

## Tested

All automated data, asset, baseline, locale, privacy, and palette checks pass.
The primary experience was manually exercised in current Chrome on a local HTTP
server, with a rendering and control smoke test in Safari. The public Pages URL,
manifest, and representative climate overlay return HTTP 200. Firefox and Edge
are not claimed as tested.

## Deployment

`.github/workflows/pages.yml` tests and deploys pushes to `main`. GitHub Pages is
enabled with GitHub Actions as its source. The live URL is
`https://uzh-it-management-2.github.io/Climate-change-project/`.

## Deviations and limitations

- The referenced Requirements PDF was not available.
- Native Figma inspection was blocked, so the embedded `.fig` preview guided the UI.
- Sunshine uses the official reconstructed annual series for baseline coverage.
- Snow and monthly visualization are not included.
- Raster popup values are authentic but sampled and rounded after reprojection.
- Client review and sign-off are pending.

## Recommended next work

1. Run Firefox and Edge smoke tests.
2. Obtain client review and record actual feedback.
3. Consider monthly data only after confirming repository-size and UX impact.
4. Re-run `scripts/process_data.py` each year after the consolidated archive updates.

