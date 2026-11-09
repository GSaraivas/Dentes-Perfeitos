import { writeFileSync } from 'node:fs';
import { Vector3 } from 'three';

const limit = 1.72;
const count = 56;
const size = count + 1;
const step = 2 * limit / count;
const smoothMin = (a,b,k) => {
  const h = Math.max(k - Math.abs(a-b),0) / k;
  return Math.min(a,b) - h*h*k*.25;
};
function ellipsoid(x,y,z,cx,cy,cz,rx,ry,rz) {
  return (Math.hypot((x-cx)/rx,(y-cy)/ry,(z-cz)/rz)-1)*Math.min(rx,ry,rz);
}
const cusps = [[-.45,.68,.36],[.42,.63,.36],[-.41,.78,-.31],[.40,.73,-.32]];
const roots = [[-.50,-.72,.25,.31,.80,.29],[.43,-.81,.29,.29,.84,.29],[.30,-.64,-.36,.29,.73,.27]];
function surface(crownOnly,x,y,z) {
  let d = ellipsoid(x,y,z,0,.24,0,.96,.72,.76);
  for (const [cx,cy,cz] of cusps) {
    d = smoothMin(d,ellipsoid(x,y,z,cx,cy,cz,.55,.45,.48),.17);
  }
  if (crownOnly) return Math.max(d, -.05-y);
  for (const [cx,cy,cz,rx,ry,rz] of roots) {
    const lean = Math.max(0,-y)*.13;
    d = smoothMin(d,ellipsoid(x,y,z,cx*(1+lean),cy,cz*(1+lean),rx,ry,rz),.25);
  }
  return d;
}

function mesh(crownOnly) {
  const field = (x,y,z) => surface(crownOnly,x,y,z);
  const samples = new Float32Array(size**3);
  const pos = [], normals = [], indices = [];
  const index = (x,y,z) => x + size*(y+size*z);
  const coords = (i) => new Vector3(i % size, Math.floor(i/size) % size, Math.floor(i/(size*size))).multiplyScalar(step).addScalar(-limit);
  for (let i=0;i<samples.length;i++) {
    const {x,y,z}=coords(i);
    samples[i]=field(x,y,z);
  }
  const cache = new Map();
  function vertex(a,b) {
    const key = Math.min(a,b)*samples.length+Math.max(a,b);
    if (cache.has(key)) return cache.get(key);
    const v = coords(a).lerp(coords(b),samples[a]/(samples[a]-samples[b]));
    const {x,y,z}=v, e=.002;
    const normal = new Vector3(field(x+e,y,z)-field(x-e,y,z),field(x,y+e,z)-field(x,y-e,z),field(x,y,z+e)-field(x,y,z-e)).normalize();
    const i=pos.length/3;
    pos.push(x,y+(crownOnly?-.53:.20),z);
    normals.push(...normal.toArray());
    cache.set(key,i);
    return i;
  }
  const a=new Vector3(), b=new Vector3(), c=new Vector3(), n=new Vector3();
  function triangle(i,j,k) {
    a.fromArray(pos,i*3);
    b.fromArray(pos,j*3).sub(a);
    c.fromArray(pos,k*3).sub(a);
    n.fromArray(normals,i*3);
    if (b.cross(c).dot(n)<0) indices.push(i,k,j);
    else indices.push(i,j,k);
  }
  const tetrahedra = [[0,1,3,7],[0,3,2,7],[0,2,6,7],[0,6,4,7],[0,4,5,7],[0,5,1,7]];
  for (let z=0;z<count;z++) for (let y=0;y<count;y++) for (let x=0;x<count;x++) {
    const base=index(x,y,z);
    const cube=[base,base+1,base+size,base+size+1,base+size*size,base+size*size+1,base+size*size+size,base+size*size+size+1];
    const inside=cube.filter((i)=>samples[i]<0).length;
    if (inside===0 || inside===8) continue;
    for (const tetra of tetrahedra) {
      const ids=tetra.map((i)=>cube[i]);
      const lo=ids.filter((i)=>samples[i]<0), hi=ids.filter((i)=>samples[i]>=0);
      if (!lo.length || !hi.length) continue;
      if (lo.length===1) triangle(...hi.map((i)=>vertex(lo[0],i)));
      else if (hi.length===1) triangle(...lo.map((i)=>vertex(hi[0],i)));
      else {
        const [p,q,r,s]=lo.flatMap((i)=>hi.map((j)=>vertex(i,j)));
        triangle(p,q,r);
        triangle(r,q,s);
      }
    }
  }
  return [new Float32Array(pos),new Float32Array(normals),new Uint16Array(indices)];
}

function writeGlb(name, crownOnly) {
  const data=mesh(crownOnly);
  const chunks=data.map((array)=>Buffer.from(array.buffer));
  const pad=(buffer,byte=0)=>Buffer.concat([buffer,Buffer.alloc((4-buffer.length%4)%4,byte)]);
  const bin=pad(Buffer.concat(chunks));
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  data[0].forEach((value,i)=>{ min[i%3]=Math.min(min[i%3],value);max[i%3]=Math.max(max[i%3],value); });
  let offset=0;
  const doc={
    asset:{version:'2.0',generator:'Aura Dental · anatomia conceitual'},
    scene:0, scenes:[{nodes:[0]}], nodes:[{mesh:0}],
    meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1},indices:2}]}],
    buffers:[{byteLength:bin.length}],
    bufferViews:chunks.map((chunk,i)=>{
      const view={buffer:0,byteOffset:offset,byteLength:chunk.length,target:i===2?34963:34962};
      offset+=chunk.length;
      return view;
    }),
    accessors:[
      {bufferView:0,componentType:5126,count:data[0].length/3,type:'VEC3',min,max},
      {bufferView:1,componentType:5126,count:data[1].length/3,type:'VEC3'},
      {bufferView:2,componentType:5123,count:data[2].length,type:'SCALAR'}
    ]
  };
  const json=pad(Buffer.from(JSON.stringify(doc)),32);
  const header=Buffer.alloc(12);
  header.write('glTF');
  header.writeUInt32LE(2,4);
  header.writeUInt32LE(28+json.length+bin.length,8);
  function chunk(buffer, type) {
    const tag=Buffer.alloc(8);
    tag.writeUInt32LE(buffer.length);
    tag.writeUInt32LE(type,4);
    return Buffer.concat([tag,buffer]);
  }
  const glb=Buffer.concat([header,chunk(json,0x4E4F534A),chunk(bin,0x004E4942)]);
  writeFileSync(new URL(`../public/assets/${name}.glb`,import.meta.url),glb);
  console.log(name, data[0].length/3, 'vértices', glb.length, 'bytes');
}
writeGlb('molar',false);
writeGlb('coroa',true);