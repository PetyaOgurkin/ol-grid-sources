import { Extent } from "ol/extent";
import { Projection, ProjectionLike, toLonLat, transform } from "ol/proj";
import { clamp } from "./utils";

/**
 * Creates a coordinate transformation function.
 * @param {ProjectionLike} sourceProjection - The projection of the source coordinates.
 * @param {ProjectionLike} dataProjection - The projection of the data coordinates.
 * @returns {(x: number, y: number) => number[]} A function that transforms coordinates [x, y] to the data projection.
 */
export function createTransformFunc(
  sourceProjection: ProjectionLike,
  dataProjection: ProjectionLike
) {
  const sourceProjectionCode =
    sourceProjection instanceof Projection
      ? sourceProjection.getCode()
      : sourceProjection;
  const dataProjectionCode =
    dataProjection instanceof Projection
      ? dataProjection.getCode()
      : dataProjection;

  if (sourceProjectionCode === dataProjectionCode) {
    return (x: number, y: number) => [x, y];
  }

  if (dataProjectionCode === "EPSG:4326") {
    return (x: number, y: number) => toLonLat([x, y], sourceProjection);
  }

  return (x: number, y: number) =>
    transform([x, y], sourceProjection, dataProjection);
}

/**
 * Creates a function to check if a coordinate is within a given extent.
 * Handles extensive crossing the date line.
 * @param {Extent} extent - The extent to check against [minX, minY, maxX, maxY].
 * @returns {(lon: number, lat: number) => boolean} A function that returns true if the coordinate is within the extent.
 */
export function createCheckExtentFunc(extent: Extent) {
  const [minX, minY, maxX, maxY] = extent;
  const crossesDateLine = maxX < minX;

  if (crossesDateLine) {
    return (lon: number, lat: number) =>
      lat >= minY && lat <= maxY && (lon >= minX || lon <= maxX);
  }

  return (lon: number, lat: number) =>
    lon >= minX && lon <= maxX && lat >= minY && lat <= maxY;
}

/**
 * Parameters for bilinear interpolation in a grid.
 */
export type InterpolationParams = {
  /** Index of top-left neighbor. */
  i11: number;
  /** Index of bottom-left neighbor. */
  i12: number;
  /** Index of top-right neighbor. */
  i21: number;
  /** Index of bottom-right neighbor. */
  i22: number;
  /** Relative X position within the cell (0-1). */
  rx: number;
  /** Relative Y position within the cell (0-1). */
  ry: number;
};

/**
 * Creates a function to calculate interpolation parameters for a given coordinate.
 * @param {number} width - Width of the data grid.
 * @param {number} height - Height of the data grid.
 * @param {Extent} extent - Extent of the data grid.
 * @returns {(lon: number, lat: number, out?: InterpolationParams) => InterpolationParams} A function returning interpolation params.
 */
export function createCoordinateCalculator(
  width: number,
  height: number,
  extent: Extent
) {
  const dx =
    extent[2] < extent[0]
      ? 180 - extent[0] + (180 + extent[2])
      : Math.abs(extent[2] - extent[0]);
  const dy = Math.abs(extent[3] - extent[1]);

  const partX = dx / width || 1;
  const partY = dy / height || 1;

  const maxX = width - 1;
  const maxY = height - 1;

  return (
    lon: number,
    lat: number,
    out?: InterpolationParams
  ): InterpolationParams => {
    const x = extent[2] < extent[0] && lon <= extent[2] ? lon + 360 : lon;

    const xCell = (x - extent[0]) / partX;
    const yCell = (lat - extent[1]) / partY;

    const xBase = Math.floor(xCell);
    const yBaseFloor = Math.floor(yCell);
    const yBaseCeil = Math.ceil(yCell);

    const x0 = clamp(xBase, 0, maxX);
    const x1 = clamp(xBase + 1, 0, maxX);

    const y0 = clamp(height - 1 - yBaseCeil, 0, maxY);
    const y1 = clamp(height - 1 - yBaseFloor, 0, maxY);

    const i11 = x0 + y1 * width;
    const i12 = x0 + y0 * width;
    const i21 = x1 + y1 * width;
    const i22 = x1 + y0 * width;

    const rx = xCell - xBase;
    const ry = yCell - yBaseFloor;

    if (out) {
      out.i11 = i11;
      out.i12 = i12;
      out.i21 = i21;
      out.i22 = i22;
      out.rx = rx;
      out.ry = ry;
      return out;
    }

    return { i11, i12, i21, i22, rx, ry };
  };
}
