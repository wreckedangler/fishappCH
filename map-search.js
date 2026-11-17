/* Search the local fishery data and the official Swiss place-name index independently. */
const FishMapSearch=(()=>{
  const normal=value=>String(value).toLocaleLowerCase("de-CH").normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/ß/g,"ss");
  const cantons=new Set("ag ai ar be bl bs fr ge gl gr ju lu ne nw ow sg sh so sz tg ti ur vd vs zg zh".split(" "));
  const isLUList=query=>/^(?:lu|luzern|luzerner) (?:fischerei)?reviere$/.test(normal(query).trim());
  function rank(rows,query,center){
    const text=normal(query),words=text.split(/[^a-z0-9]+/).filter(Boolean),matches=[],seen=new Set(),directory=isLUList(query);
    if(!words.length)return [];
    for(const [name,rev,kind,lat,lon,code,alias] of rows){
      const title=normal(name),hay=normal([name,alias,rev&&"Revier ID Nr Nummer "+rev,kind,code,code==="LU"?"Luzern":""].join(" ")),id=[name,rev,code,kind].join("|");
      if(seen.has(id))continue;
      if(directory){if(code!=="LU"||kind!=="Fischereirevier")continue}
      else if(!words.every(w=>cantons.has(w)?w===normal(code):/^\d+$/.test(w)?hay.split(/[^a-z0-9]+/).includes(w):hay.includes(w)))continue;
      seen.add(id);
      const distance=(lat-center.lat)**2+((lon-center.lng)*.68)**2;
      const score=title===text?0:title.startsWith(words[0])?1:2;
      matches.push({name,code,rev,kind,sub:[code,rev&&"Revier "+rev,kind].filter(Boolean).join(" · "),lat,lon,zone:true,score,distance});
    }
    if(directory)return matches.sort((a,b)=>Number(a.rev)-Number(b.rev));
    return matches.sort((a,b)=>a.score-b.score||a.distance-b.distance||a.name.localeCompare(b.name)).slice(0,8);
  }
  async function places(query,signal){
    const params=new URLSearchParams({type:"locations",origins:"gg25,gazetteer,kantone",searchText:query,limit:"7",lang:"de",sr:"4326"});
    const response=await fetch("https://api3.geo.admin.ch/rest/services/ech/SearchServer?"+params,{signal});
    if(!response.ok)throw Error("Ortssuche "+response.status);
    const {results}=await response.json();
    return results.map(({attrs:a})=>{
      // The service wraps labels in <b>/<i>. Only display their plain text.
      const name=String(a.label||a.detail||"").replace(/<[^>]*>/g,"").replace(/\s+/g," ").trim();
      return {name,lat:a.lat,lon:a.lon,sub:"swisstopo",zoom:a.origin==="kantone"?10:14};
    }).filter(p=>p.name&&Number.isFinite(p.lat)&&Number.isFinite(p.lon));
  }
  function bind(layer,map,localRows,select,viewIncludesLU,loadLUDistricts){
    const dialog=document.getElementById("mapSearchDialog"),input=document.getElementById("mapQuery");
    const results=document.getElementById("mapResults"),status=document.getElementById("mapSearchStatus"),directory=document.getElementById("mapLUDirectory");
    let serial=0,timer,request;
    function stop(){
      ++serial;clearTimeout(timer);request?.abort();
    }
    function update(){
      stop();
      const query=input.value.trim(),id=serial,browse=isLUList(query);
      results.replaceChildren();
      directory.hidden=browse||!(viewIncludesLU()||/\b(lu|luzern|luzerner)\b/i.test(query));
      if(query.length<2){status.textContent=directory.hidden?"Mindestens zwei Zeichen eingeben.":"";return}
      status.textContent="Suche läuft …";
      timer=setTimeout(async()=>{
        const controller=new AbortController();request=controller;
        const deadline=setTimeout(()=>controller.abort(),6500);
        let zones=[],locations=[],remaining=2;
        const fail=[],shown=new Set();
        function render(){
          if(id!==serial||!dialog.open)return;
          for(const [title,items] of [[browse?"Luzerner Fischereireviere ("+zones.length+")":"Gewässer und Reviere",zones],["Orte und Gewässer · swisstopo",locations]]){
            if(!items.length||shown.has(title))continue;
            const group=document.createElement("section"),h=document.createElement("h3");
            h.textContent=title;group.append(h);
            for(const item of items){
              const b=document.createElement("button");b.type="button";b.textContent=item.name;
              if(item.zone){const sub=document.createElement("small");sub.textContent=item.sub;b.append(sub)}
              b.onclick=()=>{dialog.close();select(item)};group.append(b);
            }
            // Append late results after the visible buttons, preserving touch targets and focus.
            shown.add(title);results.append(group);
          }
          status.textContent=fail.length?fail.join(" "):remaining?(zones.length||locations.length?"Weitere Treffer werden gesucht …":"Suche läuft …"):
            (zones.length||locations.length?"":"Keine Treffer für «"+query+"».");
        }
        const local=async()=>{
          if(browse||/\b(lu|luzern)\b/i.test(query)&&/\d/.test(query)){
            const districts=await loadLUDistricts(true);
            if(!districts)throw Error("Luzerner Revierverzeichnis");
            const rows=Object.entries(districts).map(([rev,d])=>[d.name,rev,"Fischereirevier",d.lat,d.lon,"LU",d.registerName]);
            zones=rank(rows,query,map.getCenter());
            return;
          }
          let rows=localRows();
          zones=rank(rows,query,map.getCenter());
          const index=await layer.manifest();
          const loaded=await Promise.allSettled(Object.entries(index).map(async([code,entry])=>{
            const [rows,districts]=await Promise.all([layer.searchIndex(code,entry),code==="LU"?loadLUDistricts():null]);
            return rows.map(row=>[...row,code,row[2]==="Fischereirevier"?districts?.[row[1]]?.registerName:""]);
          }));
          for(const r of loaded)if(r.status==="fulfilled")rows=rows.concat(r.value);
          zones=rank(rows,query,map.getCenter());
          if(loaded.some(r=>r.status==="rejected"))throw Error("Teilindex");
        };
        const remote=async()=>{
          if(!browse&&!/\brevier\s*\d+|\p{L}\s+\d{1,3}$/iu.test(query))locations=await places(query,controller.signal);
        };
        await Promise.all([local().catch(()=>fail.push("Ein Teil der Reviersuche ist offline.")).finally(()=>{--remaining;render()}),
          remote().catch(()=>fail.push("Die schweizweite Ortssuche ist offline.")).finally(()=>{--remaining;render()})]);
        clearTimeout(deadline);
      },180);
    }
    dialog.addEventListener("close",stop);
    directory.onclick=()=>{input.value="Luzerner Reviere";status.tabIndex=-1;status.focus();update()};
    dialog.addEventListener("click",e=>{
      if(e.target!==dialog)return;
      const r=dialog.getBoundingClientRect();
      if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();
    });
    input.addEventListener("input",update);
    input.addEventListener("keydown",e=>{if(e.key==="Enter"){const first=results.querySelector("button");if(first){e.preventDefault();first.click()}}});
    return ()=>{dialog.showModal();input.focus();input.select();update()};
  }
  return {bind,rank};
})();
