import { InterpolationParams } from "./factories";

/**
 * Result of decoding an image.
 */
export type ImageDecodingResult = {
  /** Red channel data. */
  r: Uint8Array;
  /** Green channel data. */
  g: Uint8Array;
  /** Blue channel data. */
  b: Uint8Array;
  /** Alpha channel data. */
  a: Uint8Array;
  /** Image width. */
  width: number;
  /** Image height. */
  height: number;
};

/**
 * Decodes an image from a source URL into RGBA channels.
 * @param {string} src - The image source URL.
 * @returns {Promise<ImageDecodingResult>} A promise resolving to the decoded image data.
 */
export function decodeImage(src: string): Promise<ImageDecodingResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      canvas.width = img.width;
      canvas.height = img.height;
      // Slightly unnecessary setting display none on disconnected element, but harmless.
      canvas.style.display = "none";

      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, img.width, img.height).data;

      const size = imageData.length / 4;
      const r = new Uint8Array(size);
      const g = new Uint8Array(size);
      const b = new Uint8Array(size);
      const a = new Uint8Array(size);

      for (let i = 0; i < imageData.length; i += 4) {
        const idx = i / 4;
        r[idx] = imageData[i];
        g[idx] = imageData[i + 1];
        b[idx] = imageData[i + 2];
        a[idx] = imageData[i + 3];
      }

      resolve({ r, g, b, a, width: img.width, height: img.height });
    };

    img.onerror = reject;
    img.src = src;
    img.crossOrigin = "anonymous";
  });
}

/**
 * Interpolates a value from a grid using bilinear interpolation.
 * @param {Uint8Array} grid - The flat grid data.
 * @param {InterpolationParams} params - The interpolation parameters.
 * @returns {number} The interpolated value.
 */
export function interpolateGridValue(
  grid: Uint8Array,
  params: InterpolationParams
): number {
  const { i11, i12, i21, i22, rx, ry } = params;

  const q11 = grid[i11];
  const q21 = grid[i21];
  const q12 = grid[i12];
  const q22 = grid[i22];

  const r1 = (1 - rx) * q11 + rx * q21;
  const r2 = (1 - rx) * q12 + rx * q22;

  return (1 - ry) * r1 + ry * r2;
}

/**
 * Quantizes a value to a byte (0-255) based on a range.
 * @param {number} value - The value to quantize.
 * @param {[number, number]} range - The min and max range [min, max].
 * @returns {number} The quantized byte value.
 */
export function quantize(value: number, range: [number, number]) {
  return ((value - range[0]) * 255) / (range[1] - range[0]);
}

/**
 * Dequantizes a byte (0-255) back to a value based on a range.
 * @param {number} byte - The byte value.
 * @param {[number, number]} range - The min and max range [min, max].
 * @returns {number} The dequantized value.
 */
export function dequantize(byte: number, range: [number, number]) {
  return (byte * (range[1] - range[0])) / 255 + range[0];
}

/**
 * Clamps a value between a minimum and maximum.
 * @param {number} value - The value to clamp.
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} The clamped value.
 */
export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Options for creating a heatmap style.
 */
type ColorRampOptions = {
  /** Array of [value, color] stops. */
  stops: [number, string][];
  /** The value range for the ramp. */
  range: [number, number];
  /** The channel index to use. Default is 0. */
  channel?: number;
  /** Default color for values outside range. Default is "transparent". */
  defaultColor?: string;
};

/**
 * Creates an OpenLayers style-like object for heatmap interpolation.
 * This seems to be for per-band visualization configuration.
 * @param {ColorRampOptions} options - The style options.
 * @returns {object} The style configuration object.
 */
export function createHeatmapStyle(options: ColorRampOptions) {
  const { stops, range, channel = 0, defaultColor = "transparent" } = options;
  const [min, max] = range;
  const span = max - min;

  const normalizedStops: (number | string)[] = [];

  for (const [value, color] of stops) {
    let position = span === 0 ? 0 : (value - min) / span;
    position = Math.max(0, Math.min(1, position));
    normalizedStops.push(position, color);
  }

  const bandIndex = channel + 1; // 1-based index for OL?

  return {
    color: [
      "interpolate",
      ["linear"],
      ["band", bandIndex],
      0,
      defaultColor,
      ...normalizedStops,
    ],
  };
}
