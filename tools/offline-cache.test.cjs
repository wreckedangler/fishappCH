const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../sw.js"),"utf8");
const scope="https://example.org/app/";

function worker(){
  const stores=new Map(),listeners={};
  const url=req=>new URL(req.url||req,scope).href;
  const cache=name=>{
    if(stores.has(name))return stores.get(name);
    const entries=new Map();
    const result={
      keys:async()=>[...entries.keys()].map(url=>new Request(url)),
      match:async req=>entries.get(url(req))?.clone(),
      put:async(req,res)=>entries.set(url(req),res.clone()),
      addAll:async requests=>{for(const r of requests)await result.put(r,new Response("shell"))}
    };
    stores.set(name,result);
    return result;
  };
  const caches={open:async name=>cache(name),keys:async()=>[...stores.keys()],
    delete:async name=>stores.delete(name),match:async(req,opts)=>cache(opts.cacheName).match(req)};
  const state={fetch:async()=>new Response("new")};
  const self={registration:{scope},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(name,cb)=>listeners[name]=cb};
  vm.runInNewContext(source,{self,caches,location:new URL(scope),URL,Response,AbortSignal,
    Request:class extends Request{constructor(req,opts){super(url(req),opts)}},fetch:(...args)=>state.fetch(...args)});
  async function dispatch(type,request){
    const jobs=[];let response;
    listeners[type]({request,waitUntil:job=>jobs.push(job),respondWith:job=>response=job});
    const result=await response;
    await Promise.all(jobs);
    return result;
  }
  return {cache,state,dispatch};
}
test("shell installs independently of optional regions and the beta route works offline",async()=>{
  const w=worker();w.state.fetch=()=>Promise.reject(Error("offline"));
  await w.dispatch("install");
  assert.equal(await (await w.dispatch("fetch",{method:"GET",mode:"navigate",url:scope+"beta/"})).text(),"shell");
  await assert.rejects(()=>w.dispatch("fetch",new Request(scope+"data/fisheries/BE.json")));
});
test("previous regional downloads survive an update and are replaced after recovery",async()=>{
  const w=worker(),req=new Request(scope+"data/fisheries/BE.json");
  await w.cache("fb-app-v81").put(req,new Response("previous"));
  await w.dispatch("install");await w.dispatch("activate");
  w.state.fetch=async()=>new Response("",{status:503});
  assert.equal(await (await w.dispatch("fetch",req)).text(),"previous");
  w.state.fetch=async()=>new Response("current");
  assert.equal(await (await w.dispatch("fetch",req)).text(),"current");
  w.state.fetch=()=>Promise.reject(Error("offline"));
  assert.equal(await (await w.dispatch("fetch",req)).text(),"current");
});

