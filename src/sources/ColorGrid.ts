import { Coordinate } from "ol/coordinate";
import { BaseGridOptions, BaseGridSource } from "./BaseGridSource";
import { dequantize, interpolateGridValue } from "../lib/utils";

/**
 * Configuration options for ColorGrid source.
 */
export type ColorOptions = BaseGridOptions<Uint8Array> & {
  /** Optional manual extremes override. */
  extremes?: [number, number];
};

/**
 * Grid source that renders a single value color map (greyscale).
 */
export class ColorGrid extends BaseGridSource<Uint8Array> {
  /**
   * @param {ColorOptions} options - The configuration options.
   */
  constructor(options: ColorOptions) {
    // Default spacingFactor for ColorGrid is 2 (divisor 128)
    const opts = { ...options, spacingFactor: options.spacingFactor ?? 2 };

    // Divisors for ColorGrid are larger than Arrow/Label
    super(opts, [256, 128, 64, 32, 16]);
  }

  /**
   * Loads the tile and generates pixel data.
   * @param {number} z - Zoom level.
   * @param {number} x - Tile X index.
   * @param {number} y - Tile Y index.
   * @returns {Uint8Array} Pixel buffer.
   */
  protected loadTile(z: number, x: number, y: number): Uint8Array {
    const {
      tileW,
      tileH,
      gridStepX,
      gridStepY,
      halfStepX,
      halfStepY,
      checkExtent,
      coordinateCalculator,
      interpolationParam,
      transform,
      tileGrid,
      data,
    } = this;

    const origin = tileGrid.getOrigin(z);
    const resolution = tileGrid.getResolution(z);

    const bbox = [
      origin[0] + tileW * resolution * x,
      origin[1] + tileH * resolution * (-y - 1),
      origin[0] + tileW * resolution * (x + 1),
      origin[1] + tileH * resolution * -y,
    ];

    const stepWidth = (bbox[2] - bbox[0]) / tileW;
    const stepHeight = (bbox[3] - bbox[1]) / tileH;

    const buffer = new Uint8Array(tileW * tileH * 4);

    for (let i = 0; i < tileW; i += gridStepX) {
      for (let j = 0; j < tileH; j += gridStepY) {
        const point = transform(
          bbox[0] + stepWidth * (i + halfStepX),
          bbox[3] - stepHeight * (j + halfStepY)
        );

        if (!checkExtent(point[0], point[1])) continue;

        const params = coordinateCalculator(
          point[0],
          point[1],
          interpolationParam
        );
        const raw = interpolateGridValue(data, params);

        if (isNaN(raw)) continue;

        const value = Math.round(raw);

        // Fill the pixel block corresponding to the grid cell
        for (let k = 0; k < gridStepY; k++) {
          for (let l = 0; l < gridStepX; l++) {
            const idx = ((j + k) * tileW + (i + l)) * 4;

            buffer[idx] = value;
            buffer[idx + 1] = value;
            buffer[idx + 2] = value;
            buffer[idx + 3] = 255;
          }
        }
      }
    }

    return buffer;
  }

  /**
   * Retrieves data value at a specific map coordinate.
   * @param {Coordinate} coordinate - The map coordinate.
   * @returns {number | null} The data value or null if invalid.
   */
  public getDataAtCoordinate = (coordinate: Coordinate): number | null => {
    const {
      transform,
      coordinateCalculator,
      interpolationParam,
      data,
      extremes,
    } = this;

    const [lon, lat] = transform(coordinate[0], coordinate[1]);
    const params = coordinateCalculator(lon, lat, interpolationParam);

    const raw = interpolateGridValue(data, params);

    if (isNaN(raw)) return null;

    return extremes ? dequantize(raw, extremes) : raw;
  };
}
