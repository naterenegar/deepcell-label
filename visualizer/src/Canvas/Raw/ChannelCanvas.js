import { useSelector } from '@xstate/react';
import React, { useEffect, useRef } from 'react';
import { useCanvas, useChannel } from '../../ServiceContext';
import { adjustRangeImageData, recolorImageData } from '../canvasUtils';

/** Converts a hex string like #FF0000 to three element array for the RGB values. */
const hexToRGB = hex => {
  const r = parseInt('0x' + hex[1] + hex[2]);
  const g = parseInt('0x' + hex[3] + hex[4]);
  const b = parseInt('0x' + hex[5] + hex[6]);
  return [r, g, b];
};

export const ChannelCanvas = ({ layer, setCanvases }) => {
  const canvas = useCanvas();
  const width = useSelector(canvas, state => state.context.width);
  const height = useSelector(canvas, state => state.context.height);

  const canvasRef = useRef();
  const ctxRef = useRef();

  const layerId = useSelector(layer, state => state.context.layer);
  const channelId = useSelector(layer, state => state.context.channel);
  const color = useSelector(layer, state => state.context.color);
  const on = useSelector(layer, state => state.context.on);

  const channel = useChannel(channelId);
  const rawImage = useSelector(channel, state => state.context.rawImage);
  const [min, max] = useSelector(channel, state => state.context.range);

  useEffect(() => {
    const channelCanvas = canvasRef.current;
    ctxRef.current = channelCanvas.getContext('2d');
  }, [canvasRef]);

  useEffect(() => {
    // draw image onto canvas to get image data
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (on) {
      ctx.drawImage(rawImage, 0, 0);
      // adjust image data
      const imageData = ctx.getImageData(0, 0, width, height);
      adjustRangeImageData(imageData, min, max);
      recolorImageData(imageData, hexToRGB(color));
      // redraw with adjusted data
      ctx.putImageData(imageData, 0, 0);
    } else {
      ctx.clearRect(0, 0, width, height);
    }
    // assign to channelCanvases to rerender
    setCanvases(prevCanvases => ({ ...prevCanvases, [layerId]: canvas }));
  }, [
    canvasRef,
    setCanvases,
    on,
    layerId,
    rawImage,
    color,
    min,
    max,
    width,
    height,
  ]);

  useEffect(() => {
    return () =>
      setCanvases(prevCanvases => {
        delete prevCanvases[layerId];
        return { ...prevCanvases };
      });
  }, [setCanvases, layerId]);

  return (
    <canvas
      id={`layer${layerId}-processing`}
      hidden={true}
      ref={canvasRef}
      width={width}
      height={height}
    />
  );
};

export default ChannelCanvas;
