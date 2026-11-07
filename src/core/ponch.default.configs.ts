export type ActiveLineBoxStyle = 'boxed-split' | 'boxed-full' | 'standard';
export type ActiveLineAnimation = 'none' | 'lateral' | 'elevation';
export type TransparencyMode = 'none' | 'full' | 'blurred' | 'grainy';
export type BackgroundFit = 'cover' | 'contain' | 'auto';

export interface PonchConfig {
  sidebar: {
    fileHoverAnimation: boolean;
    fileClickAnimation: boolean;
    hierarchyLines: {
      enabled: boolean;
      color: string;
      style: 'solid' | 'dashed' | 'neon';
    };
    fileHoverBackground: boolean;
  };
  topBar: {
    searchSlideAnimation: boolean;
    selectionAnimation: boolean;
    loadingAnimation: boolean;
  };
  bottomBar: {
    hoverNotesAnimation: boolean;
    notificationsAnimation: boolean;
  };
  console: {
    slideAnimation: boolean;
    textColor: string;
    fontFamily: string;
    multiTerminalAnimation: boolean;
  };
  editor: {
    cursorColor: string;
    documentSlideAnimation: boolean;
    synthwaveSyntax: boolean;
    activeLine: {
      boxStyle: ActiveLineBoxStyle;
      boxColor: string;
      animation: ActiveLineAnimation;
    };
    hierarchyLines: {
      enabled: boolean;
      color: string;
      style: 'solid' | 'neon' | 'dots';
    };
  };
  transparency: {
    mode: TransparencyMode;
    opacity: number;
    containerBorders: boolean;
  };
  background: {
    enabled: boolean;
    type: 'image' | 'video';
    url: string;
    fit: BackgroundFit;
    opacity: number;
  };
  global: {
    iconLinesColor: string;
    textColor: string;
    iconClickAnimation: boolean;
    iconHoverAnimation: boolean;
    iconHoverBackground: boolean;
    neonBorderColor: string;
    neonGlowEnabled: boolean;
    sidebarSlidePanels: boolean;
  };
}

export const DEFAULT_CONFIG: PonchConfig = {
  sidebar: {
    fileHoverAnimation: true,
    fileClickAnimation: true,
    hierarchyLines: { enabled: true, color: '#ff007f', style: 'neon' },
    fileHoverBackground: true
  },
  topBar: {
    searchSlideAnimation: true,
    selectionAnimation: true,
    loadingAnimation: true
  },
  bottomBar: {
    hoverNotesAnimation: true,
    notificationsAnimation: true
  },
  console: {
    slideAnimation: true,
    textColor: '#00ffff',
    fontFamily: 'Consolas, monospace',
    multiTerminalAnimation: true
  },
  editor: {
    cursorColor: '#00ffff', // <-- Color inicial por defecto
    documentSlideAnimation: true,
    synthwaveSyntax: true,
    activeLine: {
      boxStyle: 'boxed-split',
      boxColor: 'rgba(255, 0, 127, 0.25)',
      animation: 'lateral'
    },
    hierarchyLines: { enabled: true, color: '#bd93f9', style: 'neon' }
  },
  transparency: {
    mode: 'none',
    opacity: 0.85,
    containerBorders: true
  },
  background: {
    enabled: false,
    type: 'image',
    url: '',
    fit: 'cover',
    opacity: 0.3
  },
  global: {
    iconLinesColor: '#00ffff',
    textColor: '#f8f8f2',
    iconClickAnimation: true,
    iconHoverAnimation: true,
    iconHoverBackground: true,
    neonBorderColor: '#ff007f',
    neonGlowEnabled: true,
    sidebarSlidePanels: true
  }
};