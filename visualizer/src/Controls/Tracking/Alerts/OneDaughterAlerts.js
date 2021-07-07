import { makeStyles } from '@material-ui/core/styles';
import Alert from '@material-ui/lab/Alert';
import { useSelector } from '@xstate/react';
import React from 'react';
import { useImage, useSelect, useTracking } from '../../../ServiceContext';
import { oneDaughter } from '../trackingUtils';
import AlertGroup from './AlertGroup';

const useStyles = makeStyles(theme => ({
  root: {
    width: '100%',
    // '& > * + *': {
    //   marginTop: theme.spacing(2),
    // },
  },
  headerAlert: {
    boxSizing: 'border-box',
    maxWidth: '300px',
    marginTop: theme.spacing(2),
  },
  alert: {
    position: 'relative',
    boxSizing: 'border-box',
    maxWidth: '280px',
    left: '20px',
  },
}));

function OneDaughterAlert({ label }) {
  const tracking = useTracking();
  const division = useSelector(tracking, state => state.context.labels[label]);
  const { daughters, divisionFrame } = division;

  const image = useImage();
  const select = useSelect();

  const onClick = () => {
    select.send({ type: 'SET_FOREGROUND', foreground: daughters[0] });
    image.send({ type: 'LOAD_FRAME', frame: divisionFrame });
  };

  const styles = useStyles();

  return (
    <Alert className={styles.alert} severity='warning' onClick={onClick}>
      Cell {label} has only daughter {daughters[0]}
    </Alert>
  );
}

function OneDaughterAlerts() {
  const tracking = useTracking();
  const divisions = useSelector(tracking, state => state.context.labels);

  const oneDaughterAlerts = Object.values(divisions)
    .filter(division => oneDaughter(division))
    .map(division => division.label);

  const header = `${oneDaughterAlerts.length} divisions with one daughter`;
  return (
    oneDaughterAlerts.length > 0 && (
      <AlertGroup header={header} severity={'warning'}>
        {oneDaughterAlerts.map(label => (
          <OneDaughterAlert label={label} />
        ))}
      </AlertGroup>
    )
  );
}

export default OneDaughterAlerts;
