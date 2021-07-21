import { makeStyles } from '@material-ui/core';
import ToggleButton, { ToggleButtonProps } from '@material-ui/lab/ToggleButton';
import ToggleButtonGroup from '@material-ui/lab/ToggleButtonGroup';
import { useSelector } from '@xstate/react';
import React from 'react';
import { useCellTypes, useRaw } from '../../ServiceContext';

interface CellType {
  name: string;
  channels: number[] | null;
  channel_names: string[] | null;
}

interface CellTypeButtonProps extends ToggleButtonProps {
  id: string;
  cellType: CellType;
}

const useStyles = makeStyles({
  button: {
    padding: '0.1em',
  },
});

function CellTypeButton(props: CellTypeButtonProps) {
  const { id, cellType, className, ...rest } = props;
  const { name, channels } = cellType;

  const styles = useStyles();

  const raw = useRaw();
  const cellTypes = useCellTypes();
  const selected = useSelector(
    cellTypes,
    (state: any) => state.context.cellType === id
  );

  const onClick = () => {
    cellTypes.send({ type: 'SET_CELL_TYPE', cellType: id });
    if (channels) {
      raw.send({ type: 'SET_LAYERS', channels });
    }
  };

  return (
    <ToggleButton
      {...rest}
      selected={selected}
      onClick={onClick}
      className={`${className} ${styles.button}`}
    >
      {name}
    </ToggleButton>
  );
}

function CellTypes() {
  const cellTypesMachine = useCellTypes();

  const cellTypes = useSelector(
    cellTypesMachine,
    (state: any) => state.context.cellTypes
  );

  return (
    <ToggleButtonGroup orientation='vertical'>
      {Object.entries(cellTypes).map(([id, cellType]: [string, any]) => (
        <CellTypeButton key={id} id={id} cellType={cellType} />
      ))}
    </ToggleButtonGroup>
  );
}

export default CellTypes;
