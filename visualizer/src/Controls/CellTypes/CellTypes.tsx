import Button from '@material-ui/core/Button';
import ButtonGroup from '@material-ui/core/ButtonGroup';
import { useSelector } from '@xstate/react';
import React from 'react';
import { useCellTypes, useRaw } from '../../ServiceContext';

interface CellType {
  name: string;
  channels: number[] | null;
  channel_names: string[] | null;
}

interface CellTypeButtonProps {
  cellType: CellType;
}

function CellTypeButton({ cellType }: CellTypeButtonProps) {
  const { name, channels } = cellType;

  const raw = useRaw();

  const onClick = () => {
    if (channels) {
      raw.send({ type: 'SET_LAYERS', channels });
    }
  };

  return <Button onClick={onClick}>{name}</Button>;
}

function CellTypes() {
  const cellTypesMachine = useCellTypes();

  const cellTypes = useSelector(
    cellTypesMachine,
    (state: any) => state.context.cellTypes
  );

  return (
    <ButtonGroup orientation='vertical'>
      {Object.entries(cellTypes).map(([id, cellType]: any[]) => (
        <CellTypeButton key={id} cellType={cellType} />
      ))}
    </ButtonGroup>
  );
}

export default CellTypes;
