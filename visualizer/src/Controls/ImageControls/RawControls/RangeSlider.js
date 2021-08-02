import { FormLabel, Slider } from "@material-ui/core";
import { useSelector } from "@xstate/react";
import { useChannel } from "../../../ServiceContext";

import PropTypes from 'prop-types';


function RangeSlider({ channelId, color = 'primary' }) {
  const channel = useChannel(channelId);

  const { send } = channel;
  const range = useSelector(channel, state => state.context.range);

  const onChange = (_, value) => send({ type: 'SET_RANGE', range: value });
  const onDoubleClick = () => send({ type: 'SET_AUTO_RANGE' });

  return (
    <>

      <Slider
        value={range}
        onChange={onChange}
        onDoubleClick={onDoubleClick}
        valueLabelDisplay='off'
        min={0}
        max={255}
        step={1}
        orientation='horizontal'
        style={{
          color: color,
          marginTop: '7px',
        }}
      />
    </>
  );
};

RangeSlider.propTypes = {
  channelId: PropTypes.number.isRequired,
  color: PropTypes.string,
}

export default RangeSlider;