/* Official section geometry, shared by the canvas, water labels and tap selection. */
const FishSections = (() => {
  const directory = "./data/sections/";
  const credits = {AG:"© AGIS", ZH:"© GIS-ZH", SG:"© ANJF/AREG SG", GR:"© Kanton GR", LU:"© Geoinformation Kanton Luzern"};
  const intersects = (a,b) => a[0]<=b[2] && a[2]>=b[0] && a[1]<=b[3] && a[3]>=b[1];
  const bbox = b => [b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];
  function subPixel(bounds,zoom){
    const [w,s,e,n]=bounds,pixel=360/(256*2**zoom);
    return zoom<=11&&Math.max(e-w,(n-s)/Math.cos(s*Math.PI/180))<pixel*1.5;
  }
  function shortMark([x,y],zoom){
    const d=360/(256*2**zoom)*.55;
    return [L.latLng(y,x-d),L.latLng(y,x+d)];
  }
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
  function localCondition(kind) {return ["Besondere Vorschrift","Reservatzone","Ruhezone A","Ruhezone B","Keine Patentausgabe"].includes(kind)}
  function restriction(kind) {return localCondition(kind)||/schon|verbot|nationalpark/i.test(kind)}
  function visibleAt(row,zoom) {return row.zoom<=zoom||(!row.meta[5]&&row.meta[1]!=="Gewässer")}
  function symbol(kind,buried=false,closed=false) {
    if(localCondition(kind)||/naturköder/i.test(kind))return "condition";
    if(restriction(kind))return "protected";
    if(closed)return "closed";
    if(buried)return "culvert";
    if(/privat/i.test(kind))return "private";
    if(["Patent","Frei"].includes(kind))return "permit";
    if(["Pacht","Revier","Fischereirevier","Patentgebiet"].includes(kind))return "district";
    if(/bewilligung/i.test(kind))return "condition";
    if(["Fischgewässer","Gewässer"].includes(kind))return "water";
    return "unknown";
  }
  const symbols={
    water:{label:"Gewässer · Berechtigung ungeklärt",color:"#4a89a4"},
    district:{label:"Revier / Pacht- oder Patentgebiet",color:"#e99a35"},
    open:{label:"Fangsaison heute offen · Berechtigung prüfen",color:"#039873"},
    permit:{label:"Patent- / Freiangelgewässer · Tagesstatus ungeklärt",color:"#b98342"},
    private:{label:"Privates Fischereirecht",color:"#7055a5",dash:"7 4"},
    unknown:{label:"Unbekannte Einordnung",color:"#7b8c92",dash:"3 4"},
    culvert:{label:"Eingedolter Abschnitt",color:"#7b8c92",dash:"7 5"},
    condition:{label:"Besondere Vorschrift",color:"#a66bc4"},
    closed:{label:"Heute gesperrt",color:"#d94e54",dash:"4 5"},
    protected:{label:"Schongebiet / Verbot",color:"#c93745"}
  };
  const highlight="#ffd43b";
  function initPanes(map) {
    const levels={zoneCasing:384,zoneInk:392,openEdge:394,openInk:396,chosenEdge:426,chosenInk:428,
      ruleEdge:438,ruleInk:440,chosenRuleEdge:448,chosenRuleInk:450,zonePin:670};
    for(const [name,z] of Object.entries(levels)){
      const pane=map.createPane(name);pane.style.zIndex=z;pane.style.pointerEvents="none";
    }
  }
  function brush(key,zoom,selected=false,area=false) {
    const s=symbols[key],rule=["protected","closed","condition"].includes(key);
    const overview=zoom<9&&!selected;
    const zoneArea=area&&["district","private","condition"].includes(key);
    const width=overview?(key==="open"?2.2:rule?1.4:.85):area&&!selected?(zoneArea?(zoom<12?1.6:2.4):(zoom<12?.85:1.35)):
      (zoom<10?1.5:zoom<12?2:zoom<15?2.8:3.5)+(key==="protected"?.6:0);
    const common={interactive:false,smoothFactor:.5,lineCap:"round",lineJoin:"round",fillRule:"nonzero"};
    return {
      edge:{...common,pane:selected?(rule?"chosenRuleEdge":"chosenEdge"):(rule?"ruleEdge":key==="open"?"openEdge":"zoneCasing"),
        color:selected?highlight:"#fff",weight:width+(selected?5:overview?1:zoneArea?2:area?1:zoom<12?1.5:2.2),opacity:selected?1:overview&&key!=="open"?.22:.73,fill:false},
      ink:{...common,pane:selected?(rule?"chosenRuleInk":"chosenInk"):(rule?"ruleInk":key==="open"?"openInk":"zoneInk"),
        color:s.color,weight:width,opacity:overview&&!rule&&key!=="open"?.64:1,dashArray:overview?null:s.dash||null,
        fillColor:s.color,fillOpacity:rule&&area?.62:selected?.25:zoneArea||key==="open"?.23:.12}
    };
  }
  function shapePair(owner,latlngs,area,key,zoom,selected=false) {
    const options=brush(key,zoom,selected,area),shape=area?L.polygon:L.polyline;
    if(selected)shape(latlngs,{...options.edge,color:"#203038",weight:options.edge.weight+2.4,opacity:.92}).addTo(owner);
    return [shape(latlngs,options.edge).addTo(owner),shape(latlngs,options.ink).addTo(owner)];
  }
  const districtShard=(code,rev)=>rev.slice(0,code==="SG"?-2:-1)||"0";
  function selectionParts(row) {
    const paths=geometry(row);
    return {symbol:symbol(row.meta[1],row.meta[5]),footprints:row.code==="AG",lines:row.poly?[]:[paths[0]],polygons:row.poly?[paths]:[]};
  }
  function drawSelection(owner,parts,zoom) {
    const hasLines=parts.some(p=>p.lines.length);
    for(const part of parts) {
      if(part.polygons.length){
        const ll=part.polygons.map(rings=>leafletPaths(rings,true));
        if(part.footprints&&hasLines){
          // River footprints give width; their survey seams aren't zone borders.
          L.polygon(ll,{...brush(part.symbol,zoom,true).ink,stroke:false}).addTo(owner);
        }else shapePair(owner,ll,true,part.symbol,zoom,true);
      }
      if(part.lines.length)shapePair(owner,leafletPaths(part.lines,false),false,part.symbol,zoom,true);
    }
  }
  function pin(owner,lat,lon) {
    return L.circleMarker([lat,lon],{pane:"zonePin",interactive:false,radius:6.5,
      color:"#17292d",weight:2.5,fillColor:highlight,fillOpacity:1}).addTo(owner);
  }
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
    constructor(map, notify, markFor=row=>symbol(row.meta[1],row.meta[5])) {
      this.map=map;
      this.notify=notify;
      this.markFor=markFor;
      this.cache=new Map();
      this.pending=new Map();
      this.batches=new Map();
      this.labels=[];
      this.visible=new Map();
      this.catalogues=new Map();
      this.selectionFiles=new Map();
      this.selectedParts=new Map();
      this.searchFiles=new Map();
      this.attributions=new Set();
      this.coarseLayers=new Set();
      this.tinted=new WeakMap();
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
      const zoom=this.map.getZoom(),bounds=this.map.getBounds();
      if(!this.busy&&!this.error&&this.drawnZoom===zoom&&this.drawnBounds?.contains(bounds))return;
      const epoch=++this.epoch,buffered=bounds.pad(.24),view=bbox(buffered);
      const stamp=JSON.stringify([zoom,view]);
      if(stamp===this.stamp&&!this.error&&!this.busy)return;
      this.busy=true;this.error=false;
      try {
        const index=await this.manifest();
        if(epoch!==this.epoch)return;
        const files=this.files(index,view,zoom<12);
        const active=new Set(files.map(f=>f[0]));
        if(zoom<10&&typeof Image!=="undefined"){
          try{
            const images=await this.coarseImages(Math.floor(zoom),active);
            if(epoch!==this.epoch)return;
            this.replaceCoarse(images);
            this.visible.clear();this.paint(zoom);this.updateCredits(active);
            this.drawnBounds=buffered;this.drawnZoom=zoom;this.stamp=stamp;
            return;
          }catch(error){console.warn("Kartenübersicht",error)}
        }
        const needed=new Set(files.map(([,file])=>file));
        for(const [file,job] of this.pending)if(!needed.has(file)&&!job.taps)job.controller.abort();
        const rows=new Map();
        let next=0,failed=false;
        const worker=async()=>{
          while(epoch===this.epoch && next<files.length) {
            const file=files[next++];
            try {
              for(const row of await this.load(file)) {
                if(visibleAt(row,zoom) && intersects(row.bounds,view))rows.set(row.key,row);
              }
            } catch(error){if(epoch===this.epoch){failed=true;console.warn("Gewässerdaten",file[1],error)}}
          }
        };
        await Promise.all(Array.from({length:Math.min(files.length,4)},worker));
        if(epoch!==this.epoch)return;
        this.stamp=stamp;this.error=failed;
        this.drawnZoom=zoom;this.drawnBounds=buffered;
        this.visible=rows;
        this.paint(zoom);
        this.replaceCoarse([]);
        this.updateCredits(active);
      } catch(error) {
        if(epoch===this.epoch){this.error=true;console.warn("Gewässerkarte",error)}
      } finally {
        if(epoch===this.epoch){this.busy=false;this.notify()}
      }
    }
    async coarseImages(zoom,active){
      if(!this.atlas)this.atlas=fetch("./data/map-overview.json",{signal:AbortSignal.timeout(9000)})
        .then(r=>{if(!r.ok)throw Error("Übersicht "+r.status);return r.json()}).catch(e=>{this.atlas=null;throw e});
      const atlas=await this.atlas;
      return Promise.all(atlas[zoom].filter(row=>active.has(row[0])).map(async row=>{
        const [code,kind,rule,x,y,width,height,png]=row;
        const mark=this.markFor({code,meta:["",kind,"","","",false,rule]});
        let colors=this.tinted.get(row);
        if(!colors){colors=new Map();this.tinted.set(row,colors)}
        if(!colors.has(mark)){
          const job=(async()=>{
            const source=new Image();source.src="data:image/png;base64,"+png;await source.decode();
            const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
            const ctx=canvas.getContext("2d");ctx.drawImage(source,0,0);ctx.globalCompositeOperation="source-in";
            ctx.fillStyle=symbols[mark].color;ctx.fillRect(0,0,width,height);
            const bounds=[this.map.unproject([x,y+height],zoom),this.map.unproject([x+width,y],zoom)];
            const style=brush(mark,zoom).ink;
            return L.imageOverlay(canvas.toDataURL(),bounds,{pane:style.pane,opacity:style.opacity,interactive:false});
          })().catch(e=>{colors.delete(mark);throw e});
          colors.set(mark,job);
        }
        return colors.get(mark);
      }));
    }
    replaceCoarse(images){
      const next=new Set(images);
      for(const layer of this.coarseLayers)if(!next.has(layer))layer.remove();
      for(const layer of next)if(!this.coarseLayers.has(layer))layer.addTo(this.map);
      this.coarseLayers=next;
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
        const tiny=subPixel(row.bounds,zoom);
        const key=this.markFor(row)+(tiny?"/mark":row.poly?"/area":"/line");
        if(!groups.has(key))groups.set(key,[]);
        groups.get(key).push(row);
      }
      for(const [key,batch] of this.batches)if(!groups.has(key)){batch.layers.forEach(l=>l.remove());this.batches.delete(key)}
      for(const key of groups.keys()) {
        const [mark,type]=key.split("/"),rows=groups.get(key);
        const signature=zoom+"|"+rows.map(r=>r.key).join(",");
        let batch=this.batches.get(key);
        if(batch?.signature===signature)continue;
        const poly=type==="area";
        const latlngs=rows.map(row=>{
          if(type==="mark")return shortMark(geometry(row)[0][0],zoom);
          if(!row.latlngs)row.latlngs=leafletPaths(geometry(row),row.poly);
          return poly?row.latlngs:row.latlngs[0];
        });
        if(batch){
          const {edge,ink}=brush(mark,zoom,false,poly);
          batch.layers[0].setLatLngs(latlngs).setStyle(edge);
          batch.layers[1].setLatLngs(latlngs).setStyle(ink);
        }else {batch={layers:shapePair(this.map,latlngs,poly,mark,zoom)};this.batches.set(key,batch)}
        batch.signature=signature;
      }
      this.drawLabels(zoom);
    }
    drawLabels(zoom) {
      const previous=new Map(this.labels.map(label=>[label.name,label.layer]));
      this.labels=[];
      if(zoom<9){for(const layer of previous.values())layer.remove();return}
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
        const ll=L.latLng(point.lat,point.lon),p=map.latLngToContainerPoint(ll).add([0,-18]);
        const halfWidth=Math.min(112,Math.max(24,name.length*3.8+8));
        if(p.x-halfWidth<8||p.x+halfWidth>size.x-8||p.y<94||p.y>size.y-70)continue;
        const x=mapRect.left+p.x,y=mapRect.top+p.y;
        if(controls.some(r=>x+halfWidth>r.left-4&&x-halfWidth<r.right+4&&y+12>r.top-4&&y-12<r.bottom+4))continue;
        if(this.labels.some(l=>Math.abs(l.p.x-p.x)<halfWidth+l.halfWidth+16&&Math.abs(l.p.y-p.y)<38))continue;
        let layer=previous.get(name);
        if(layer){previous.delete(name);layer.setLatLng(ll)}
        else{
          const title=document.createElement("span");title.textContent=name;
          layer=L.tooltip({className:"water-map-label",direction:"center",offset:[0,-18],permanent:true,interactive:false,opacity:1})
            .setLatLng(ll).setContent(title).addTo(map);
        }
        this.labels.push({name,layer,row,ll,p,halfWidth});used.add(name);
        if(this.labels.length>=Math.min(8,Math.max(3,Math.floor(size.y/100))))break;
      }
      for(const layer of previous.values())layer.remove();
    }
    labelAt(latlng) {
      const p=this.map.latLngToContainerPoint(latlng);
      return this.labels.find(l=>{const pt=this.map.latLngToContainerPoint(l.ll);return Math.abs(pt.x-p.x)<=l.halfWidth&&Math.abs(pt.y-18-p.y)<=11});
    }
    catalogue(code,index) {
      const file=index[code].groups;
      if(!file)return Promise.resolve(new Map());
      if(!this.catalogues.has(file))this.catalogues.set(file,fetchJSON(file).then(entries=>{
        const groups=new Map();
        for(const [members,shard] of entries){
          const group={id:members[0],file:index[code].selections[shard]};
          for(const id of members)groups.set(code+"-"+id,group);
        }
        return groups;
      }).catch(e=>{this.catalogues.delete(file);throw e}));
      return this.catalogues.get(file);
    }
    selectionFile(file) {
      if(!this.selectionFiles.has(file)){
        this.selectionFiles.set(file,fetchJSON(file).catch(e=>{this.selectionFiles.delete(file);throw e}));
        if(this.selectionFiles.size>12)this.selectionFiles.delete(this.selectionFiles.keys().next().value);
      }
      return this.selectionFiles.get(file);
    }
    async district(hit) {
      const index=await this.manifest(),key=districtShard(hit.code,hit.rev),file=index[hit.code]?.districts?.[key];
      if(!file)throw Error("Revierdaten fehlen");
      const data=await this.selectionFile(file);
      return data[hit.rev].map(([kind,buried,lines,polygons])=>({
        symbol:symbol(kind,!!buried),footprints:hit.code==="AG"&&kind==="Fischereirevier",
        lines:lines.map(decode),polygons:polygons.map(rings=>rings.map(decode))
      }));
    }
    async wholeZone(hit) {
      if(!hit.group)return hit.parts;
      if(this.selectedParts.has(hit.zoneId))return this.selectedParts.get(hit.zoneId);
      const {file,id}=hit.group,data=await this.selectionFile(file);
      const parts=data[id].map(([buried,lines,areas])=>({symbol:symbol(hit.kind,!!buried),footprints:hit.code==="AG",
        lines:lines.map(decode),polygons:areas.map(rings=>rings.map(decode))}));
      this.selectedParts.set(hit.zoneId,parts);
      if(this.selectedParts.size>20)this.selectedParts.delete(this.selectedParts.keys().next().value);
      return parts;
    }
    async searchIndex(code,entry) {
      if(!this.searchFiles.has(code))this.searchFiles.set(code,fetchJSON(entry.search).catch(error=>{
        this.searchFiles.delete(code);throw error;
      }));
      return this.searchFiles.get(code);
    }
    async hits(lat,lon,tol) {
      const zoom=this.map.getZoom(),box=tapBox(lat,lon,tol*1.04),index=await this.manifest();
      const found=new Map();
      // Always check the original detail cell, including protection that is too
      // small for an overview symbol. Never infer rights from an empty result.
      const files=this.files(index,box,false);
      const indexes=new Map();
      for(const [code] of files)if(!indexes.has(code)){
        indexes.set(code,this.catalogue(code,index).catch(()=>null));
      }
      await Promise.all(files.map(async file=>{
        for(const row of await this.load(file,true)) {
          if(found.has(row.key)||(!restriction(row.meta[1])&&!visibleAt(row,zoom))||!intersects(box,row.bounds))continue;
          const paths=geometry(row),point=nearest(lat,lon,paths,row.poly);
          if(point.d>tol)continue;
          const [water,kind,rev,region,detail,buried,rule]=row.meta;
          const name=water||(row.code==="SG"?region:"")||(row.poly?"Gewässerfläche ohne amtlichen Namen":"Bach ohne amtlichen Namen");
          const lake=row.code==="LU"?["see","sempach","hallwil","vws","zugersee"].includes(rule):
            row.code==="AG"?/(see|weiher|teich)(?:$|[\s(/-])/i.test(water):row.poly;
          found.set(row.key,{...point,t:"zone",id:row.key,code:row.code,name,water,kind,rev,region,detail,buried,rule,built:index[row.code].built,
            lake,l:paths,area:row.poly,parts:[selectionParts(row)]});
        }
      }));
      for(const hit of found.values()){
        const catalogue=await indexes.get(hit.code);
        hit.group=catalogue?.get(hit.id);
        hit.zoneId=hit.group?hit.code+"/zone/"+hit.group.id:hit.id;
        hit.fullParts=this.selectedParts.get(hit.zoneId);
        hit.hasDistrict=/^\d+$/.test(hit.rev)&&!!index[hit.code].districts?.[districtShard(hit.code,hit.rev)];
        hit.partial=!catalogue;
      }
      return [...found.values()];
    }
  }
  return {Layer,nearest,intersects,tapBox,leafletPaths,decode,subPixel,shortMark,restriction,localCondition,symbol,symbols,highlight,initPanes,shapePair,drawSelection,pin};
})();
