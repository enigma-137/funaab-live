import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { campusMaterials, type V3 } from './campusVisualGeometry';
const boardGeometry=new THREE.BoxGeometry(1,1,1);
const faceGeometry=new THREE.PlaneGeometry(1,1);

// System-font canvas lettering is local and bounded: no web-font fetch can suspend the world.
export function CampusSign({position=[0,0,0],width,height,title,subtitle='',tone='green'}:{position?:V3;width:number;height:number;title:string;subtitle?:string;tone?:'green'|'cream'}){
  const material=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
    const c=canvas.getContext('2d')!;c.fillStyle=tone==='green'?'#155642':'#ece4c7';c.fillRect(0,0,1024,256);
    c.strokeStyle='#c6b06d';c.lineWidth=5;c.strokeRect(13,13,998,230);c.textAlign='center';c.textBaseline='middle';
    c.fillStyle=tone==='green'?'#faf4de':'#244d3c';
    const fit=(text:string,start:number,y:number)=>{let size=start;c.font=`600 ${size}px Arial`;while(c.measureText(text).width>930&&size>12)c.font=`600 ${--size}px Arial`;c.fillText(text,512,y);};
    fit(title,subtitle?70:86,subtitle?100:128);if(subtitle)fit(subtitle,36,179);
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=2;
    return new THREE.MeshBasicMaterial({map:texture,toneMapped:false});
  },[title,subtitle,tone]);
  useEffect(()=>()=>{material.map?.dispose();material.dispose();},[material]);
  return <group position={position} dispose={null}>
    <mesh geometry={boardGeometry} material={campusMaterials.green} scale={[width,height,.15]}/>
    <mesh geometry={faceGeometry} material={material} position={[0,0,.081]} scale={[width,height,1]}/>
  </group>;
}
