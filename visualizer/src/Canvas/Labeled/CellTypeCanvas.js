import { useSelector } from '@xstate/react';
import { useCallback } from 'react';
import { useCellTypes, useLabeled, useSelect } from '../../ServiceContext';
import DrawLabelsCanvas from './DrawLabelsCanvas';

function CellTypeCanvas() {
  const toolbar = useSelect();
  const cell = useSelector(toolbar, state => state.context.foreground);

  const cellTypes = useCellTypes();
  const cellType = useSelector(cellTypes, state => state.context.cellType);
  const cellTypeLabels = useSelector(
    cellTypes,
    state => state.context.cellTypeLabels
  );

  const labeled = useLabeled();
  const [opacity, selectedOpacity] = useSelector(labeled, state => state.context.opacity);

  const drawHighlight = useCallback(
    label =>
      cell !== 0 && Math.abs(label) === cell
        ? [255, 255, 255, 128]
        : [0, 0, 0, 0],
    [cell]
  );

  const drawOutline = useCallback(
    label =>
      label >= 0
        ? [0, 0, 0, 0]
        : cellTypeLabels[-label] === Number(cellType) && cellType !== null
        ? [255, 255, 255, selectedOpacity * 255]
        : [255, 255, 255, opacity * 255],
    [cellTypeLabels, cellType, opacity, selectedOpacity]
  );

  return (
    <>
      <DrawLabelsCanvas draw={drawHighlight} />
      <DrawLabelsCanvas draw={drawOutline} />
    </>
  );
}

export default CellTypeCanvas;
