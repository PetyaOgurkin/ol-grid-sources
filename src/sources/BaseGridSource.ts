import { Extent } from "ol/extent";
import { ProjectionLike } from "ol/proj";
import DataTileSource, { Options as DataTileOptions } from "ol/source/DataTile";
import { createXYZ, TileGrid } from "ol/tilegrid";
import {
  createCheckExtentFunc,
  createCoordinateCalculator,
  createTransformFunc,
  InterpolationParams,
} from "../lib/factories";

/**
 * Options interface for BaseGridSource.
 * @template TData - The type of the data (e.g., Uint8Array, [Uint8Array, Uint8Array], or Uint8Array[]).
 */
export type BaseGridOptions<TData> = DataTileOptions & {
  /** Projection of the data. Default is "EPSG:4326". */
  dataProjection?: ProjectionLike;
  /** The data buffer(s). */
  data: TData;
  /** Value range(s) for the data. */
  extremes?: any;
  /** Width of the data grid. */
  dataWidth: number;
  /** Height of the data grid. */
  dataHeight: number;
  /** Extent of the data grid. */
  dataExtent: Extent;
  /** Factor determining the spacing of grid points. */
  spacingFactor?: number;
};

/**
 * Abstract base class for grid-based data sources.
 * Handles common initialization for coordinate transforms, extent checking, and grid calculations.
 * @template TData - The type of the data.
 */
export abstract class BaseGridSource<TData> extends DataTileSource {
  protected data: TData;
  protected extremes: any;
  protected dataWidth: number;
  protected dataHeight: number;
  protected dataExtent: Extent;

  protected transform: (x: number, y: number) => number[];
  protected checkExtent: (lon: number, lat: number) => boolean;
  protected coordinateCalculator: (
    lon: number,
    lat: number,
    out?: InterpolationParams
  ) => InterpolationParams;

  protected tileGrid: TileGrid;
  protected tileW: number;
  protected tileH: number;

  protected gridStepX: number;
  protected gridStepY: number;
  protected halfStepX: number;
  protected halfStepY: number;

  protected interpolationParam: InterpolationParams;

  /**
   * @param {BaseGridOptions<TData>} options - Configuration options.
   * @param {number[]} divisors - Array of divisors for calculating grid steps based on spacingFactor.
   */
  constructor(
    options: BaseGridOptions<TData>,
    divisors: number[] = [16, 8, 4, 2, 1]
  ) {
    const {
      data,
      extremes,
      dataWidth,
      dataHeight,
      dataExtent,
      projection = "EPSG:3857",
      dataProjection = "EPSG:4326",
      tileSize = 256,
      spacingFactor = 3,
      tileGrid = createXYZ({
        maxResolution: options.maxResolution,
        maxZoom: options.maxZoom,
        minZoom: options.minZoom,
        tileSize: tileSize,
      }),
      ...opts
    } = options;

    super({
      ...opts,
      projection,
      tileGrid,
      tileSize,
      // We bind the loader to the instance method
      loader: (z, x, y) => this.loadTile(z, x, y),
    });

    this.data = data;
    this.extremes = extremes;
    this.dataWidth = dataWidth;
    this.dataHeight = dataHeight;
    this.dataExtent = dataExtent;
    this.tileGrid = tileGrid as TileGrid;

    this.transform = createTransformFunc(projection, dataProjection);
    this.checkExtent = createCheckExtentFunc(dataExtent);
    this.coordinateCalculator = createCoordinateCalculator(
      dataWidth,
      dataHeight,
      dataExtent
    );

    const [tW, tH] = Array.isArray(tileSize) ? tileSize : [tileSize, tileSize];
    this.tileW = tW;
    this.tileH = tH;

    const divisorIdx = Math.max(
      0,
      Math.min(divisors.length - 1, (options.spacingFactor ?? 1) - 1)
    );
    const divisor = divisors[divisorIdx];

    this.gridStepX = Math.round(this.tileW / divisor);
    this.gridStepY = Math.round(this.tileH / divisor);
    this.halfStepX = this.gridStepX / 2;
    this.halfStepY = this.gridStepY / 2;

    // Initialize reusable object for interpolation to reduce GC
    this.interpolationParam = { i11: 0, i12: 0, i21: 0, i22: 0, rx: 0, ry: 0 };
  }

  /**
   * Loads the tile data. Must be implemented by subclasses.
   * @param {number} z - Tile zoom level.
   * @param {number} x - Tile x coordinate.
   * @param {number} y - Tile y coordinate.
   * @returns {Uint8Array | Uint8ClampedArray | Float32Array | DataView} The tile data.
   */
  protected abstract loadTile(
    z: number,
    x: number,
    y: number
  ): Uint8Array | Uint8ClampedArray | Float32Array | DataView;
}
