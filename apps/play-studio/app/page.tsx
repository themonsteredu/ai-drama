import Link from 'next/link';
import {PlayStudio} from '@/components/play-studio';
import './drawing-entry.css';
export default function HomePage(){return <><nav className="drawing-entry" aria-label="그림 창작 모드"><span>내가 그린 그림을 움직여 볼까요?</span><Link href="/draw">내 그림 움직이기 →</Link></nav><PlayStudio/></>;}
