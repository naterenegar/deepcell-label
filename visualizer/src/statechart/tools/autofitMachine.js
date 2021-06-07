import { Machine, sendParent } from 'xstate';
import { toolServices, toolActions, toolGuards } from './toolUtils';

const createAutofitMachine = ({ label, foreground, background }) => Machine(
  {
    context: {
      label,
      foreground,
      background,
      moveX: 0,
      moveY: 0,
    },
    on: {
      LABEL: { actions: 'setLabel' },
      FOREGROUND: { actions: 'setForeground' },
      BACKGROUND: { actions: 'setBackground' },
    },
    invoke: { 
      src: 'listenForMouseUp',
    },
    initial: 'idle',
    states: {
      idle: {
        on: {
          mousedown: 'pressed',
        }
      },
      pressed: {
        on: {
          mousemove: [
            { cond: 'moved', target: 'dragged'}, 
            { actions: 'updateMove' }
          ],
          mouseup: [
            { target: 'idle', cond: 'shift' },
            { target: 'idle', cond: 'onNoLabel' },
            { target: 'idle', cond: 'onForeground', actions: 'autofit' },
            { target: 'idle', actions: 'selectForeground' },
          ],
        }
      },
      dragged: {
        on: { 
          mouseup: 'idle',
        },
      },
    },
  },
  {
    services: toolServices,
    guards: toolGuards,
    actions: {
      ...toolActions,
      autofit: sendParent(({ label }, event) => ({
        type: 'EDIT',
        action: 'active_contour',
        args: { label: label },
      })),
      selectForeground: sendParent('SELECTFOREGROUND'),
    }
  }
);

export default createAutofitMachine;
