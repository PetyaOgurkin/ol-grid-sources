import { Coordinate } from "ol/coordinate";
import { BaseGridOptions, BaseGridSource } from "./BaseGridSource";
import { dequantize, interpolateGridValue } from "../lib/utils";

/**
 * Configuration for text label styling.
 */
export type LabelStyle = {
  /** Font size (e.g. 10 or "10px"). */
  fontSize?: number | string;
  /** Font family. */
  fontFamily?: string;
  /** Font weight. */
  fontWeight?: string | number;
  /** Font style (normal, italic, etc). */
  fontStyle?: string;
  /** Fill color. */
  fill?: string;
  /** Stroke color. */
  stroke?: string;
  /** Stroke width. */
  strokeWidth?: number;
  /** Shadow color. */
  shadowColor?: string;
  /** Shadow blur radius. */
  shadowBlur?: number;
  /** Shadow X offset. */
  shadowOffsetX?: number;
  /** Shadow Y offset. */
  shadowOffsetY?: number;
  /** Text alignment. */
  textAlign?: CanvasTextAlign;
  /** Text baseline. */
  textBaseline?: CanvasTextBaseline;
};

/**
 * Function to determine label style dynamically based on values.
 */
export type LabelStyleFunction = (...values: number[]) => LabelStyle;

/**
 * Configuration options for LabelGrid source.
 */
export type LabelOptions = BaseGridOptions<Uint8Array[]> & {
  /** Extremes for each data channel. */
  extremes: [number, number] | [number, number][];
  /** Function to format text from values. */
  text?: (...values: number[]) => string | null | undefined;
  /** Style object or function. */
  style?: LabelStyle | LabelStyleFunction;
};

/**
 * Grid source that renders text labels based on data values.
 */
export class LabelGrid extends BaseGridSource<Uint8Array[]> {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private textFormatter: (...values: number[]) => string | null | undefined;
  private style: LabelStyle | LabelStyleFunction;
  private baseStyle: Required<Omit<LabelStyle, "stroke">> & { stroke?: string };

  /**
   * @param {LabelOptions} options - The configuration options.
   */
  constructor(options: LabelOptions) {
    const computed = window.getComputedStyle(document.body);
    const BASE_STYLE: Required<Omit<LabelStyle, "stroke">> & {
      stroke?: string;
    } = {
      fontSize: computed.fontSize || "10px",
      fontFamily: computed.fontFamily || "sans-serif",
      fontWeight: computed.fontWeight || "normal",
      fontStyle: computed.fontStyle || "normal",
      fill: computed.color || "#000000",
      stroke: undefined,
      strokeWidth: 3,
      shadowColor: "transparent",
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      textAlign: "center",
      textBaseline: "middle",
    };

    // Default spacingFactor for LabelGrid is 4
    const opts = { ...options, spacingFactor: options.spacingFactor ?? 4 };

    super(opts, [16, 8, 4, 2, 1]);

    this.textFormatter =
      options.text || ((...v) => v.map((n) => n.toFixed(1)).join(" "));

    this.style =
      typeof options.style === "function"
        ? options.style
        : { ...BASE_STYLE, ...(options.style || {}) };

    this.baseStyle = BASE_STYLE;

    this.canvas = document.createElement("canvas");
    this.canvas.width = this.tileW;
    this.canvas.height = this.tileH;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;

    // Non-dynamic style setup
    if (typeof this.style !== "function") {
      const s = this.style as LabelStyle;

      this.ctx.textAlign = s.textAlign!;
      this.ctx.textBaseline = s.textBaseline!;
      this.ctx.lineWidth = s.strokeWidth!;

      if (s.stroke) this.ctx.strokeStyle = s.stroke;

      this.ctx.shadowColor = s.shadowColor!;
      this.ctx.shadowBlur = s.shadowBlur!;
      this.ctx.shadowOffsetX = s.shadowOffsetX!;
      this.ctx.shadowOffsetY = s.shadowOffsetY!;

      this.ctx.fillStyle = s.fill!;
      this.ctx.font = this.buildFont(s);
    }
  }

  private buildFont(s: LabelStyle): string {
    const fStyle = s.fontStyle || this.baseStyle.fontStyle;
    const fWeight = s.fontWeight || this.baseStyle.fontWeight;
    const fSize = s.fontSize || this.baseStyle.fontSize;
    const fFamily = s.fontFamily || this.baseStyle.fontFamily;

    const sizeStr = typeof fSize === "number" ? `${fSize}px` : fSize;
    return `${fStyle} ${fWeight} ${sizeStr} ${fFamily}`;
  }

  /**
   * Loads the tile and renders labels.
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
      textFormatter,
      style,
      baseStyle,
    } = this;

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

    const isMultiExtremes = Array.isArray(extremes[0]);
    const ranges = (isMultiExtremes ? extremes : [extremes]) as [
      number,
      number
    ][];

    let lastFont = ctx.font;
    const values = new Array(data.length);

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
        let hasNoData = false;

        for (let k = 0; k < data.length; k++) {
          const raw = interpolateGridValue(data[k], params);
          if (isNaN(raw)) {
            hasNoData = true;
            break;
          }
          const range = isMultiExtremes ? ranges[k] : ranges[0];
          values[k] = dequantize(raw, range);
        }

        if (hasNoData) continue;

        const label = textFormatter(...values);
        if (!label) continue;

        let hasStroke = false;

        if (typeof style === "function") {
          const s = style(...values);

          const fontString = this.buildFont(s);
          if (fontString !== lastFont) {
            ctx.font = fontString;
            lastFont = fontString;
          }

          ctx.fillStyle = s.fill || baseStyle.fill!;
          ctx.textAlign = s.textAlign || baseStyle.textAlign!;
          ctx.textBaseline = s.textBaseline || baseStyle.textBaseline!;

          ctx.shadowColor = s.shadowColor || baseStyle.shadowColor!;
          ctx.shadowBlur = s.shadowBlur || baseStyle.shadowBlur!;
          ctx.shadowOffsetX = s.shadowOffsetX || baseStyle.shadowOffsetX!;
          ctx.shadowOffsetY = s.shadowOffsetY || baseStyle.shadowOffsetY!;

          if (s.stroke) {
            hasStroke = true;
            ctx.strokeStyle = s.stroke;
            ctx.lineWidth = s.strokeWidth || baseStyle.strokeWidth!;
          }
        } else {
          hasStroke = !!(style as LabelStyle).stroke;
        }

        if (hasStroke) {
          ctx.strokeText(label, i + halfStepX, j + halfStepY);
        }
        ctx.fillText(label, i + halfStepX, j + halfStepY);
      }
    }

    return new Uint8Array(ctx.getImageData(0, 0, tileW, tileH).data.buffer);
  }

  /**
   * Retrieves data values at a specific map coordinate.
   * @param {Coordinate} coordinate - The map coordinate.
   * @returns {number[]} Array of values or empty/containing NaNs if invalid.
   */
  public getDataAtCoordinate = (coordinate: Coordinate): number[] => {
    const {
      transform,
      coordinateCalculator,
      interpolationParam,
      data,
      extremes,
    } = this;

    const [lon, lat] = transform(coordinate[0], coordinate[1]);
    const params = coordinateCalculator(lon, lat, interpolationParam);

    const isMultiExtremes = Array.isArray(extremes[0]);
    const ranges = (isMultiExtremes ? extremes : [extremes]) as [
      number,
      number
    ][];

    return data.map((grid, index) => {
      const raw = interpolateGridValue(grid, params);
      if (isNaN(raw)) return NaN;
      const range = isMultiExtremes ? ranges[index] : ranges[0];
      return dequantize(raw, range);
    });
  };
}
