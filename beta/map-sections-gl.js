/* Official section geometry for the MapLibre map: loading, tap search and GeoJSON output. */
const FishSections = (() => {
  const directory = "./data/sections/";
  const credits = {AG:"© AGIS", ZH:"© GIS-ZH", SG:"© ANJF/AREG SG", GR:"© Kanton GR", LU:"© Geoinformation Kanton Luzern"};
  const intersects = (a,b) => a[0]<=b[2] && a[2]>=b[0] && a[1]<=b[3] && a[3]>=b[1];
  const boxOf = b => [b.getWest(),b.getSouth(),b.getEast(),b.getNorth()];
  const pad = (b,f) => {const dx=(b[2]-b[0])*f,dy=(b[3]-b[1])*f;return [b[0]-dx,b[1]-dy,b[2]+dx,b[3]+dy]};
  const contains = (o,i) => o&&o[0]<=i[0]&&o[1]<=i[1]&&o[2]>=i[2]&&o[3]>=i[3];
  function subPixel(bounds,zoom){
    const [w,s,e,n]=bounds,pixel=360/(256*2**zoom);
    return zoom<=11&&Math.max(e-w,(n-s)/Math.cos(s*Math.PI/180))<pixel*1.5;
  }
  function shortMark([x,y],zoom){
    const d=360/(256*2**zoom)*.55;
    return [[x-d,y],[x+d,y]];
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
  const districtShard=(code,rev)=>rev.slice(0,code==="SG"?-2:-1)||"0";
  function selectionParts(row) {
    const paths=geometry(row);
    return {symbol:symbol(row.meta[1],row.meta[5]),footprints:row.code==="AG",lines:row.poly?[]:[paths[0]],polygons:row.poly?[paths]:[]};
  }
  // Ring orientation for GeoJSON: outer counter-clockwise, holes clockwise.
  function orient(rings){
    return rings.map((ring,index)=>{
      let area=0;
      for(let i=1;i<ring.length;i++)area+=ring[i-1][0]*ring[i][1]-ring[i][0]*ring[i-1][1];
      return (area>0)===(index===0)?ring:[...ring].reverse();
    });
  }
  function labelName(row){
    const name=row.meta[0]||(row.code==="SG"&&!/zufl[uü]sse|nebeng[eä]wässer/i.test(row.meta[3])?row.meta[3]:"");
    return !row.meta[5]&&name&&name.length<=34?name:"";
  }
  function feature(row,mark,zoom){
    const tiny=subPixel(row.bounds,zoom),paths=geometry(row);
    let g;
    if(tiny)g={type:"LineString",coordinates:shortMark(paths[0][0],zoom)};
    else if(row.poly)g={type:"Polygon",coordinates:orient(paths)};
    else g={type:"LineString",coordinates:paths[0]};
    return {type:"Feature",geometry:g,properties:{k:mark,a:row.poly&&!tiny?1:0,key:row.key,n:labelName(row),z:row.zoom}};
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
  const unproject=(x,y,z)=>{const s=256*2**z;return [x/s*360-180,Math.atan(Math.sinh(Math.PI*(1-2*y/s)))*180/Math.PI]};
  async function composeOverview(id,zoom,rows,marks){
    const images=await Promise.all(rows.map(async row=>{
      const img=new Image();img.src="data:image/png;base64,"+row[7];await img.decode();return img;
    }));
    const left=Math.min(...rows.map(r=>r[3])),top=Math.min(...rows.map(r=>r[4]));
    const right=Math.max(...rows.map(r=>r[3]+r[5])),bottom=Math.max(...rows.map(r=>r[4]+r[6]));
    const canvas=document.createElement("canvas"),mask=document.createElement("canvas");
    canvas.width=right-left;canvas.height=bottom-top;
    const ctx=canvas.getContext("2d"),ink=mask.getContext("2d");
    rows.forEach((row,i)=>{
      const [,,,x,y,width,height]=row,mark=marks[i];
      mask.width=width;mask.height=height;
      ink.drawImage(images[i],0,0);ink.globalCompositeOperation="source-in";
      ink.fillStyle=symbols[mark].color;ink.fillRect(0,0,width,height);
      ctx.globalAlpha=["protected","closed","condition","open"].includes(mark)?1:.64;
      ctx.drawImage(mask,x-left,y-top);
    });
    const [w,n]=unproject(left,top,zoom),[e,s]=unproject(right,bottom,zoom);
    return [{id,canvas,coordinates:[[w,n],[e,n],[e,s],[w,s]]}];
  }
  class Layer {
    // sink: {features(fc), coarse(list), credits(Set)}
    constructor(map, notify, markFor=row=>symbol(row.meta[1],row.meta[5]), sink={}) {
      this.map=map;
      this.notify=notify;
      this.markFor=markFor;
      this.sink=sink;
      this.cache=new Map();
      this.pending=new Map();
      this.visible=new Map();
      this.catalogues=new Map();
      this.selectionFiles=new Map();
      this.selectedParts=new Map();
      this.searchFiles=new Map();
      this.overviews=new Map();
      this.coarse=[];
      this.epoch=0;
    }
    manifest() {
      if(!this.index)this.index=fetchJSON("index.json").catch(e=>{this.index=null;throw e});
      return this.index;
    }
    async preload(center,zoom){
      try{
        if(!center||zoom<10){await Promise.all([this.manifest(),this.overviewAtlas()]);return}
        const [lon,lat]=center,index=await this.manifest();
        const files=this.files(index,[lon,lat,lon,lat],zoom<12);
        await Promise.all(files.map(file=>this.load(file)));
      }catch{/* The first visible viewport retries any failed request. */}
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
    async sync(force=false) {
      const zoom=this.map.getZoom(),bounds=boxOf(this.map.getBounds()),zkey=Math.round(zoom*4)/4;
      if(!force&&!this.busy&&!this.error&&this.drawnZoom===zkey&&contains(this.drawnBounds,bounds))return;
      const view=pad(bounds,.24);
      const stamp=JSON.stringify([zkey,view]);
      if(!force&&this.busy&&stamp===this.loadingStamp)return this.syncJob;
      if(!force&&stamp===this.stamp&&!this.error&&!this.busy)return;
      const epoch=++this.epoch;
      this.busy=true;this.loadingStamp=stamp;this.error=false;
      this.syncJob=this.loadViewport(zoom,zkey,view,stamp,epoch);
      return this.syncJob;
    }
    async loadViewport(zoom,zkey,view,stamp,epoch){
      try {
        const index=await this.manifest();
        if(epoch!==this.epoch)return;
        const files=this.files(index,view,zoom<12);
        const active=new Set(files.map(f=>f[0]));
        if(zoom<10&&typeof Image!=="undefined"){
          try{
            const images=await this.coarseImages(Math.floor(zoom),active);
            if(epoch!==this.epoch)return;
            this.visible.clear();this.paint(zoom);
            this.coarse=images;this.sink.coarse?.(images);
            this.sink.credits?.(new Set([...active].map(c=>credits[c]).filter(Boolean)));
            this.drawnBounds=view;this.drawnZoom=zkey;this.stamp=stamp;
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
        this.drawnZoom=zkey;this.drawnBounds=view;
        this.visible=rows;
        this.paint(zoom);
        if(this.coarse.length){this.coarse=[];this.sink.coarse?.([])}
        this.sink.credits?.(new Set([...active].map(c=>credits[c]).filter(Boolean)));
      } catch(error) {
        if(epoch===this.epoch){this.error=true;console.warn("Gewässerkarte",error)}
      } finally {
        if(epoch===this.epoch){this.busy=false;this.notify()}
      }
    }
    overviewAtlas(){
      if(!this.atlas)this.atlas=fetch("./data/map-overview.json",{signal:AbortSignal.timeout(9000)})
        .then(r=>{if(!r.ok)throw Error("Übersicht "+r.status);return r.json()}).catch(e=>{this.atlas=null;throw e});
      return this.atlas;
    }
    async coarseImages(zoom,active){
      const atlas=await this.overviewAtlas(),rows=atlas[zoom].filter(row=>active.has(row[0]));
      if(!rows.length)return [];
      const marks=rows.map(([code,kind,rule])=>this.markFor({code,meta:["",kind,"","","",false,rule]}));
      const id=[zoom,...active,...marks].join("_"),old=this.overviews.get(zoom);
      if(old?.id===id)return old.job;
      const job=composeOverview(id,zoom,rows,marks);
      this.overviews.set(zoom,{id,job});
      try{return await job}catch(error){if(this.overviews.get(zoom)?.job===job)this.overviews.delete(zoom);throw error}
    }
    paint(zoom) {
      const features=[];
      for(const row of this.visible.values())features.push(feature(row,this.markFor(row),zoom));
      const signature=Math.round(zoom*2)/2+"|"+features.map(f=>f.properties.key+f.properties.k).join(",");
      if(signature===this.painted)return;
      this.painted=signature;
      this.sink.features?.({type:"FeatureCollection",features});
    }
    repaint(){this.painted="";this.paint(this.map.getZoom())}
    row(key){return this.visible.get(key)}
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
      if(this.selectedParts.has(hit.zoneId))return this.selectedParts.get(hit.zoneId);
      let parts;
      if(hit.wholeDistrict){
        parts=await this.district(hit);
      }else{
        if(!hit.group)return hit.parts;
        const {file,id}=hit.group,data=await this.selectionFile(file);
        parts=data[id].map(([buried,lines,areas])=>({symbol:symbol(hit.kind,!!buried),footprints:hit.code==="AG",
          lines:lines.map(decode),polygons:areas.map(rings=>rings.map(decode))}));
      }
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
        hit.hasDistrict=/^\d+$/.test(hit.rev)&&!!index[hit.code].districts?.[districtShard(hit.code,hit.rev)];
        hit.wholeDistrict=hit.code==="LU"&&hit.kind==="Fischereirevier"&&hit.hasDistrict;
        hit.zoneId=hit.wholeDistrict?"LU/revier/"+hit.rev:hit.group?hit.code+"/zone/"+hit.group.id:hit.id;
        hit.fullParts=this.selectedParts.get(hit.zoneId);
        hit.partial=!catalogue&&!hit.wholeDistrict;
      }
      return [...found.values()];
    }
  }
  return {Layer,nearest,intersects,tapBox,decode,subPixel,shortMark,orient,restriction,localCondition,symbol,symbols,highlight,boxOf,pad,contains};
})();
