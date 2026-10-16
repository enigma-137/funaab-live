import React,{useEffect,useRef,useState} from 'react';
import { X } from 'lucide-react';
import { useGameStore } from '../stores/gameStore';
import { useWalletStore } from '../stores/walletStore';
import { networkManager } from '../game/multiplayer/networkManager';
import { kekeDestinations,KOROPE,KOROPE_ID,PARKED_KEKE_ID,ROUTE_FARE,routeStops } from '../config/kekeRoutes';
import { seatsOf } from '../config/kekeSimulation';
import './transit.css';
export function KekeDestinationModal(){
 const {kekes,nearbyInteractable,setActiveModal,myPosition}=useGameStore();
 const k=kekes[nearbyInteractable?.targetId || PARKED_KEKE_ID];
 const booked=k?.id===PARKED_KEKE_ID&&k.phase==='BOARDING';
 const [selected,setSelected]=useState('library'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[now,setNow]=useState(Date.now());
 const close=useRef<HTMLButtonElement>(null),balance=useWalletStore(s=>s.balance);
 const isKorope=k?.id===KOROPE_ID,isParked=k?.id===PARKED_KEKE_ID;
 // Route vehicles (keke and Korope) only stop at route stops, so only those can be chosen.
 const choices=kekeDestinations.filter(d=>d.id!=='car-park'&&(isParked||routeStops.includes(d.id)));
 const pick=choices.some(d=>d.id===selected)?selected:choices[0]?.id;
 const destination=choices.find(d=>d.id===(booked?k.destinationId:pick));
 const fare=isKorope?KOROPE.fare:isParked?destination?.fare:ROUTE_FARE;
 const seats=k?seatsOf(k):3,openPhases=isKorope?['IDLE','BOARDING','WAITING']:['IDLE','BOARDING'];
 const nearby=k&&Math.hypot(myPosition[0]-k.position[0],myPosition[2]-k.position[2])<=8;
 useEffect(()=>{const previous=document.activeElement as HTMLElement;close.current?.focus();const t=setInterval(()=>setNow(Date.now()),250);const key=(e:KeyboardEvent)=>{if(e.key==='Escape')setActiveModal(null);if(e.key==='Tab'){const nodes=Array.from(document.querySelectorAll<HTMLButtonElement>('.keke-sheet button:not(:disabled)'));const i=nodes.indexOf(document.activeElement as HTMLButtonElement);e.preventDefault();nodes[(i+(e.shiftKey?-1:1)+nodes.length)%nodes.length]?.focus();}};window.addEventListener('keydown',key);return()=>{clearInterval(t);window.removeEventListener('keydown',key);previous?.focus();};},[]);
 // While this sheet is open next to a route vehicle, keep it at its stop; let go when closed.
 useEffect(()=>{
  const id=k?.id;if(!id||id===PARKED_KEKE_ID||!nearby)return;
  networkManager.holdKeke(id,true);const t=setInterval(()=>networkManager.holdKeke(id,true),5000);
  return()=>{clearInterval(t);networkManager.holdKeke(id,false);};
 },[k?.id,!!nearby]);
 const book=async()=>{if(!k||!destination||busy)return;setBusy(true);setError('');try{await networkManager.bookKeke(k.id,destination.id);setActiveModal(null);}catch(e){setError((e as Error).message);}finally{setBusy(false);}};
 return <div className="keke-backdrop"><section className="keke-sheet" role="dialog" aria-modal="true" aria-label={isKorope?'Korope bus':'Campus Keke booking'}>
   <header><div><small>{isKorope?`SHARED BUS · LEAVES WHEN ${KOROPE.minRiders} ARE ABOARD`:isParked?'CAR PARK · DIRECT RIDE':'PUBLIC ROUTE · HOP ON'}</small><h2>{isKorope?'🚐 Korope Bus':'🛺 Campus Keke'}</h2></div><button ref={close} onClick={()=>setActiveModal(null)} aria-label="Close booking"><X size={20}/></button></header>
   <p>{isKorope?`${k.passengers.length}/${KOROPE.minRiders} aboard · ${seats-k.passengers.length} seats left`:booked?`To ${destination?.name} · ${3-k.passengers.length} seats · leaving in ${Math.max(0,Math.ceil((k.deadline-now)/1000))}s`:'Where are you going?'} <span>₦{balance.toLocaleString()}</span></p>
   {isKorope&&k.phase==='WAITING'&&<p role="status">The Korope won't move until {KOROPE.minRiders} riders have paid. If it stays short for {Math.round(KOROPE.waitMs/60000*10)/10} minutes, everyone is refunded.</p>}
   {isKorope&&k.phase==='BOARDING'&&k.currentStopName==='Car Park'&&<p role="status">Full enough. Doors close in {Math.max(0,Math.ceil((k.deadline-now)/1000))}s.</p>}
   {!booked&&<div className="keke-options">{choices.map(d=><button key={d.id} aria-pressed={pick===d.id} onClick={()=>setSelected(d.id)}><span>{d.icon} {d.name}</span><b>₦{isKorope?KOROPE.fare:isParked?d.fare:ROUTE_FARE}</b></button>)}</div>}
   {k&&!isParked&&nearby&&k.phase==='BOARDING'&&<p role="status">It waits here while you choose.</p>}
   {error&&<p role="alert">{error}</p>}
   {!nearby&&<p role="status">Walk closer to the Keke.</p>}
   {k&&!openPhases.includes(k.phase)&&<p role="status">{isKorope?'The Korope is on its way. Catch it at a stop, or wait for it at the Car Park.':'This Keke is on a trip. Wait for it to return.'}</p>}
   <footer><span>{destination?.name} · ₦{fare}</span><button className="keke-confirm" disabled={!nearby||busy||!k||!openPhases.includes(k.phase)||k.passengers.length>=seats||balance<(fare||0)} onClick={book}>{busy?'Booking…':booked?'Join ride':isParked?'Book ride':isKorope?`Pay ₦${KOROPE.fare} & board`:'Hop on'}</button></footer>
 </section></div>;
}
