# Monitor Comparison

I was shopping for a monitor and wanted a nice, intuitive visual way to compare them. This interactive chart lets you plot monitors on any pair of axes (resolution, megapixels, PPI, aspect ratio, diagonal, physical width and height, screen area, refresh rate, price), toggle individual monitors or whole categories, and overlay reference lines for common aspect ratios, megapixel counts, screen areas, and pixel densities. The current view is stored in the URL, so a link reproduces it.

Check it out here: https://joshuaswanson.github.io/monitor-comparison/

## Running locally

The page loads `monitors.json` with `fetch`, so it needs an HTTP server.

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Data

All monitors live in `monitors.json`. Optional fields per monitor:

- `price`: current US street price in USD. This is the lowest price found at a major US retailer or the manufacturer's store on the date in `pricesChecked` at the top of the file. Update that date whenever prices are refreshed.
- `msrp`: the manufacturer's US list price in USD.
- `year`: year of US release.
- `url`: product page.
- `upcoming`: `true` for announced monitors that are not yet on sale.

Monitors without a price are left off the chart when the price axis is selected.

Check the file after editing it:

```bash
node scripts/validate-data.mjs
```

The same check runs on every push through GitHub Actions.

## Support

If you find this useful, [buy me a coffee](https://buymeacoffee.com/swanson).

<img src="assets/bmc_qr.png" alt="Buy Me a Coffee QR" width="200">
