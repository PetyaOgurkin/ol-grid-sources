import { Coordinate } from "ol/coordinate";
import { BaseGridOptions, BaseGridSource } from "./BaseGridSource";
import { dequantize, interpolateGridValue } from "../lib/utils";

/**
 * Data structure representing a vector at a grid point.
 */
export type ArrowData = {
  /** U-component (horizontal) of the vector. */
  u: number;
  /** V-component (vertical) of the vector. */
  v: number;
  /** Magnitude of the vector. */
  speed: number;
  /** Angle of the vector in radians. */
  angle: number;
};

/**
 * Style configuration for arrows.
 */
export type ArrowStyle = {
  /** Stroke color. Default is "#000000". */
  color?: string;
  /** Length of the arrow in pixels. Default is 30. */
  length?: number;
  /** Size of the arrow head in pixels. Default is 10. */
  headSize?: number;
  /** Stroke width in pixels. Default is 2. */
  strokeWidth?: number;
  /** Shadow color. Default is "transparent". */
  shadowColor?: string;
  /** Shadow blur radius. Default is 0. */
  shadowBlur?: number;
  /** Horizontal shadow offset. Default is 0. */
  shadowOffsetX?: number;
  /** Vertical shadow offset. Default is 0. */
  shadowOffsetY?: number;
};

/**
 * Function to determine arrow style based on vector data.
 */
export type ArrowStyleFunction = (data: ArrowData) => ArrowStyle;

/**
 * Configuration options for ArrowGrid source.
 */
export type ArrowOptions = BaseGridOptions<[Uint8Array, Uint8Array]> & {
  /** Threshold for vector magnitude to render an arrow. Default is 0. */
  speedThreshold?: number;
  /** Style object or function for arrows. */
  style?: ArrowStyle | ArrowStyleFunction;
};

/**
 * Grid source that renders arrows based on U/V vector components.
 */
export class ArrowGrid extends BaseGridSource<[Uint8Array, Uint8Array]> {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private speedThreshold: number;
  private style: ArrowStyle | ArrowStyleFunction;
  private defaultStyle: Required<ArrowStyle>;

  /**
   * @param {ArrowOptions} options - The configuration options.
   */
  constructor(options: ArrowOptions) {
    // Default spacingFactor for ArrowGrid is 3 (divisor 4)
    // We modify the options before passing to super if needed, or rely on super's checking.
    // BaseGridSource uses passed spacingFactor or 1.
    // We want default 3 if undefined.
    const opts = { ...options, spacingFactor: options.spacingFactor ?? 3 };

    super(opts, [16, 8, 4, 2, 1]);

    const defaultStyle = {
      color: "#000000",
      length: 30,
      headSize: 10,
      strokeWidth: 2,
      shadowColor: "transparent",
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
    };

    this.speedThreshold = opts.speedThreshold || 0;
    this.style = opts.style || { ...defaultStyle };
    this.defaultStyle = defaultStyle;

    this.canvas = document.createElement("canvas");
    this.canvas.width = this.tileW;
    this.canvas.height = this.tileH;
    // We use a shared canvas context for the instance.
    // Since loadTile is synchronous (called by DataTileSource), this is safe in main thread.
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
  }

  /**
   * Loads the tile and renders arrows.
   * @param {number} z - Zoom level.
   * @param {number} x - Tile X index.
   * @param {number} y - Tile Y index.
   * @returns {Uint8Array} Image data.
   */
  protected loadTile(z: number, x: number, y: number): Uint8Array {
    const {
      ctx,
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
      extremes,
      speedThreshold,
      style,
      defaultStyle,
    } = this;

    const [uGrid, vGrid] = data;

    ctx.clearRect(0, 0, tileW, tileH);

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

    let length = defaultStyle.length;
    let headSize = defaultStyle.headSize;

    // Set shared styles if static style object
    if (typeof style !== "function") {
      ctx.strokeStyle = style.color || defaultStyle.color;
      ctx.lineWidth = style.strokeWidth || defaultStyle.strokeWidth;
      ctx.shadowColor = style.shadowColor || defaultStyle.shadowColor;
      ctx.shadowBlur = style.shadowBlur || defaultStyle.shadowBlur;
      ctx.shadowOffsetX = style.shadowOffsetX || defaultStyle.shadowOffsetX;
      ctx.shadowOffsetY = style.shadowOffsetY || defaultStyle.shadowOffsetY;
      length = style.length || defaultStyle.length;
      headSize = style.headSize || defaultStyle.headSize;
    }

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

        const uRaw = interpolateGridValue(uGrid, params);
        const vRaw = interpolateGridValue(vGrid, params);

        if (isNaN(uRaw) || isNaN(vRaw)) continue;

        const u = dequantize(uRaw, extremes);
        const v = dequantize(vRaw, extremes);
        const speed = Math.hypot(u, v);

        if (speed < speedThreshold) continue;

        const angle = Math.atan2(-v, u);

        if (typeof style === "function") {
          const s = style({ u, v, speed, angle });

          ctx.strokeStyle = s.color || defaultStyle.color;
          ctx.lineWidth = s.strokeWidth || defaultStyle.strokeWidth;
          ctx.shadowColor = s.shadowColor || defaultStyle.shadowColor;
          ctx.shadowBlur = s.shadowBlur || defaultStyle.shadowBlur;
          ctx.shadowOffsetX = s.shadowOffsetX || defaultStyle.shadowOffsetX;
          ctx.shadowOffsetY = s.shadowOffsetY || defaultStyle.shadowOffsetY;
          length = s.length || defaultStyle.length;
          headSize = s.headSize || defaultStyle.headSize;
        }

        const halfLen = length / 2;

        ctx.save();
        ctx.translate(i + halfStepX, j + halfStepY);
        ctx.rotate(angle);

        ctx.beginPath();

        ctx.moveTo(-halfLen, 0);
        ctx.lineTo(halfLen, 0);

        ctx.moveTo(halfLen - headSize, -headSize / 2);
        ctx.lineTo(halfLen, 0);
        ctx.lineTo(halfLen - headSize, headSize / 2);

        ctx.stroke();
        ctx.restore();
      }
    }

    return new Uint8Array(ctx.getImageData(0, 0, tileW, tileH).data.buffer);
  }

  /**
   * Retrieves vector data at a specific map coordinate.
   * @param {Coordinate} coordinate - The map coordinate.
   * @returns {ArrowData | null} The vector data or null if invalid.
   */
  public getVectorAtCoordinate = (coordinate: Coordinate): ArrowData | null => {
    const {
      transform,
      coordinateCalculator,
      interpolationParam,
      data,
      extremes,
    } = this;
    const [uGrid, vGrid] = data;

    const [lon, lat] = transform(coordinate[0], coordinate[1]);

    const params = coordinateCalculator(lon, lat, interpolationParam);

    const uRaw = interpolateGridValue(uGrid, params);
    const vRaw = interpolateGridValue(vGrid, params);

    if (isNaN(uRaw) || isNaN(vRaw)) return null;

    const u = dequantize(uRaw, extremes);
    const v = dequantize(vRaw, extremes);

    const speed = Math.hypot(u, v);
    const angle = Math.atan2(-v, u);

    return { u, v, speed, angle };
  };
}
