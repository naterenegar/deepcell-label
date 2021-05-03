import React, { createContext, useContext } from 'react';
import { useInterpret, useSelector } from '@xstate/react';
import { useLocation } from "react-router-dom";
import createDeepcellLabelMachine from './statechart/deepcellLabelMachine';
import Hotkeys from './Hotkeys';
import { inspect } from '@xstate/inspect';


export const LabelContext = createContext();

export const useLabelService = () => {
  return {
    service: useReturnContext(LabelContext),
  };
};

function useReturnContext(contextType) {
    const context = useContext(contextType);
    if (context === undefined) {
        throw new Error(`${contextType} must be used within its appropriate parent provider`);
    }
    return context;
}

export function useUndo() {
  const { service } = useLabelService();
  const { undo } = service.state.children;
  return undo;
}

export function useImage() {
  const { service } = useLabelService();
  const { image } = service.state.children;
  return image;
}

export function useFeature() {
  const image = useImage();
  const features = useSelector(image, state => state.context.features);
  const feature = useSelector(image, state => state.context.feature);
  return features[feature];
}

export function useChannel() {
  const image = useImage();
  const channels = useSelector(image, state => state.context.channels);
  const channel = useSelector(image, state => state.context.channel);
  return channels[channel];
}

export function useCanvas() {
  const { service } = useLabelService();
  const { canvas } = service.state.children;
  return canvas;
}

export function useTool() {
  const { service } = useLabelService();
  const { tool } = service.state.children;
  return tool;
}

const ServiceContext = (props) => {
  const location = useLocation();
  const projectId = new URLSearchParams(location.search).get('projectId');
  const labelMachine = createDeepcellLabelMachine(projectId);
  const labelService = useInterpret(labelMachine); // , { devTools: true });
  labelService.start();
  window.dcl = labelService;


  return (
    <LabelContext.Provider value={labelService}>
      {props.children}
      <Hotkeys />
    </LabelContext.Provider>
  );
};



export default ServiceContext;