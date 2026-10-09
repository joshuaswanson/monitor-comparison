<h1 align="center">
  <img src="assets/logo.svg" alt="Joshua's Monitor Comparison" width="560">
</h1>

I was shopping for a monitor and wanted a nice, intuitive visual way to compare them. This interactive chart lets you plot monitors on any pair of axes (resolution, megapixels, PPI, aspect ratio, diagonal, physical width and height, screen area, refresh rate, price), toggle individual monitors or whole categories, filter by diagonal, pixel density, refresh rate, list price, and panel type, and overlay reference lines for common aspect ratios, megapixel counts, screen areas, and pixel densities. The current view is stored in the URL, so a link reproduces it. The page has light and dark themes and follows the system setting by default.

Check it out here: https://joshuaswanson.github.io/monitor-comparison/

## Data

All monitors live in `monitors.json`. Optional fields per monitor:

- `price`: the manufacturer's US list price in USD.
- `year`: year of US release.
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
