import { assign, Machine } from 'xstate';

function fetchCellTypes(context) {
  const { projectId, feature } = context;
  const location = `/api/cell-types`;
  return fetch(location).then(response => response.json());
}

function fetchCellTypeLabels(context) {
  const { projectId, feature } = context;
  const location = `/api/cell-type-labels/${projectId}/${feature}`;
  return fetch(location).then(response => response.json());
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
        cellType: null,
      },
      initial: 'loading',
      states: {
        loading: {
          type: 'parallel',
          states: {
            cellTypes: {
              initial: 'loading',
              states: {
                loading: {
                  invoke: {
                    src: fetchCellTypes,
                    onDone: { actions: 'saveCellTypes' },
                  },
                },
                loaded: { type: 'final' },
              },
            },
            cellTypeLabels: {
              initial: 'loading',
              states: {
                loading: {
                  invoke: {
                    src: fetchCellTypeLabels,
                    onDone: { actions: 'saveCellTypeLabels' },
                  },
                },
                loaded: { type: 'final' },
              },
            },
          },
          onDone: 'idle',
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
      },
    }
  );

export default createCellTypesMachine;
