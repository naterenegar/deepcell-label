import { bind, unbind } from 'mousetrap';
import {
  actions,
  assign,
  forwardTo,
  Machine,
  send,
  sendParent,
  spawn,
} from 'xstate';
import createChannelMachine from './channelMachine';
import createColorMachine from './colorMachine';
import createGrayscaleMachine from './grayscaleMachine';

const { pure, respond } = actions;

function fetchChannelNames(context) {
  return Promise.resolve({
    0: 'Au',
    1: 'Background',
    2: 'C',
    3: 'CC3',
    4: 'CD11c',
    5: 'CD138',
    6: 'CD14',
    7: 'CD16',
    8: 'CD163',
    9: 'CD20',
    10: 'CD206',
    11: 'CD209',
    12: 'CD21',
    13: 'CD3',
    14: 'CD31',
    15: 'CD4',
    16: 'CD45',
    17: 'CD45RO',
    18: 'CD57',
    19: 'CD68',
    20: 'CD8',
    21: 'Ca',
    22: 'Fe',
    23: 'Foxp3',
    24: 'GLUT1',
    25: 'GranzymeB',
    26: 'H3K27me3',
    27: 'H3K9Ac',
    28: 'HH3',
    29: 'HLA-DR-DQ-DP',
    30: 'IDO',
    31: 'Ki67',
    32: 'Lag3',
    33: 'MPO',
    34: 'Na',
    35: 'PD-L1',
    36: 'PD1',
    37: 'SMA',
    38: 'Si',
    39: 'TIM3',
    40: 'Ta',
    41: 'Tbet',
    42: 'Tryptase',
    43: 'Vimentin',
    44: 'pS6',
  });
}

const preloadState = {
  entry: 'startPreload',
  on: {
    CHANNEL_LOADED: { actions: 'preload' },
  },
};

const frameState = {
  initial: 'loading',
  states: {
    idle: {},
    loading: {
      on: {
        CHANNEL_LOADED: {
          cond: 'isLoadingFrame',
          actions: 'forwardToColorMode',
        },
        FRAME_LOADED: { target: 'loaded', actions: 'sendLoaded' },
      },
    },
    loaded: {
      on: {
        FRAME: { target: 'idle', actions: ['setFrame', 'forwardToColorMode'] },
        CHANNEL: { target: 'loading' },
      },
    },
  },
  on: {
    LOAD_FRAME: {
      target: '.loading',
      cond: 'diffLoadingFrame',
      actions: ['setLoadingFrame', 'forwardToColorMode'],
    },
  },
};

const channelState = {
  on: {
    CHANNEL: { actions: sendParent((c, e) => e) },
    LOAD_CHANNEL: { actions: 'forwardToColorMode' },
    CHANNEL_LOADED: { actions: 'forwardToColorMode' },
  },
};

const colorState = {
  entry: [sendParent('COLOR'), assign({ colorMode: ({ color }) => color })],
  on: {
    TOGGLE_COLOR_MODE: 'grayscale',
    SET_LAYERS: { actions: 'forwardToColorMode' },
  },
};

const grayscaleState = {
  entry: [
    sendParent('GRAYSCALE'),
    assign({ colorMode: ({ grayscale }) => grayscale }),
  ],
  invoke: [{ src: 'listenForInvertHotkey' }, { src: 'listenForResetHotkey' }],
  on: {
    TOGGLE_COLOR_MODE: 'color',
    RESET: { actions: 'forwardToChannel' },
    SET_LAYERS: { target: 'color', actions: forwardTo(({ color }) => color) },
  },
  initial: 'idle',
  states: {
    idle: {
      invoke: {
        src: 'listenForChannelHotkeys',
      },
      on: {
        // restart channel hotkey
        CHANNEL: { target: 'idle', actions: 'setChannel', internal: false },
      },
    },
  },
};

const colorModeState = {
  invoke: {
    src: 'listenForColorModeHotkey',
  },
  initial: 'color',
  states: {
    grayscale: grayscaleState,
    color: colorState,
  },
};

const restoreState = {
  on: {
    RESTORE: {
      actions: ['restore', respond('RESTORED')],
    },
    SAVE: { actions: 'save' },
  },
};

const createRawMachine = (projectId, numChannels, numFrames) =>
  Machine(
    {
      context: {
        projectId,
        numChannels,
        numFrames,
        channels: [], // all channels that can be used in layers
        channelNames: [], // names of all channels
        frame: 0, // needed?
        loadingFrame: 0, // needed?
        channel: 0,
        colorMode: null,
        color: null,
        grayscale: null,
      },
      entry: ['spawnChannels', 'spawnColorModes'],
      invoke: {
        src: fetchChannelNames,
        onDone: { actions: 'setChannelNames' },
      },
      type: 'parallel',
      states: {
        preload: preloadState,
        frame: frameState,
        channel: channelState,
        colorMode: colorModeState,
        restore: restoreState,
      },
      on: {
        TOGGLE_INVERT: { actions: 'forwardToChannel' },
      },
    },
    {
      services: {
        listenForColorModeHotkey: () => send => {
          bind('y', () => send('TOGGLE_COLOR_MODE'));
          return () => unbind('y');
        },
        listenForChannelHotkeys:
          ({ channel, numChannels }) =>
          send => {
            const prevChannel = (channel - 1 + numChannels) % numChannels;
            const nextChannel = (channel + 1) % numChannels;
            bind('shift+c', () =>
              send({ type: 'LOAD_CHANNEL', channel: prevChannel })
            );
            bind('c', () =>
              send({ type: 'LOAD_CHANNEL', channel: nextChannel })
            );
            return () => {
              unbind('shift+c');
              unbind('c');
            };
          },
        listenForInvertHotkey: () => send => {
          bind('i', () => send('TOGGLE_INVERT'));
          return () => unbind('i');
        },
        listenForResetHotkey: () => send => {
          bind('0', () => send('RESET'));
          return () => unbind('0');
        },
      },
      guards: {
        isLoadingFrame: ({ loadingFrame }, { frame }) => loadingFrame === frame,
        diffLoadingFrame: ({ loadingFrame }, { frame }) =>
          loadingFrame !== frame,
      },
      actions: {
        /** Create a channel actor for each channel */
        spawnChannels: assign({
          channels: ({ projectId, numChannels, numFrames }) => {
            return Array(numChannels)
              .fill(0)
              .map((val, index) =>
                spawn(
                  createChannelMachine(projectId, index, numFrames),
                  `channel${index}`
                )
              );
          },
          channelNames: ({ numChannels }) =>
            [...Array(numChannels).keys()].map(i => `channel ${i}`),
        }),
        setChannelNames: assign({
          channelNames: (_, event) => Object.values(event.data),
        }),
        spawnColorModes: assign({
          grayscale: context =>
            spawn(createGrayscaleMachine(context), 'grayscale'),
          color: context => spawn(createColorMachine(context), 'color'),
        }),
        startPreload: pure(({ channels }) =>
          channels.map(channel => send('PRELOAD', { to: channel }))
        ),
        preload: respond('PRELOAD'),
        sendLoaded: sendParent('RAW_LOADED'),
        setLoadingFrame: assign({ loadingFrame: (_, { frame }) => frame }),
        setFrame: assign((_, { frame }) => ({ frame })),
        setChannel: assign((_, { channel }) => ({ channel })),
        forwardToColorMode: forwardTo(({ colorMode }) => colorMode),
        forwardToChannel: forwardTo(
          ({ channel, channels }) => channels[channel]
        ),
        save: respond(({ channel }) => ({ type: 'RESTORE', channel })),
        restore: send((_, { channel }) => ({ type: 'LOAD_CHANNEL', channel })),
      },
    }
  );

export default createRawMachine;
