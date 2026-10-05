# Monitor Comparison

I was shopping for a monitor and wanted a nice, intuitive visual way to compare them. This interactive chart lets you plot monitors on any pair of axes (resolution, megapixels, PPI, aspect ratio, diagonal, physical width and height, screen area, refresh rate), toggle individual monitors or whole categories, and overlay reference lines for common aspect ratios, megapixel counts, screen areas, and pixel densities.

Check it out here: https://joshuaswanson.github.io/monitor-comparison/

## Running locally

The page loads `monitors.json` with `fetch`, so it needs an HTTP server.

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Support

If you find this useful, [buy me a coffee](https://buymeacoffee.com/swanson).

<img src="assets/bmc_qr.png" alt="Buy Me a Coffee QR" width="200">
