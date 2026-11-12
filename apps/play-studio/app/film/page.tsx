import type {Metadata} from 'next';
import {DrawingStudio} from '@/components/drawing-studio';
export const metadata:Metadata={title:'4장면 영상 만들기 | MOAKIT PLAY'};
export default function Page(){return <DrawingStudio key="film-workspace" filmWorkspace/>;}
