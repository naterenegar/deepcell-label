import { assign, Machine } from 'xstate';

const exampleData = {
  cellTypes: {
    0: {
      name: 'unassigned',
      channelNames: null,
      channels: null,
    },
    1: {
      name: 'CD4T',
      channelNames: ['CD45', 'CD3', 'CD4'],
      channels: [16, 13, 15],
    },
    2: {
      name: 'CD8T',
      channelNames: ['CD45', 'CD3', 'CD8'],
      channels: [16, 13, 20],
    },
    3: {
      name: 'B cell',
      channelNames: ['CD45', 'CD20', 'CD21'],
      channels: [16, 9, 12],
    },
    4: {
      name: 'FDC',
      channelNames: ['CD45', 'CD21'],
      channels: [16, 12],
    },
    5: {
      name: 'Endothelial',
      channelNames: ['CD31'],
      channels: [14],
    },
    6: {
      name: 'Fibroblast',
      channelNames: ['SMA'],
      channels: [37],
    },
    7: {
      name: 'Other immune',
      channelNames: ['CD45'],
      channels: [16],
    },
    8: {
      name: 'CD11c+ DC',
      channelNames: ['CD45', 'HLADR', 'CD11c'],
      channels: [16, 4],
    },
    9: {
      name: 'CD209+ DC',
      channelNames: ['CD45', 'HLADR', 'CD11c', 'CD209'],
      channels: [16, 4, 11],
    },
    10: {
      name: 'CD14+ mono/mac',
      channelNames: ['CD45', 'CD14'],
      channels: [16, 6],
    },
    11: {
      name: 'CD68+ mac',
      channelNames: ['CD45', 'CD68'],
      channels: [16, 19],
    },
    12: {
      name: 'Neutrophil',
      channelNames: ['MPO'],
      channels: [33],
    },
    13: {
      name: 'T_reg',
      channelNames: ['CD45', 'CD3', 'Foxp3'],
      channels: [16, 13, 23],
    },
    14: {
      name: 'Tfh',
      channelNames: ['CD45', 'CD3', 'CD4', 'PD1'],
      channels: [16, 13, 15, 36],
    },
    15: {
      name: 'Plasma',
      channelNames: ['CD138'],
      channels: [5],
    },
    16: {
      name: 'CD209+ CD206+ mac',
      channelNames: ['CD45', 'CD68', 'CD163', 'CD209', 'CD206'],
      channels: [16, 19, 8, 11, 10],
    },
  },
};

function fetchCellTypes(context) {
  return Promise.resolve(exampleData);
}

const createCellTypesMachine = (projectId, feature) =>
  Machine(
    {
      id: `cell_types_${feature}`,
      context: {
        projectId,
        feature,
        cellTypes: {},
      },
      initial: 'loading',
      states: {
        loading: {
          invoke: {
            src: fetchCellTypes,
            onDone: {
              target: 'idle',
              actions: 'saveCellTypes',
            },
          },
        },
        idle: {},
      },
    },
    {
      guards: {},
      actions: {
        saveCellTypes: assign({ cellTypes: (_, { data }) => data.cellTypes }),
      },
    }
  );

export default createCellTypesMachine;
