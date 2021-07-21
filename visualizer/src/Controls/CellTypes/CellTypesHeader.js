import {
  Box,
  FormLabel,
  IconButton,
  makeStyles,
  Tooltip,
} from '@material-ui/core';
import ClearIcon from '@material-ui/icons/Clear';
import { useCellTypes } from '../../ServiceContext';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

function CellTypeHeader() {
  const styles = useStyles();

  const cellTypes = useCellTypes();

  const onClick = () =>
    cellTypes.send({ type: 'SET_CELL_TYPE', cellType: null });

  return (
    <Box className={styles.root}>
      <FormLabel>Cell Types</FormLabel>
      <Tooltip title='Unselects Cell Type'>
        <IconButton size='small' onClick={onClick}>
          <ClearIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export default CellTypeHeader;
