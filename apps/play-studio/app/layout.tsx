import type {Metadata} from 'next';
import './globals.css';
import './fonts.css';
import './print.css';

export const metadata:Metadata={
  title:'MOAKIT PLAY | 내 그림 움직이기',
  description:'아이들이 직접 그린 그림을 사진으로 올리고 다듬어 움직이는 창작 스튜디오',
};

export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){
  return <html lang="ko"><body>{children}</body></html>;
}
