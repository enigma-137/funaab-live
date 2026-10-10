import React,{useEffect,useRef,useState} from 'react';
import { X } from 'lucide-react';
import { useGameStore } from '../stores/gameStore';
import { useWalletStore } from '../stores/walletStore';
import { networkManager } from '../game/multiplayer/networkManager';
import { kekeDestinations,PARKED_KEKE_ID,ROUTE_FARE } from '../config/kekeRoutes';
import './transit.css';
export function KekeDestinationModal(){
 const {kekes,nearbyInteractable,setActiveModal,myPosition}=useGameStore();
 const k=kekes[nearbyInteractable?.targetId || PARKED_KEKE_ID];
 const booked=k?.id===PARKED_KEKE_ID&&k.phase==='BOARDING';
 const [selected,setSelected]=useState('library'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[now,setNow]=useState(Date.now());
 const close=useRef<HTMLButtonElement>(null),balance=useWalletStore(s=>s.balance);
 const choices=kekeDestinations.filter(d=>d.id!=='car-park');
 const destination=choices.find(d=>d.id===(booked?k.destinationId:selected));
 const fare=k?.id===PARKED_KEKE_ID?destination?.fare:ROUTE_FARE;
 const nearby=k&&Math.hypot(myPosition[0]-k.position[0],myPosition[2]-k.position[2])<=8;
 useEffect(()=>{const previous=document.activeElement as HTMLElement;close.current?.focus();const t=setInterval(()=>setNow(Date.now()),250);const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setActiveModal(null);if(e.key==='Tab'){const nodes=Array.from(document.querySelectorAll<HTMLButtonElement>('.keke-sheet button:not(:disabled)'));const i=nodes.indexOf(document.activeElement as HTMLButtonElement);e.preventDefault();nodes[(i+(e.shiftKey?-1:1)+nodes.length)%nodes.length]?.focus();}};window.addEventListener('keydown',key);return()=>{clearInterval(t);window.removeEventListener('keydown',key);previous?.focus();};},[]);
 const book=async()=>{if(!k||!destination||busy)return;setBusy(true);setError('');try{await networkManager.bookKeke(k.id,destination.id);setActiveModal(null);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <div className="keke-backdrop"><section className="keke-sheet" role="dialog" aria-modal="true" aria-label="Campus Keke booking">
   <header><div><small>{k?.id===PARKED_KEKE_ID?'CAR PARK · DIRECT RIDE':'PUBLIC ROUTE · HOP ON'}</small><h2>🛺 Campus Keke</h2></div><button ref={close} onClick={()=>setActiveModal(null)} aria-label="Close booking"><X size={20}/></button></header>
   <p>{booked?`To ${destination?.name} · ${3-k.passengers.length} seats · leaving in ${Math.max(0,Math.ceil((k.deadline-now)/1000))}s`:'Where are you going?'} <span>₦{balance.toLocaleString()}</span></p>
   {!booked&&<div className="keke-options">{choices.map(d=><button key={d.id} aria-pressed={selected===d.id} onClick={()=>setSelected(d.id)}><span>{d.icon} {d.name}</span><b>₦{k?.id===PARKED_KEKE_ID?d.fare:ROUTE_FARE}</b></button>)}</div>}
   {error&&<p role="alert">{error}</p>}
   {!nearby&&<p role="status">Walk closer to the Keke.</p>}
   {k&&!['IDLE','BOARDING'].includes(k.phase)&&<p role="status">This Keke is on a trip. Wait for it to return.</p>}
   <footer><span>{destination?.name} · ₦{fare}</span><button className="keke-confirm" disabled={!nearby||busy||!k||!['IDLE','BOARDING'].includes(k.phase)||k.passengers.length>=3||balance<(fare||0)} onClick={book}>{busy?'Booking…':booked?'Join ride':k?.id===PARKED_KEKE_ID?'Book ride':'Hop on'}</button></footer>
 </section></div>;
}
