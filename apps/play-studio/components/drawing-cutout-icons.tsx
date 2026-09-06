import type {ReactNode} from 'react';
import './drawing-cutout-theme.css';
export type CutoutIconName='photo'|'magic'|'eraser'|'restore'|'crop'|'check'|'sparkles'|'close'|'arrow'|'compare'|'zoom'|'undo'|'redo'|'plus'|'heart'|'bulb';
/** Interface icons only; the child's original raster artwork is never replaced. */
export function CutoutIcon({name}:{name:CutoutIconName}){
  const paths:Record<CutoutIconName,ReactNode>={
    photo:<><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 3-3 4 4"/></>,
    magic:<><path d="m4 20 12-12 3 3L7 23zM15 2v3M20 6h3M6 5v4M4 7h4M20 17v4M18 19h4"/></>,
    eraser:<><path d="m3 14 9-10a2 2 0 0 1 3 0l6 6a2 2 0 0 1 0 3l-7 8H8l-5-5a2 2 0 0 1 0-2Z"/><path d="m7 10 10 10M13 21h9"/></>,
    restore:<><circle cx="12" cy="12" r="9"/><path d="M12 7v10M7 12h10"/></>,
    crop:<><path d="M7 2v13a2 2 0 0 0 2 2h13M2 7h13a2 2 0 0 1 2 2v13M17 7l4-4"/></>,
    check:<path d="m4 12 5 5L20 6"/>,
    sparkles:<><path d="m12 2 2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6ZM20 2v4M18 4h4"/></>,
    close:<path d="m6 6 12 12M6 18 18 6"/>,
    arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>,
    compare:<><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M12 2v20M6 14l3-3M15 14l3-3"/></>,
    zoom:<><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M10 7v6M7 10h6"/></>,
    undo:<path d="M4 4v6h6M4 10c3-7 15-6 16 2 1 7-8 11-13 6"/>,
    redo:<path d="M20 4v6h-6M20 10C17 3 5 4 4 12c-1 7 8 11 13 6"/>,
    plus:<path d="M12 4v16M4 12h16"/>,
    heart:<path d="M12 21 3 12C-3 4 8-2 12 6c4-8 15-2 9 6Z"/>,
    bulb:<><path d="M8 18h8M9 22h6M8 15C0 7 7 0 12 2c9-1 12 9 4 13v3H8Z"/></>,
  };
  return <svg className="cutout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
