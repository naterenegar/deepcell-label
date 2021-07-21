import { assign, Machine, sendParent } from 'xstate';

function fetchCellTypes(context) {
  const { projectId } = context;
  const location = `/api/cell-types/${projectId}`;
  return fetch(location).then(response => response.json());
}

function fetchCellTypeLabels(context) {
  const { projectId, feature } = context;
  const location = `/api/cell-type-labels/${projectId}/${feature}`;
  return fetch(location).then(response => response.json());
}

const createCellTypesMachine = ({ projectId, feature = 0 }) =>
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
                    onDone: { target: 'loaded', actions: 'saveCellTypes' },
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
                    onDone: { target: 'loaded', actions: 'saveCellTypeLabels' },
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
            EDIT_CELL_TYPE_LABEL: { actions: 'editCellTypeLabel' },
            EDITED: 'reloading',
          },
        },
        reloading: {
          entry: () => console.log('hello'),
          invoke: {
            src: fetchCellTypeLabels,
            onDone: { target: 'idle', actions: 'saveCellTypeLabels' },
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
        saveCellTypes: assign({ cellTypes: (_, { data }) => data }),
        saveCellTypeLabels: assign({
          cellTypeLabels: (_, { data }) => data,
        }),
        editCellTypeLabel: sendParent((_, { cell, cellType }) => ({
          type: 'EDIT',
          action: 'set_cell_type',
          args: {
            cell: cell,
            cell_type: cellType,
          },
        })),
      },
    }
  );

export default createCellTypesMachine;
