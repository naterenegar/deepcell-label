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
  const cellTypeId = useSelector(
    cellTypes,
    (state: any) => state.context.cellType
  );
  const cellType = useSelector(
    cellTypes,
    (state: any) => state.context.cellTypes[cellTypeId]
  );
  const selectedCellType = useSelector(cellTypes, (state: any) => {
    const { cellTypeLabels, cellTypes } = state.context;
    return cellTypes[cellTypeLabels[cell]];
  });

  const isSameCellType = selectedCellType === cellType;

  const assignCellType = () => {
    if (!isSameCellType) {
      cellTypes.send({
        type: 'EDIT_CELL_TYPE_LABEL',
        cell: cell,
        cellType: cellTypeId,
      });
    }
  };

  const removeCellType = () => {
    if (isSameCellType) {
      cellTypes.send({
        type: 'EDIT_CELL_TYPE_LABEL',
        cell: cell,
        cellType: 0,
      });
    }
  };

  return (
    <>
      <Button
        className={styles.button}
        variant='contained'
        color='primary'
        onClick={assignCellType}
      >
        {isSameCellType
          ? `Confirm ${cellType.name}`
          : `Switch ${selectedCellType.name} to ${cellType.name}`}
      </Button>
      <Button
        className={styles.button}
        variant='contained'
        color='secondary'
        onClick={removeCellType}
      >
        {isSameCellType
          ? `Remove ${cellType.name}`
          : `Keep ${selectedCellType.name}`}
      </Button>
    </>
  );
}

function ReviewCellType() {
  const toolbar = useSelect();
  const cell = useSelector(toolbar, (state: any) => state.context.foreground);
  const cellTypes = useCellTypes();
  const cellType = useSelector(
    cellTypes,
    (state: any) => state.context.cellType
  );

  return cell !== 0 && cellType !== null && <ReviewButtons cell={cell} />;
}

export default ReviewCellType;
