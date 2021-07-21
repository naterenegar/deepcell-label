import { makeStyles } from '@material-ui/core';
import Button from '@material-ui/core/Button';
import { useSelector } from '@xstate/react';
import React from 'react';
import { useCellTypes, useSelect } from '../../ServiceContext';

const useStyles = makeStyles({
  buttons: {
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '100%',
  },
  button: {
    display: 'block',
    width: '100%',
  },
});

interface ReviewButtonsProps {
  cell: number;
}

function ReviewButtons({ cell }: ReviewButtonsProps) {
  const styles = useStyles();

  const cellTypes = useCellTypes();
  const currentCellType = useSelector(cellTypes, (state: any) => {
    const { cellType, cellTypes } = state.context;
    return cellTypes[cellType];
  });
  const selectedCellType = useSelector(cellTypes, (state: any) => {
    const { cellTypeLabels, cellTypes } = state.context;
    return cellTypes[cellTypeLabels[cell]];
  });

  const isSameCellType = selectedCellType === currentCellType;

  return (
    <>
      <Button className={styles.button} variant='contained' color='primary'>
        {isSameCellType
          ? `Confirm ${currentCellType.name}`
          : `Switch ${selectedCellType.name} to ${currentCellType.name}`}
      </Button>
      <Button className={styles.button} variant='contained' color='secondary'>
        {isSameCellType
          ? `Remove ${currentCellType.name}`
          : `Keep ${selectedCellType.name}`}
      </Button>
    </>
  );
}

function ReviewCellType() {
  const toolbar = useSelect();
  const cell = useSelector(toolbar, (state: any) => state.context.selected);
  const cellTypes = useCellTypes();
  const cellType = useSelector(
    cellTypes,
    (state: any) => state.context.cellType
  );

  return cell !== 0 && cellType !== null && <ReviewButtons cell={cell} />;
}

export default ReviewCellType;
