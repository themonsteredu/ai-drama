import {after} from 'next/server';
import {sameOrigin,readBody,failure} from '../../../lib/play-ai-server';
import {classAction} from '../../../lib/play-class-server';
export const runtime='nodejs';
export const maxDuration=120;
export async function POST(request:Request){try{sameOrigin(request);return await classAction(request,await readBody(request),after);}catch(error){return failure(error);}}
