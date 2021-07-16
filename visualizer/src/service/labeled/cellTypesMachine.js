import { assign, Machine } from 'xstate';
import exampleData from './exampleData';

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
        cellTypeLabels: {},
        instanceLabels: {},
        cellType: null,
      },
      initial: 'loading',
      states: {
        loading: {
          invoke: {
            src: fetchCellTypes,
            onDone: {
              target: 'idle',
              actions: [
                'saveCellTypes',
                'saveCellTypeLabels',
                'saveInstanceLabels',
              ],
            },
          },
        },
        idle: {
          on: {
            SET_CELL_TYPE: { actions: 'setCellType' },
            ASSIGN_CELL_TYPE: { actions: 'assignCellType' },
          },
        },
      },
    },
    {
      guards: {},
      actions: {
        setCellType: assign({
          cellType: (_, { cellType }) => cellType,
        }),
        saveCellTypes: assign({ cellTypes: (_, { data }) => data.cellTypes }),
        saveCellTypeLabels: assign({
          cellTypeLabels: (_, { data }) => data.cellTypeLabels,
        }),
        saveInstanceLabels: assign({
          instanceLabels: (_, { data }) => data.instanceLabels,
        }),
      },
    }
  );

export default createCellTypesMachine;
