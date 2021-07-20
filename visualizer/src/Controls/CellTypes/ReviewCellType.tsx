import { makeStyles } from '@material-ui/core';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import React from 'react';

const useStyles = makeStyles({
  buttons: {
    display: 'flex',
    flexDirection: 'row',
  },
});

function ReviewCellType() {
  const styles = useStyles();

  return (
    <>
      <Box className={styles.buttons}>
        <Button variant='contained' color='primary'>
          Confirm Cell Type
        </Button>
        <Button variant='contained' color='secondary'>
          Remove Cell Type
        </Button>
      </Box>
      <Box className={styles.buttons}>
        <Button variant='contained' color='primary'>
          Reassign
        </Button>
        <Button variant='contained' color='secondary'>
          Skip
        </Button>
      </Box>
    </>
  );
}

export default ReviewCellType;
