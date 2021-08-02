import { assign, Machine, sendParent } from 'xstate';

const CHANNEL_COLORS = [
  '#FF0000',
  '#00FF00',
  '#0000FF',
  '#00FFFF',
  '#FF00FF',
  '#FFFF00',
];

const createLayerMachine = (layer, channel) =>
  Machine(
    {
      context: {
        layer,
        channel: channel || 0,
        on: true,
        color: CHANNEL_COLORS[layer] || '#FF0000',
      },
      on: {
        CHANGE_CHANNEL: { actions: ['setChannel', 'loadChannel'] },
        SET_COLOR: { actions: 'setColor' },
        TOGGLE_ON: { actions: 'toggleOn' },
      },
    },
    {
      actions: {
        loadChannel: sendParent(({ channel }) => ({
          type: 'LOAD_CHANNEL',
          channel,
        })),
        setChannel: assign({ channel: (_, { channel }) => channel }),
        setColor: assign({ color: (_, { color }) => color }),
        toggleOn: assign({ on: ({ on }) => !on }),
      },
    }
  );

export default createLayerMachine;
