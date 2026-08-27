(() => {
  'use strict';
  const KEY='krstSearchStateV1';
  const clean=v=>String(v??'').trim();
  function read(){
    let saved={}; try{saved=JSON.parse(sessionStorage.getItem(KEY)||'{}')}catch{}
    const p=new URLSearchParams(location.search);
    const out={...saved};
    if(p.has('search')||p.has('q'))out.query=clean(p.get('search')||p.get('q'));
    for(const k of ['institution','topic','year','within','source','access']) if(p.has(k))out[k]=clean(p.get(k));
    if(p.has('related'))out.includeExternal=p.get('related')==='1';
    return out;
  }
  function save(obj){try{sessionStorage.setItem(KEY,JSON.stringify({...read(),...obj,updatedAt:Date.now()}))}catch{}}
  function params(obj={}){const v={...read(),...obj},p=new URLSearchParams();if(v.query)p.set('search',v.query);if(v.includeExternal)p.set('related','1');for(const k of ['institution','topic','year','within','source','access'])if(v[k]&&v[k]!=='all')p.set(k,v[k]);return p;}
  function link(page,obj={}){const p=params(obj);return `${page}${p.toString()?`?${p}`:''}`;}
  window.KRSTState={read,save,params,link};
})();
