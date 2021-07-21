import { makeStyles } from '@material-ui/core';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import { useSelector } from '@xstate/react';
import React from 'react';
import { useCellTypes, useToolbar } from '../../ServiceContext';

const useStyles = makeStyles({
  buttons: {
    display: 'flex',
    flexDirection: 'column',
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
    <Box className={styles.buttons}>
      <Button variant='contained' color='primary'>
        {isSameCellType
          ? `Confirm ${currentCellType.name}`
          : `Switch ${selectedCellType.name} to ${currentCellType.name}`}
      </Button>
      <Button variant='contained' color='secondary'>
        {isSameCellType
          ? `Remove ${currentCellType.name}`
          : `Keep ${selectedCellType.name}`}
      </Button>
    </Box>
  );
}

function ReviewCellType() {
  const toolbar = useToolbar();
  const cell = useSelector(toolbar, (state: any) => state.context.selected);
  const cellTypes = useCellTypes();
  const cellType = useSelector(
    cellTypes,
    (state: any) => state.context.cellType
  );

  return cell && cellType !== null && <ReviewButtons cell={cell} />;
}

export default ReviewCellType;
