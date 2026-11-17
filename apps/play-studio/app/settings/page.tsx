import type {Metadata} from 'next';
import {GptSettings} from '../../components/gpt-settings';
export const metadata:Metadata={title:'GPT API 설정 | MOAKIT PLAY',robots:{index:false,follow:false}};
export default function Page(){return <GptSettings/>;}
