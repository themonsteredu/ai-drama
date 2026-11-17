import {SettingsError} from './play-ai-server';

/** Validate normalized image headers before sending them to the image provider. */
export function backgroundImageInput(value:unknown,mask=false){
 const name=mask?'보호 영역':'장면 그림';
 if(typeof value!=='string')throw new SettingsError(`${name} 파일을 확인해 주세요.`);
 if(value.length>(mask?1_900_000:3_800_000))throw new SettingsError(`${name} 전송 용량이 커요. 새로고침 후 다시 생성해 주세요. 그림은 그대로 보관돼요.`);
 const match=/^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+=*)$/.exec(value);
 if(!match||(mask&&match[1]!=='png'))throw new SettingsError(`${name} 형식을 확인해 주세요.`);
 const bytes=Buffer.from(match[2],'base64'),mime=`image/${match[1]}`;
 if(match[1]==='png'){
  if(bytes.length<24||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new SettingsError('PNG 그림을 확인해 주세요.');
  return {bytes,mime,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)};
 }
 if(bytes[0]===255&&bytes[1]===216){
  let offset=2;
  while(offset+4<=bytes.length){
   if(bytes[offset++]!==255)break;
   while(bytes[offset]===255)offset++;
   const marker=bytes[offset++];if(marker===0xda||marker===0xd9)break;
   if(offset+2>bytes.length)break;
   const length=bytes.readUInt16BE(offset);if(length<2||offset+length>bytes.length)break;
   if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=8){
    return {bytes,mime,width:bytes.readUInt16BE(offset+5),height:bytes.readUInt16BE(offset+3)};
   }
   offset+=length;
  }
 }
 throw new SettingsError('JPG 그림을 읽지 못했어요. 장면 그림을 다시 골라 주세요.');
}
