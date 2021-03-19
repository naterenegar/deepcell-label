import { Machine, assign, sendParent, spawn, forwardTo } from 'xstate';
import { send } from 'xstate/lib/actionTypes';


// tool states

const brushMachine = Machine(
  {
    initial: 'idle',
    context: {
      brushSize: 5,
      trace: [],
      x: 0,
      y: 0,
    },
    states: {
      idle: {
        on: {
          mousedown: [
            { cond: 'shift' },
            { target: 'dragging', actions: 'addToTrace' },
          ],
        }
      },
      dragging: {
        on: {
          UPDATE: { actions: 'addToTrace' },
          mouseup: 'done',
        }
      },
      done: {
        type: 'final',
        entry: 'sendPaint',
        always: 'idle',
      }
    },
    on: {
      UPDATE: { actions: 'updatePoint' },
    }
  },
  {
    actions: {
      'updatePoint': assign({ x: (context, event) => event.x, y: (context, event) => event.y }),
      'addToTrace': assign({ trace: (context, event) => [...context.trace, (event.x, event.y)] }),
      'sendPaint': sendParent((context) => ({
        type: 'PAINT',
        trace: context.trace,
        size: context.brushSize,
      })),
    }
  }
);

const thresholdMachine = Machine(
  {
    initial: 'idle',
    context: {
      firstPoint: (0, 0),
      x: 0,
      y: 0,
    },
    states: {
      idle: {
        on: {
          mousedown: { target: 'dragging', actions: 'storeClick' },
        }
      },
      dragging: {
        on: {
          mouseup: 'done',
        }
      },
      done: {
        type: 'final',
        entry: 'sendThreshold',
        always: 'idle',
      }
    },
    on: {
      UPDATE: { actions: 'updatePoint' },
    }
  },
  {
    actions: {
      'storePoint': assign({ firstPoint: (context) => (context.x, context.y) }),
      'updatePoint': assign({ x: (context, event) => event.x, y: (context, event) => event.y }),
      'sendThreshold': sendParent((context) => ({
        type: 'THRESHOLD',
        firstPoint: context.firstPoint,
        secondPoint: (context.x, context.y),
      })),
    }
  }
);

// const floodMachine = Machine({
//   initial: 'idle',
//   context: {
//     background: 0,
//   }
//   states: {
//     idle: {
//       on: {
//         click: [
//           { cond: 'onBackground', actions: 'flood' },
//           { actions: 'selectBackground' },
//         ]
//       },
//     ],
//     },
//     done: {
//       type: 'final',
//       always: 'idle',
//     }
//   }
//   on: {
//     click: [
//       { cond: 'shift' },
//       { cond: 'onBackground', actions: 'flood' },
//       { actions: 'selectBackground' },
//     ],
//   }
// },
//   {
  
// });

const trimState = {
  on: {
    click: [
      { cond: 'shift' },
      { cond: 'onNoLabel' },
      { cond: 'onBackground', actions: 'trim' },
      { actions: 'selectBackground' },
    ],
  }
};

const erodeDilateState = {

  on: {
    mousedown: [
      { cond: 'onNoLabel' },
      { cond: 'shift' },
      { cond: 'onBackground', actions: 'erode' },
      { cond: 'onForeground', actions: 'dilate' },
      { actions: 'selectForeground' },
    ],
  },
};

const autofitState = {
  on: {
    mousedown: [
      { cond: 'shift' },
      { cond: 'onNoLabel' },
      { cond: 'onForeground', actions: 'autofit' },
      { actions: 'selectForeground' },
    ],
    TOGGLERGB: 'select',
  }
};

// const watershedMachine = Machine(
//   {
//     initial: 'idle',
//     context: {
//       storedPoint: (0, 0),
//     }
//     states: {
//       idle: {
//         on: {
//           mousedown: [
//             { cond: 'onNoLabel' },
//             { cond: 'shift' },
//             { target: 'clicked', actions: ['selectForeground', 'storeClick'] }
//           ]
//         }
//       },
//       clicked: {
//         on: {
//           click: [
//             { cond: 'shift' },
//             { cond: 'validSecondSeed', target: 'idle', actions: ['watershed', 'newBackground'] },
//           ]
//         }
//       }
//     },
//     on: {
//       TOGGLERGB: 'select',
//     }
//   },
//   {
  
//   }
// );

// OLDER



const toolMachine = Machine(
  {
    id: 'tool',
    context: {
      tool: null,
      tools: {},
      foreground: 1,
      background: 0,
      x: 0,
      y: 0,
      label: 0,
      frame: 0,
      feature: 0,
      channel: 0,
    },
    entry: assign(() => {
      paintActor = spawn(brushMachine, 'brush');
      return {
        tools: {
          paint: paintActor,
          threshold: spawn(thresholdMachine, 'threshold'),
        },
        tool: paintActor,
      }
    }),
    initial: 'select',
    states: {
      select: {}, // clicking selects a label
      // tool: { // clicking advances an action
      //   flood: floodState,
      //   trim: trimState,
      //   erodeDilate: erodeDilateState,
      //   autofit: autofitState,
      //   paint: paintState,
      //   threshold: thresholdState,
      //   watershed: watershedState,
      //   history: { type: 'history.deep' } // allows us to return to the current step of an action when selecting in between
      // }, 
    },
    on: {
      'keydown.b': { actions: 'useBrush' },
      'keydown.t': { actions: assign({ currentTool: (context) => context.tools['threshold'] }) },
      mousedown: { actions: 'forwardToTool' },
      mouseup: { actions: 'forwardToTool' },
      click: { actions: 'forwardToTool' },
      UPDATE: { actions: ['forwardToTool', 'update'] },
      PAINT: { actions: 'paint' },
      THRESHOLD: { actions: 'threshold' },

      // 'keydown.g': '.flood',
      // 'keydown.k': '.trim',
      // 'keydown.q': '.erodeDilate',
      // 'keydown.t': '.threshold',
      // 'keydown.m': '.autofit',
      // 'keydown.w': '.watershed',
    }
  },
  {
    actions: {
      useBrush: assign({ tool: (context) => context.tools['paint'] }),
      useThreshold: assign({ tool: (context) => context.tools['threshold'] }),
      forwardToTool: forwardTo((context) => context.tool),
      update: assign({
        foreground: (_, event) => event.foreground,
        background: (_, event) => event.background,
        x: (_, event) => event.x,
        y: (_, event) => event.y,
        label: (_, event) => event.label,
      }),
      paint: sendParent((context, event) => ({
        type: 'EDIT',
        action: 'handle_draw',
        args: {
          trace: JSON.stringify(event.trace),
          brush_value: context.foreground,
          target_value: context.background,
          brush_size: eveent.size,
          frame: context.frame,
          erase: false,
        },
        tool: 'brush',
      })),
      threshold: sendParent((context, event) => ({
        type: 'EDIT',
        action: 'threshold',
        args: {
          x1: event.firstPoint[0],
          y1: event.firstPoint[1],
          x2: event.secondPoint[0],
          y2: event.secondPoint[1],
          frame: context.frame,
          label: context.foreground,
        },
        tool: 'threshold',
      })),
    }
  }
);

export default toolMachine;