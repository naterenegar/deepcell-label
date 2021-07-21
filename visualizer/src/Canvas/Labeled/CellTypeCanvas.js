import { useSelector } from '@xstate/react';
import { useCallback } from 'react';
import { useCellTypes, useSelect } from '../../ServiceContext';
import DrawLabelsCanvas from './DrawLabelsCanvas';
import LabeledCanvas from './LabeledCanvas';

function CellTypeCanvas() {
  const toolbar = useSelect();
  const selected = useSelector(toolbar, state => state.context.selected);

  const cellTypes = useCellTypes();
  const cellType = useSelector(cellTypes, state => state.context.cellType);
  const cellTypeLabels = useSelector(
    cellTypes,
    state => state.context.cellTypeLabels
  );

  const drawHighlight = useCallback(
    label =>
      Math.abs(label) === selected ? [255, 255, 255, 128] : [0, 0, 0, 0],
    [selected]
  );

  const drawOutline = useCallback(
    label =>
      label < 0 &&
      (cellTypeLabels[-label] === Number(cellType) || cellType === null)
        ? [255, 255, 255, 255]
        : [0, 0, 0, 0],
    [cellTypeLabels, cellType]
  );

  return (
    <>
      <LabeledCanvas />
      <DrawLabelsCanvas draw={drawHighlight} />
      <DrawLabelsCanvas draw={drawOutline} />
    </>
  );
}

export default CellTypeCanvas;
