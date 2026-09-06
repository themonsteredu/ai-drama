import type {Metadata} from 'next';
import {DrawingStudio} from '@/components/drawing-studio';

export const metadata:Metadata={
  title:'내 그림 움직이기 | MOAKIT PLAY',
  description:'직접 그린 JPG·PNG·WebP 그림을 다듬고 움직이는 어린이 창작 도구',
};

export default function DrawingPage(){
  return <DrawingStudio/>;
}
