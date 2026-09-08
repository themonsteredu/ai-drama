import {mkdir,writeFile} from 'node:fs/promises';
import {musicPresets,synthMusic} from '../apps/play-studio/lib/drawing-music.ts';
const out=new URL('../apps/play-studio/public/play-music/',import.meta.url);await mkdir(out,{recursive:true});
for(const preset of musicPresets)await writeFile(new URL(`${preset.id}.wav`,out),Buffer.from(await synthMusic(preset.id).arrayBuffer()));
console.log('Generated six original PCM WAV miniatures. See docs/play-music.md for provenance.');
