// Students inside a lecture hall are marked on campus (hidden there, counted at the door) as soon as
// they walk in, stay marked while changing seats, and are cleared when they walk out.
import assert from 'node:assert/strict';
import { WorldRoomDO } from '../worker/index';

class Socket{static OPEN=1;readyState=1;messages:any[]=[];handlers:Record<string,Function>={};accept(){}addEventListener(e:string,f:Function){this.handlers[e]=f;}send(s:string){this.messages.push(JSON.parse(s));}close(){this.readyState=3;this.handlers.close?.();}async packet(p:object){await this.handlers.message({data:JSON.stringify(p)});}}

async function main(){
  const oldWS=globalThis.WebSocket,oldInterval=globalThis.setInterval;
  (globalThis as any).WebSocket=Socket;(globalThis as any).setInterval=()=>0;
  try{
    const storage={put:async()=>{},get:async()=>undefined,delete:async()=>{},setAlarm:async()=>{},list:async()=>new Map()};
    const w:any=new WorldRoomDO({storage} as any,{ENABLE_GUEST_MODE:'true'} as any);
    const join=async(n:number)=>{const s=new Socket();await w.handleSession(s,null,'world:funaab:main');await s.packet({type:'join',player:{id:`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,username:`S${n}`,position:[0,0,40]}});return s;};
    const student=await join(1),watcher=await join(2);
    const conn=w.sessions.get(student).connectionId;
    const latest=()=>{for(const m of [...watcher.messages].reverse())if(m.type==='players_batch'&&m.updates?.[conn])return m.updates[conn];return null;};

    await student.packet({type:'lecture_enter',lectureId:'funaab-erm-201',seatNumber:0});
    assert.equal(latest()?.currentLectureId,'funaab-erm-201','campus sees the student is inside the hall while still standing');
    assert.equal(w.lectureRooms.get('funaab-erm-201').activeStudents[conn].seatNumber,0,'standing is seat 0');

    // A classmate in the same hall sees you walk about while standing.
    await watcher.packet({type:'lecture_enter',lectureId:'funaab-erm-201',seatNumber:5});
    watcher.messages.length=0;
    await student.packet({type:'lecture_move',x:1.5,z:99,ry:3,moving:true});
    const moved=watcher.messages.find((m)=>m.type==='lecture_student_moved');
    assert.deepEqual(moved?.pos,[1.5,8,3],'standing spot relayed (and clamped to the room)');
    assert.equal(moved?.moving,true);
    assert.ok(!student.messages.some((m)=>m.type==='lecture_student_moved'),'not echoed to the walker');

    await student.packet({type:'lecture_enter',lectureId:'funaab-erm-201',seatNumber:3});
    assert.equal(w.lectureRooms.get('funaab-erm-201').activeStudents[conn].seatNumber,3,'moved to a seat');
    assert.equal(latest()?.currentLectureId,'funaab-erm-201');

    await student.packet({type:'lecture_leave',lectureId:'funaab-erm-201'});
    assert.equal(latest()?.currentLectureId,null,'walking out clears it (null, so clients drop it)');
    console.log('LECTURE PRESENCE PASSED: inside the hall from the door, walking about is relayed, seat changes keep it, leaving clears it.');
  }finally{globalThis.WebSocket=oldWS;globalThis.setInterval=oldInterval;}
}
main().then(()=>process.exit(0)).catch((e)=>{console.error(e);process.exit(1);});
