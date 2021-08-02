import { makeStyles } from '@material-ui/core';
import Box from '@material-ui/core/Box';
import Slider from '@material-ui/core/Slider';
import Tooltip from '@material-ui/core/Tooltip';
import Typography from '@material-ui/core/Typography';
import { useSelector } from '@xstate/react';
import React from 'react';
import { useLabeled } from '../../../ServiceContext';

const useStyles = makeStyles(theme => ({
  opacity: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: '20px',
    paddingTop: theme.spacing(1),
  },
}));

function OpacitySlider() {
  const labeled = useLabeled();
  const opacity = useSelector(labeled, state => state.context.opacity);

  const handleOpacityChange = (event, newValue) =>
    labeled.send({ type: 'SET_OPACITY', opacity: newValue });

  const handleDoubleClick = event =>
    labeled.send({ type: 'SET_OPACITY', opacity: [0.3, 1] });

  const styles = useStyles();

  const tooltipText = (
    <span>
      Lower slider sets opacity for all cell outlines.
      <br />
      Higher slider sets opacity for selected cell type outlines.
    </span>
  );

  return (
    <Tooltip title={tooltipText}>
      <Box className={styles.opacity}>
        <Typography gutterBottom>Opacity</Typography>

        <Slider
          value={opacity}
          valueLabelDisplay='auto'
          min={0}
          max={1}
          track={false}
          step={0.01}
          onChange={handleOpacityChange}
          onDoubleClick={handleDoubleClick}
        />
      </Box>
    </Tooltip>
  );
}

export default OpacitySlider;
