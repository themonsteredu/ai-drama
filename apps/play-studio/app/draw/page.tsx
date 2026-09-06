import type {Metadata} from 'next';
import {DrawingStudio} from '@/components/drawing-studio';
export const metadata:Metadata={title:'내 그림 움직이기 | MOAKIT PLAY',description:'직접 그린 사람·동물·식물에 이동과 흔들림, 바람·비·눈을 넣어요.'};
export default function DrawingPage(){return <DrawingStudio/>;}
