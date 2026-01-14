import { Map, Overlay, View } from "ol";
import TileLayer from "ol/layer/Tile";
import WebGLTileLayer from "ol/layer/WebGLTile";
import "ol/ol.css";
import OSM from "ol/source/OSM";
import proj4 from "proj4";
import { register } from "ol/proj/proj4";
import {
  ArrowGrid,
  ColorGrid,
  ImageDecodingResult,
  LabelGrid,
  createHeatmapStyle,
  decodeImage,
} from "ol-grid-sources";
import { ProjectionLike } from "ol/proj";

proj4.defs(
  "EPSG:3576",
  "+proj=laea +lat_0=90 +lon_0=90 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"
);

register(proj4);

const hint = new Overlay({
  offset: [20, 20],
  element: document.querySelector("#overlay") as HTMLDivElement,
});

const map = new Map({
  target: "map",
  view: new View({
    center: [0, 0],
    zoom: 1,
  }),
  layers: [
    new TileLayer({
      source: new OSM(),
    }),
  ],
  overlays: [hint],
});

function createColorGrid(
  projection: ProjectionLike,
  data: Uint8Array,
  dataWidth: number,
  dataHeight: number
) {
  return new ColorGrid({
    data,
    extremes: [-65, 55],
    dataExtent: [-180, -90.125, 180, 90.125],
    dataWidth,
    dataHeight,
    wrapX: true,
    interpolate: true,
    spacingFactor: 2,
    projection,
  });
}

function createArrowGrid(
  projection: ProjectionLike,
  data: [Uint8Array, Uint8Array],
  dataWidth: number,
  dataHeight: number
) {
  return new ArrowGrid({
    data,
    extremes: [-40, 40],
    dataExtent: [-180, -90.125, 180, 90.125],
    dataHeight,
    dataWidth,
    wrapX: true,
    interpolate: true,
    spacingFactor: 3,
    projection,
    style: ({ speed }) => ({
      shadowColor: "#000000",
      shadowBlur: 2,
      strokeWidth: 3,
      length: Math.min(50, Math.max(20, 20 + speed * 0.5)),
      headSize: 7,
      color:
        speed >= 33
          ? "#D5102D"
          : speed >= 25
          ? "#ED6312"
          : speed >= 15
          ? "#EDC212"
          : speed >= 5
          ? "#73ED12"
          : "#AEF1F9",
    }),
  });
}

function createLabelGrid(
  projection: ProjectionLike,
  data: Uint8Array[],
  dataWidth: number,
  dataHeight: number
) {
  return new LabelGrid({
    data,
    extremes: [-65, 55],
    dataExtent: [-180, -90.125, 180, 90.125],
    dataHeight,
    dataWidth,
    wrapX: true,
    interpolate: true,
    spacingFactor: 3,
    projection,
    text: (temp) => temp.toFixed(0),
    style: {
      fontSize: "1.5rem",
      fill: "#000000",
      fontWeight: "bold",
    },
  });
}

import textureUrl from "./assets/texture.png";

let colorGridLayer: WebGLTileLayer;
let arrowGridLayer: WebGLTileLayer;
let labelGridLayer: WebGLTileLayer;

let data: ImageDecodingResult;

decodeImage(textureUrl).then((res) => {
  data = res;
  colorGridLayer = new WebGLTileLayer({
    source: createColorGrid("EPSG:3857", data.r, data.width, data.height),
    opacity: 0.5,
    style: createHeatmapStyle({
      stops: [
        [-40, "#E3E3E3"],
        [-30, "#F3A5F3"],
        [-20, "#8E108E"],
        [-15, "#291E6A"],
        [-10, "#5650AB"],
        [-5, "#4178BE"],
        [0, "#4FB296"],
        [5, "#5BC94C"],
        [10, "#B7DA40"],
        [15, "#E1CE39"],
        [20, "#E09F41"],
        [25, "#DB6C54"],
        [30, "#B73466"],
        [40, "#6B1527"],
        [50, "#2B0001"],
      ],
      range: [-65, 55],
    }),
  });

  arrowGridLayer = new WebGLTileLayer({
    source: createArrowGrid(
      "EPSG:3857",
      [data.g, data.b],
      data.width,
      data.height
    ),
  });

  labelGridLayer = new WebGLTileLayer({
    source: createLabelGrid("EPSG:3857", [data.r], data.width, data.height),
    visible: false,
  });

  map.addLayer(colorGridLayer);
  map.addLayer(arrowGridLayer);
  map.addLayer(labelGridLayer);
});

map.on("pointermove", (e) => {
  if (!colorGridLayer) return;

  hint.setPosition(e.coordinate);

  const temp = (colorGridLayer.getSource() as ColorGrid).getDataAtCoordinate(
    e.coordinate
  );

  const { speed } =
    (arrowGridLayer.getSource() as ArrowGrid).getVectorAtCoordinate(
      e.coordinate
    ) || {};

  hint.getElement()!.innerText = `${temp?.toFixed()}°c | ${speed?.toFixed(
    1
  )}m/s`;
});

map.getViewport().addEventListener("mouseleave", () => {
  hint.setPosition(undefined);
  hint.getElement()!.innerHTML = "";
});

document.querySelector("#proj-3857")?.addEventListener("change", () => {
  map.setView(
    new View({
      center: [0, 0],
      zoom: 1,
    })
  );

  colorGridLayer.setSource(
    createColorGrid("EPSG:3857", data.r, data.width, data.height)
  );

  arrowGridLayer.setSource(
    createArrowGrid("EPSG:3857", [data.g, data.b], data.width, data.height)
  );

  labelGridLayer.setSource(
    createLabelGrid("EPSG:3857", [data.r], data.width, data.height)
  );
});

document.querySelector("#proj-3576")?.addEventListener("change", () => {
  map.setView(
    new View({
      projection: "EPSG:3576",
      center: [0, 0],
      zoom: 4,
    })
  );

  colorGridLayer.setSource(
    createColorGrid("EPSG:3576", data.r, data.width, data.height)
  );

  arrowGridLayer.setSource(
    createArrowGrid("EPSG:3576", [data.g, data.b], data.width, data.height)
  );

  labelGridLayer.setSource(
    createLabelGrid("EPSG:3576", [data.r], data.width, data.height)
  );
});

document.querySelector("#layer-color")?.addEventListener("change", (e) => {
  colorGridLayer.setVisible((e.target as HTMLInputElement).checked);
});

document.querySelector("#layer-arrow")?.addEventListener("change", (e) => {
  arrowGridLayer.setVisible((e.target as HTMLInputElement).checked);
});

document.querySelector("#layer-label")?.addEventListener("change", (e) => {
  labelGridLayer.setVisible((e.target as HTMLInputElement).checked);
});
