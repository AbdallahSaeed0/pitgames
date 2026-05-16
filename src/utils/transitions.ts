export const DURATIONS = {
  fast: '150ms',
  normal: '300ms',
  slow: '500ms',
};

export const EASINGS = {
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  elastic: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
};

export const TRANSITIONS = {
  standard: (properties: string[] = ['all']) => 
    properties.map(p => `${p} ${DURATIONS.normal} ${EASINGS.easeInOut}`).join(', '),
  
  fast: (properties: string[] = ['all']) => 
    properties.map(p => `${p} ${DURATIONS.fast} ${EASINGS.easeOut}`).join(', '),
  
  slow: (properties: string[] = ['all']) => 
    properties.map(p => `${p} ${DURATIONS.slow} ${EASINGS.easeInOut}`).join(', '),
};
