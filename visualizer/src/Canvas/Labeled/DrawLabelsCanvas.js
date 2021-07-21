import { useSelector } from '@xstate/react';
import React, { useEffect, useRef } from 'react';
import { useCanvas, useFeature, useLabeled } from '../../ServiceContext';
import { useStyles } from '../Canvas';
import { drawLabels } from '../canvasUtils';

const DrawLabelsCanvas = ({ draw }) => {
  const styles = useStyles();

  const canvas = useCanvas();
  const sx = useSelector(canvas, state => state.context.sx);
  const sy = useSelector(canvas, state => state.context.sy);
  const zoom = useSelector(canvas, state => state.context.zoom);
  const scale = useSelector(canvas, state => state.context.scale);
  const sw = useSelector(canvas, state => state.context.width);
  const sh = useSelector(canvas, state => state.context.height);
  const width = sw * scale * window.devicePixelRatio;
  const height = sh * scale * window.devicePixelRatio;

  const labeled = useLabeled();
  const featureIndex = useSelector(labeled, state => state.context.feature);
  const feature = useFeature(featureIndex);
  let labelArray = useSelector(feature, state => state.context.labeledArray);
  if (!labelArray) {
    labelArray = Array(sh).fill(Array(sw).fill(0));
  }

  const canvasRef = useRef();
  const ctx = useRef();
  // hidden canvas convert the outline array into an image
  const hiddenCanvasRef = useRef();
  const hiddenCtx = useRef();

  useEffect(() => {
    ctx.current = canvasRef.current.getContext('2d');
    ctx.current.imageSmoothingEnabled = false;
  }, [width, height]);

  useEffect(() => {
    hiddenCtx.current = hiddenCanvasRef.current.getContext('2d');
  }, [sw, sh]);

  useEffect(() => {
    const data = new ImageData(sw, sh);
    drawLabels(data, labelArray, draw);
    hiddenCtx.current.putImageData(data, 0, 0);
  }, [sw, sh, labelArray, draw]);

  useEffect(() => {
    ctx.current.save();
    ctx.current.clearRect(0, 0, width, height);
    ctx.current.drawImage(
      hiddenCanvasRef.current,
      sx,
      sy,
      sw / zoom,
      sh / zoom,
      0,
      0,
      width,
      height
    );
    ctx.current.restore();
  }, [labelArray, draw, sw, sh, sx, sy, zoom, width, height]);

  return (
    <>
      {/* hidden processing canvas */}
      <canvas hidden={true} ref={hiddenCanvasRef} width={sw} height={sh} />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={styles.canvas}
      />
    </>
  );
};

export default DrawLabelsCanvas;
