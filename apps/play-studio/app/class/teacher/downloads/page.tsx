import type {Metadata} from 'next';
import {Classroom} from '@/components/classroom';

export const metadata: Metadata = {title: '작품 다운로드 | MOAKIT PLAY'};

export default function TeacherDownloadsPage() {
  return <Classroom teacherMode downloadMode/>;
}
