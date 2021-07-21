/** Helper functions to manipulate ImageData. */

type Label = number;

type RGBAColor = [number, number, number, number];

type DrawFunction = (label: Label) => RGBAColor;

/** Generalized function to draw an image from a label array. */
export function drawLabels(
  imageData: ImageData,
  labelArray: Label[][],
  drawFunction: DrawFunction
): void {
  const { data, width, height } = imageData;
  for (let j = 0; j < height; j += 1) {
    for (let i = 0; i < width; i += 1) {
      const label = labelArray[j][i];
      const [r, g, b, a] = drawFunction(label);
      data[(j * width + i) * 4 + 0] = r;
      data[(j * width + i) * 4 + 1] = g;
      data[(j * width + i) * 4 + 2] = b;
      data[(j * width + i) * 4 + 3] = a;
    }
  }
}

/**
 * Changes the opacity of the image.
 * @param {ImageData} imageData
 * @param {float} opacity between 0 and 1; 0 makes the image transparent, and 1 does nothing
 */
export function opacityImageData(imageData: ImageData, opacity: number): void {
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    data[i + 3] *= opacity;
  }
}

// contrast between 0 and 1
export function contrastImageData(imageData: ImageData, contrast: number) {
  const { data } = imageData;
  contrast *= 255; // scale fraction to full range of pixel values
  const factor = (255 + contrast) / (255.01 - contrast); // add .1 to avoid /0 error
  for (let i = 0; i < data.length; i += 4) {
    data[i] = factor * (data[i] - 128) + 128;
    data[i + 1] = factor * (data[i + 1] - 128) + 128;
    data[i + 2] = factor * (data[i + 2] - 128) + 128;
  }
}

// brightness between -1 and 1
export function brightnessImageData(
  imageData: ImageData,
  brightness: number
): void {
  const { data } = imageData;
  brightness *= 255; // scale fraction to full range of pixel values
  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] + brightness;
    data[i + 1] = data[i + 1] + brightness;
    data[i + 2] = data[i + 2] + brightness;
  }
}

export function adjustRangeImageData(
  imageData: ImageData,
  min: number,
  max: number
): void {
  const { data } = imageData;
  const diff = max - min;
  const scale = diff === 0 ? 255 : 255 / diff;

  for (let i = 0; i < data.length; i += 4) {
    //pixel values in 4-byte blocks (r,g,b,a)
    data[i] = (data[i] - min) * scale; //r value
    data[i + 1] = (data[i + 1] - min) * scale; //g value
    data[i + 2] = (data[i + 2] - min) * scale; //b value
  }
}

export function recolorImageData(imageData: ImageData, color: RGBAColor) {
  const { data } = imageData;
  const [red, green, blue] = color;
  for (let i = 0; i < data.length; i += 4) {
    data[i] *= red / 255;
    data[i + 1] *= green / 255;
    data[i + 2] *= blue / 255;
  }
  return data;
}

export function invertImageData(imageData: ImageData) {
  const { data } = imageData;
  for (let i = 0; i < data.length; i += 4) {
    //pixel values in 4-byte blocks (r,g,b,a)
    data[i] = 255 - data[i];
    data[i + 1] = 255 - data[i + 1];
    data[i + 2] = 255 - data[i + 2];
  }
}

/**
 * Draws a a solid outline circle of radius brushSize on the context at (x, y).
 */
export function drawBrush(
  ctx: any,
  x: number,
  y: number,
  brushSize: number,
  brushColor: RGBAColor
) {
  const [r, g, b, a] = brushColor;
  const [sx, sy, sw, sh] = [
    x - brushSize + 1,
    y - brushSize + 1,
    2 * brushSize - 1,
    2 * brushSize - 1,
  ];
  const imageData = ctx.getImageData(sx, sy, sw, sh);
  const { data, height, width } = imageData;
  for (let j = 0; j < height; j += 1) {
    for (let i = 0; i < width; i += 1) {
      if (onBrush(i, j, brushSize)) {
        data[(j * width + i) * 4 + 0] = r;
        data[(j * width + i) * 4 + 1] = g;
        data[(j * width + i) * 4 + 2] = b;
        data[(j * width + i) * 4 + 3] = a;
      }
    }
  }
  ctx.putImageData(imageData, sx, sy);
}

/**
 * Draws a translucent, filled-in circle of radius brushSize on the context at (x, y).
 */
export function drawTrace(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  brushSize: number
) {
  const [sx, sy, sw, sh] = [
    x - brushSize + 1,
    y - brushSize + 1,
    2 * brushSize - 1,
    2 * brushSize - 1,
  ];
  const imageData = ctx.getImageData(sx, sy, sw, sh);
  const { data, height, width } = imageData;
  for (let j = 0; j < height; j += 1) {
    for (let i = 0; i < width; i += 1) {
      if (insideBrush(i, j, brushSize)) {
        data[(j * width + i) * 4 + 0] = 255;
        data[(j * width + i) * 4 + 1] = 255;
        data[(j * width + i) * 4 + 2] = 255;
        data[(j * width + i) * 4 + 3] = 255 / 2;
      }
    }
  }
  ctx.putImageData(imageData, sx, sy);
}

/**
 * Draws a bounding box between the two points.
 * Has an opaque outline and a translucent interior.
 */
export function drawBox(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) {
  const [sx, sy] = [Math.min(x1, x2), Math.min(y1, y2)];
  const [sw, sh] = [Math.abs(x1 - x2) + 1, Math.abs(y1 - y2) + 1];
  const imageData = ctx.getImageData(sx, sy, sw, sh);
  const { data, height, width } = imageData;
  for (let j = 0; j < height; j += 1) {
    for (let i = 0; i < width; i += 1) {
      data[(j * width + i) * 4 + 0] = 255;
      data[(j * width + i) * 4 + 1] = 255;
      data[(j * width + i) * 4 + 2] = 255;
      if (j === 0 || j === height - 1 || i === 0 || i === width - 1) {
        // solid outline
        data[(j * width + i) * 4 + 3] = 255;
      } else {
        // translucent interior
        data[(j * width + i) * 4 + 3] = 128;
      }
    }
  }
  ctx.putImageData(imageData, sx, sy);
}

// Internal helper functions

/**
 * Returns the distance of (x, y) to the origin (0, 0).
 */
function distance(x: number, y: number): number {
  return Math.sqrt(Math.pow(y, 2) + Math.pow(x, 2));
}

/**
 * Returns whether the pixel at (x, y) of the brush bounding box is on the brush border.
 */
function onBrush(x: number, y: number, brushSize: number): boolean {
  const radius = brushSize - 1;
  return (
    Math.floor(distance(x - radius, y - radius)) === radius &&
    // not on border if next to border in both directions
    !(
      Math.floor(distance(Math.abs(x - radius) + 1, y - radius)) === radius &&
      Math.floor(distance(x - radius, Math.abs(y - radius) + 1)) === radius
    )
  );
}

/**
 * Returns whether the pixel at (x, y) of the brush bounding box is inside the brush.
 */
function insideBrush(x: number, y: number, brushSize: number): boolean {
  const radius = brushSize - 1;
  return Math.floor(distance(x - radius, y - radius)) <= radius;
}
