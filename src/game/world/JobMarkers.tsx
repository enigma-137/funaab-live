import React from 'react';
import { CanvasLabel } from './CanvasLabel';
import { useJobStore } from '../../stores/jobStore';
export function JobMarkers(){
 const job=useJobStore(s=>s.activeJob);if(!job)return null;
 const pos=job.status==='accepted'?job.sourcePos:job.destinationPos;
 return <group position={pos}><mesh rotation={[-Math.PI/2,0,0]} position={[0,.08,0]}><ringGeometry args={[1.1,1.4,24]}/><meshBasicMaterial color="#fbc766" transparent opacity={.8}/></mesh><CanvasLabel position={[0,2.5,0]} outline="#173c2a" lines={[{text:job.status==='accepted'?'PICK UP HERE':'DELIVER / FINISH',size:.4,color:'#fff0a8'}]}/></group>;
}
