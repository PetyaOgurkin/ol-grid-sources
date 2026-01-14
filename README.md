# ol-grid-sources

[**Live Demo**](https://PetyaOgurkin.github.io/ol-grid-sources/)

High-performance data source for [OpenLayers](https://openlayers.org/) designed to render grid-based data (e.g., weather models, scientific data) using WebGL.

Supports multiple visualization types:

- **ColorGrid**: Heatmaps with bilinear interpolation.
- **ArrowGrid**: Vector fields (e.g., wind, currents) with customizable arrows.
- **LabelGrid**: Grid of text labels.

## Features

- 🚀 **WebGL**: Uses `ol/layer/WebGLTile` for maximum rendering performance.
- ⚡ **Bilinear Interpolation**: Smooth data smoothing between grid nodes happens on-the-fly in the shader.
- 🔄 **Reprojection**: Works with any OpenLayers projection (EPSG:3857, EPSG:4326, Polar Stereographic, etc.).
- 🎨 **Flexible Styling**: Full control over colors, sizes, and shapes based on data values.

## Installation

```bash
npm install ol-grid-sources ol
# or
pnpm add ol-grid-sources ol
# or
yarn add ol-grid-sources ol
```

## Usage

### 1. Data Preparation

Data is passed as flat `Uint8Array` or `Float32Array` arrays. The library also provides a `decodeImage` utility to decode data packed into PNGs (e.g., where R, G, B channels encode different parameters).

### 2. Example: Heatmap (ColorGrid)

```javascript
import { WebGLTileLayer } from "ol/layer";
import { ColorGrid, createHeatmapStyle } from "ol-grid-sources";

// Your data (example: 1D array of temperature values)
const data = new Uint8Array([
  /* ... */
]);
const width = 360;
const height = 180;

const layer = new WebGLTileLayer({
  source: new ColorGrid({
    data: data,
    dataWidth: width,
    dataHeight: height,
    // Geographic extent of the data [minX, minY, maxX, maxY]
    dataExtent: [-180, -90, 180, 90],
    // Value range in the data (for normalization)
    extremes: [-50, 50],
    projection: "EPSG:3857", // Target map projection
    interpolate: true, // Enable smoothing
  }),
  style: createHeatmapStyle({
    range: [-50, 50],
    stops: [
      [-50, "#0000ff"],
      [0, "#00ff00"],
      [50, "#ff0000"],
    ],
  }),
});

map.addLayer(layer);
```

### 3. Example: Wind Vectors (ArrowGrid)

```javascript
import { WebGLTileLayer } from "ol/layer";
import { ArrowGrid } from "ol-grid-sources";

// u and v components of the vector
const uComponent = new Uint8Array([
  /* ... */
]);
const vComponent = new Uint8Array([
  /* ... */
]);

const layer = new WebGLTileLayer({
  source: new ArrowGrid({
    data: [uComponent, vComponent], // Pass two channels
    dataWidth: 360,
    dataHeight: 180,
    dataExtent: [-180, -90, 180, 90],
    // Arrow style configuration
    style: ({ speed }) => ({
      color: speed > 10 ? "red" : "blue",
      length: 20 + speed,
      headSize: 5,
      strokeWidth: 2,
    }),
  }),
});

map.addLayer(layer);
```

## License

MIT
