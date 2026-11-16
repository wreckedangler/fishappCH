/* Official section geometry, shared by the canvas, water labels and tap selection. */
const FishSections = (() => {
  const directory = "./data/sections/";
  const credits = {AG:"© AGIS", ZH:"© GIS-ZH", SG:"© ANJF/AREG SG", GR:"© Kanton GR"};
  const intersects = (a,b) => a[0]<=b[2] && a[2]>=b[0] && a[1]<=b[3] && a[3]>=b[1];
  const bbox = b => [b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];
  function tapBox(lat,lon,metres) {
    const dy=metres/111000,dx=dy/Math.cos(lat*Math.PI/180);
    return [lon-dx,lat-dy,lon+dx,lat+dy];
  }
  function inRing(x,y,ring) {
    let inside=false;
    for(let i=0,j=ring.length-1;i<ring.length;j=i++) {
      const a=ring[i],b=ring[j];
      if((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    return inside;
  }

  function decode(path) {
    const result=[], position=[0,0];
    let index=0;
    while(index<path.length) {
      for(let axis=0;axis<2;axis++) {
        let value=0,shift=0,chunk;
        do {
          chunk=path.charCodeAt(index++)-63;
          value|=(chunk&31)<<shift;
          shift+=5;
        } while(chunk>=32);
        position[axis]+=(value&1)?~(value>>1):value>>1;
      }
      result.push([position[0]/1e5,position[1]/1e5]);
    }
    return result;
  }
  function geometry(row) {
    if(!row.paths)row.paths=(row.poly?row.raw:[row.raw]).map(decode);
    return row.paths;
  }
  function leafletPaths(rings,polygon) {
    return rings.map((ring,index)=>{
      const result=ring.map(([x,y])=>L.latLng(y,x));
      if(polygon){
        let area=0;
        for(let i=1;i<ring.length;i++)area+=ring[i-1][0]*ring[i][1]-ring[i][0]*ring[i-1][1];
        // Consistent winding preserves holes without erasing overlaps between
        // different polygons in the same batched nonzero canvas fill.
        if((area>0)!==(index===0))result.reverse();
      }
      return result;
    });
  }
  function nearest(lat,lon,paths,polygon=false) {
    if(polygon && inRing(lon,lat,paths[0]) && !paths.slice(1).some(r=>inRing(lon,lat,r)))return {lat,lon,d:0};
    const mx=111320*Math.cos(lat*Math.PI/180),my=111132;
    let best=Infinity,point;
    for(const path of paths)for(let i=1;i<path.length;i++) {
      const a=path[i-1],b=path[i],x=(a[0]-lon)*mx,y=(a[1]-lat)*my;
      const dx=(b[0]-a[0])*mx,dy=(b[1]-a[1])*my,len=dx*dx+dy*dy;
      const t=len?Math.max(0,Math.min(1,-(x*dx+y*dy)/len)):0;
      const d=(x+t*dx)**2+(y+t*dy)**2;
      if(d<best){best=d;point={lat:a[1]+t*(b[1]-a[1]),lon:a[0]+t*(b[0]-a[0])}}
    }
    return {...point,d:Math.sqrt(best)};
  }
  function restriction(kind) {return /schon|verbot|nationalpark/i.test(kind)}
  function style(row) {
    const kind=row.meta[1];
    if(/naturköder/i.test(kind))return "condition";
    if(restriction(kind))return "protected";
    if(/privat/i.test(kind))return "private";
    if(row.meta[5])return "culvert";
    return "district";
  }
  const palette={district:"#eea748",private:"#8c99aa",culvert:"#a2abb5",condition:"#a67ae4",protected:"#dc5151"};
  function unpack(code,data) {
    const [metadata, rows]=data;
    return rows.map(([id,m,zoom,size,bounds,raw])=>({key:code+"-"+id,code,meta:metadata[m],zoom,size,bounds,raw,poly:Array.isArray(raw)}));
  }
  async function fetchJSON(path,signal) {
    const response=await fetch(directory+path,{signal:signal||AbortSignal.timeout(15000),priority:"high"});
    if(!response.ok)throw Error("Kartendaten "+response.status);
    return response.json();
  }
  class Layer {
    constructor(map, notify) {
      this.map=map;
      this.notify=notify;
      this.cache=new Map();
      this.pending=new Map();
      this.batches=new Map();
      this.labels=[];
      this.visible=new Map();
      this.attributions=new Set();
      this.epoch=0;
    }
    manifest() {
      if(!this.index)this.index=fetchJSON("index.json").catch(e=>{this.index=null;throw e});
      return this.index;
    }
    files(index,box,overview) {
      const files=[];
      for(const [code,entries] of Object.entries(index)) {
        const keys=[];
        for(let x=Math.floor(box[0]*5);x<=Math.floor(box[2]*5);x++)
          for(let y=Math.floor(box[1]*8);y<=Math.floor(box[3]*8);y++)
            if(entries[x+"_"+y])keys.push(x+"_"+y);
        if(overview && keys.length)files.push([code,entries.overview]);
        else for(const k of keys)files.push([code,entries[k]]);
      }
      return files;
    }
    async load([code,file],forTap=false) {
      if(this.cache.has(file)) {
        const rows=this.cache.get(file);
        this.cache.delete(file);this.cache.set(file,rows);
        return rows;
      }
      let job=this.pending.get(file);
      if(!job||job.controller.signal.aborted) {
        job={controller:new AbortController(),taps:0};
        const active=job;
        const timeout=setTimeout(()=>active.controller.abort(),16000);
        job.promise=fetchJSON(file,job.controller.signal).then(data=>{
          const rows=unpack(code,data);
          this.cache.set(file,rows);
          if(this.cache.size>48)this.cache.delete(this.cache.keys().next().value);
          return rows;
        }).finally(()=>{
          clearTimeout(timeout);
          if(this.pending.get(file)===active)this.pending.delete(file);
        });
        this.pending.set(file,job);
      }
      if(forTap)job.taps++;
      try{return await job.promise}finally{if(forTap)job.taps--}
    }
    async sync() {
      const epoch=++this.epoch,zoom=this.map.getZoom();
      const view=bbox(this.map.getBounds().pad(.16));
      const stamp=JSON.stringify([zoom,view]);
      if(stamp===this.stamp&&!this.error&&!this.busy)return;
      this.busy=true;this.error=false;
      try {
        const index=await this.manifest();
        if(epoch!==this.epoch)return;
        const files=zoom<8?[]:this.files(index,view,zoom<12);
        const needed=new Set(files.map(([,file])=>file));
        for(const [file,job] of this.pending)if(!needed.has(file)&&!job.taps)job.controller.abort();
        const rows=new Map();
        let next=0,failed=false;
        const worker=async()=>{
          while(epoch===this.epoch && next<files.length) {
            const file=files[next++];
            try {
              for(const row of await this.load(file)) {
                if(row.zoom<=zoom && intersects(row.bounds,view))rows.set(row.key,row);
              }
            } catch(error){if(epoch===this.epoch){failed=true;console.warn("Gewässerdaten",file[1],error)}}
          }
        };
        await Promise.all(Array.from({length:Math.min(files.length,4)},worker));
        if(epoch!==this.epoch)return;
        this.stamp=stamp;this.error=failed;
        this.visible=rows;
        this.paint(zoom);
        this.updateCredits(new Set(files.map(f=>f[0])));
      } catch(error) {
        if(epoch===this.epoch){this.error=true;console.warn("Gewässerkarte",error)}
      } finally {
        if(epoch===this.epoch){this.busy=false;this.notify()}
      }
    }
    updateCredits(active) {
      for(const code of this.attributions)if(!active.has(code))this.map.attributionControl.removeAttribution(credits[code]);
      for(const code of active)if(!this.attributions.has(code))this.map.attributionControl.addAttribution(credits[code]);
      this.attributions=active;
    }
    paint(zoom) {
      // Batch by symbol. Leaflet reprojects a handful of canvas paths on zoom.
      // Keep the old canvas visible until the complete new viewport is ready.
      const groups=new Map();
      for(const row of this.visible.values()) {
        const key=style(row)+(row.poly?"/area":"/line");
        if(!groups.has(key))groups.set(key,[]);
        groups.get(key).push(row);
      }
      for(const [key,layer] of this.batches)if(!groups.has(key)){layer.remove();this.batches.delete(key)}
      for(const symbol of Object.keys(palette))for(const type of ["area","line"]) {
        const key=symbol+"/"+type,rows=groups.get(key);
        if(!rows)continue;
        const signature=zoom+"|"+rows.map(r=>r.key).join(",");
        let layer=this.batches.get(key);
        if(layer?.sectionSignature===signature)continue;
        const poly=type==="area",restricted=symbol==="protected";
        const weight=zoom<10?1.5:zoom<12?2:zoom<15?2.6:3.2;
        const options={interactive:false,smoothFactor:.5,fillRule:"nonzero",color:palette[symbol],weight:weight+(restricted?.6:0),
          opacity:symbol==="culvert"?.72:.96,fillOpacity:restricted?.21:.12,dashArray:symbol==="culvert"||symbol==="private"?"4 5":null};
        const latlngs=rows.map(row=>{
          if(!row.latlngs)row.latlngs=leafletPaths(geometry(row),row.poly);
          return poly?row.latlngs:row.latlngs[0];
        });
        if(layer){layer.setLatLngs(latlngs);layer.setStyle(options)}
        else {layer=(poly?L.polygon:L.polyline)(latlngs,options).addTo(this.map);this.batches.set(key,layer)}
        layer.sectionSignature=signature;
        layer.bringToFront();
      }
      this.drawLabels(zoom);
    }
    drawLabels(zoom) {
      for(const label of this.labels)label.layer.remove();
      this.labels=[];
      if(zoom<9)return;
      const map=this.map,size=map.getSize(),view=bbox(map.getBounds()),center=map.getCenter();
      const used=new Set(), mapRect=map.getContainer().getBoundingClientRect();
      const controls=[...map.getContainer().querySelectorAll(".leaflet-control")].map(el=>el.getBoundingClientRect());
      const candidates=[...this.visible.values()].filter(r=>!r.meta[5]&&intersects(r.bounds,view))
        .sort((a,b)=>a.zoom-b.zoom||b.size-a.size);
      for(const row of candidates) {
        const name=row.meta[0]||(row.code==="SG"&&!/zufl[uü]sse|nebeng[eä]wässer/i.test(row.meta[3])?row.meta[3]:"");
        if(!name||used.has(name)||name.length>34)continue;
        const point=nearest(center.lat,center.lng,geometry(row),row.poly);
        if(!Number.isFinite(point.d))continue;
        const ll=L.latLng(point.lat,point.lon),p=map.latLngToContainerPoint(ll);
        const halfWidth=Math.min(112,Math.max(24,name.length*3.8+8));
        if(p.x-halfWidth<8||p.x+halfWidth>size.x-8||p.y<94||p.y>size.y-70)continue;
        const x=mapRect.left+p.x,y=mapRect.top+p.y;
        if(controls.some(r=>x+halfWidth>r.left-4&&x-halfWidth<r.right+4&&y+12>r.top-4&&y-12<r.bottom+4))continue;
        if(this.labels.some(l=>Math.abs(l.p.x-p.x)<halfWidth+l.halfWidth+16&&Math.abs(l.p.y-p.y)<38))continue;
        const title=document.createElement("span");title.textContent=name;
        const layer=L.tooltip({className:"water-map-label",direction:"center",permanent:true,interactive:false,opacity:1})
          .setLatLng(ll).setContent(title).addTo(map);
        this.labels.push({layer,row,ll,p,halfWidth});used.add(name);
        if(this.labels.length>=Math.min(8,Math.max(3,Math.floor(size.y/100))))break;
      }
    }
    labelAt(latlng) {
      const p=this.map.latLngToContainerPoint(latlng);
      return this.labels.find(l=>{const pt=this.map.latLngToContainerPoint(l.ll);return Math.abs(pt.x-p.x)<=l.halfWidth&&Math.abs(pt.y-p.y)<=11});
    }
    async hits(lat,lon,tol) {
      const zoom=this.map.getZoom(),box=tapBox(lat,lon,tol*1.04),index=await this.manifest();
      if(zoom<8)return [];
      const found=new Map();
      // Always check the original detail cell, including protection that is too
      // small for an overview symbol. Never infer rights from an empty result.
      const files=this.files(index,box,false);
      await Promise.all(files.map(async file=>{
        for(const row of await this.load(file,true)) {
          if(found.has(row.key)||(!restriction(row.meta[1])&&row.zoom>zoom)||!intersects(box,row.bounds))continue;
          const paths=geometry(row),point=nearest(lat,lon,paths,row.poly);
          if(point.d>tol)continue;
          const [water,kind,rev,region,detail,buried,rule]=row.meta;
          const name=water||(row.code==="SG"?region:"")||(row.poly?"Gewässerfläche ohne amtlichen Namen":"Bach ohne amtlichen Namen");
          found.set(row.key,{...point,t:"zone",id:row.key,code:row.code,name,water,kind,rev,region,detail,buried,rule,built:index[row.code].built,
            lake:row.code==="AG"?/(see|weiher|teich)(?:$|[\s(/-])/i.test(water):row.poly,l:paths});
        }
      }));
      return [...found.values()];
    }
  }
  return {Layer,nearest,intersects,tapBox,leafletPaths};
})();
