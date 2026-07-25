"use strict";

const method = document.body.dataset.method;
const unit = document.body.dataset.unit || "%";
const projectName = document.body.dataset.project || "检验项目";
const editableFields = [...document.querySelectorAll("[data-field]")];

const examples = {
  moisture: {
    sampleNo1:"1", sampleNo2:"2", container1:"30.1020", container2:"29.8842",
    before1:"32.2621", before2:"32.0487", after1:"32.0115", after2:"31.7979",
    relation:"max", spec:"13.0"
  },
  ash: {
    sampleNo1:"1", sampleNo2:"2", container1:"28.6312", container2:"29.1056",
    before1:"31.1321", before2:"31.6070", after1:"28.8314", after2:"29.3032",
    relation:"max", spec:"10.0"
  },
  sulfur: {
    sampleNo1:"1", sampleNo2:"2", blank:"0.10", factor:"0.3203",
    mass1:"10.012", mass2:"10.008", volume1:"1.55", volume2:"1.50",
    relation:"max", spec:"150"
  }
};

const defaults = method === "sulfur"
  ? {sampleNo1:"1", sampleNo2:"2", relation:"max", blank:"", factor:"", spec:""}
  : {sampleNo1:"1", sampleNo2:"2", relation:"max", spec:""};

function el(id){ return document.getElementById(id); }
function raw(id){ return el(id)?.value?.trim() ?? ""; }
function num(id){ const value=raw(id); return value!=="" && Number.isFinite(Number(value)) ? Number(value) : null; }
function decimalPlaces(value){ const m=String(value??"").trim().match(/^-?\d+(?:\.(\d*))?$/); return m ? (m[1]?.length ?? 0) : null; }

function roundHalfEven(value, places){
  if(!Number.isFinite(value)) return null;
  places=Math.max(0,places|0);
  const scale=10**places;
  const scaled=Math.abs(value)*scale;
  let q=Math.floor(scaled);
  const r=scaled-q;
  const tolerance=Math.max(1e-12,Number.EPSILON*Math.max(1,scaled)*16);
  if(r>.5+tolerance || (Math.abs(r-.5)<=tolerance && q%2===1)) q+=1;
  const rounded=(value<0?-q:q)/scale;
  return rounded.toFixed(places);
}

function setValue(id,value){ const node=el(id); if(node) node.value=value ?? "—"; }
function setText(id,value){ const node=el(id); if(node) node.textContent=value ?? "—"; }
function setStatus(id,state,text){ const node=el(id); if(!node)return; node.className=`status ${state}`; node.textContent=text; }

function markInvalid(){
  document.querySelectorAll("input.entry[data-number]").forEach(node=>{
    const value=node.value.trim();
    node.classList.toggle("invalid",value!=="" && !Number.isFinite(Number(value)));
  });
}

function calculateOne(index){
  if(method==="moisture"){
    const container=num(`container${index}`), before=num(`before${index}`), after=num(`after${index}`);
    if([container,before,after].some(v=>v===null)) return {sample:null,change:null,result:null};
    const sample=before-container, change=before-after;
    const result=sample>0 && change>=0 ? change/sample*100 : null;
    return {sample,change,result};
  }
  if(method==="ash"){
    const container=num(`container${index}`), before=num(`before${index}`), after=num(`after${index}`);
    if([container,before,after].some(v=>v===null)) return {sample:null,change:null,result:null};
    const sample=before-container, change=after-container;
    const result=sample>0 && change>=0 ? change/sample*100 : null;
    return {sample,change,result};
  }
  if(method==="sulfur"){
    const blank=num("blank"), factor=num("factor"), mass=num(`mass${index}`), volume=num(`volume${index}`);
    if([blank,factor,mass,volume].some(v=>v===null)) return {sample:mass,change:null,result:null};
    const change=volume-blank;
    const result=mass>0 && factor>0 && change>=0 ? change*factor*1000/mass : null;
    return {sample:mass,change,result};
  }
  return {sample:null,change:null,result:null};
}

function calculate(){
  markInvalid();
  const specRaw=raw("spec");
  const spec=specRaw!=="" && Number.isFinite(Number(specRaw)) ? Number(specRaw) : null;
  const specDigits=decimalPlaces(specRaw);
  const resultPlaces=specDigits===null ? 2 : specDigits+1;
  const avgPlaces=specDigits===null ? 1 : specDigits;
  const deviationPlaces=specDigits===null ? 1 : Math.max(0,specDigits-1);

  const one=calculateOne(1), two=calculateOne(2);
  const derivedPlaces=method==="sulfur" ? 2 : 4;
  setValue("sampleWeight1",one.sample===null?"—":roundHalfEven(one.sample,derivedPlaces));
  setValue("sampleWeight2",two.sample===null?"—":roundHalfEven(two.sample,derivedPlaces));
  setValue("change1",one.change===null?"—":roundHalfEven(one.change,method==="sulfur"?2:4));
  setValue("change2",two.change===null?"—":roundHalfEven(two.change,method==="sulfur"?2:4));

  const resultText1=one.result===null?"—":roundHalfEven(one.result,resultPlaces);
  const resultText2=two.result===null?"—":roundHalfEven(two.result,resultPlaces);
  setValue("result1",resultText1); setValue("result2",resultText2);
  setText("summary1",resultText1); setText("summary2",resultText2);

  let relativeText="—";
  if(resultText1!=="—" && resultText2!=="—"){
    const x1=Number(resultText1), x2=Number(resultText2), sum=Math.abs(x1+x2);
    if(sum>0) relativeText=roundHalfEven(Math.abs(x1-x2)/sum*100,deviationPlaces);
  }
  setValue("relativeDeviation",relativeText); setText("summaryRd",relativeText);

  let averageText="—", average=null;
  if(one.result!==null && two.result!==null){
    average=(one.result+two.result)/2;
    averageText=roundHalfEven(average,avgPlaces);
  }
  setValue("average",averageText); setText("summaryAvg",averageText);

  const relation=raw("relation") || "max";
  const relationText=relation==="min"?"不得少于":"不得高于";
  const standardText=spec===null ? "请输入标准规定。" : `${projectName}${relationText}${specRaw}${unit}。`;
  setValue("standardText",standardText);

  let pass=null;
  if(average!==null && spec!==null){ pass=relation==="min" ? average>=spec : average<=spec; }
  setStatus("resultStatus",pass===null?"pending":pass?"ok":"bad",pass===null?"待输入":pass?"符合":"不符合");
  setStatus("overallStatus",pass===null?"pending":pass?"ok":"bad",pass===null?"待输入":pass?"符合规定":"不符合规定");
}

function apply(values){
  editableFields.forEach(node=>{
    const key=node.dataset.field;
    node.value=Object.prototype.hasOwnProperty.call(values,key)?values[key]:(defaults[key]??"");
  });
  calculate();
}

function toast(message){
  const node=el("toast"); if(!node)return;
  node.textContent=message; node.classList.add("show");
  clearTimeout(node._timer); node._timer=setTimeout(()=>node.classList.remove("show"),1600);
}

editableFields.forEach(node=>{
  node.addEventListener("input",calculate);
  node.addEventListener("change",calculate);
});

el("exampleBtn")?.addEventListener("click",()=>{apply(examples[method]||defaults);toast("已载入示例数据");});
el("resetBtn")?.addEventListener("click",()=>{if(confirm("确认清空当前页面数据？")){apply(defaults);toast("已清空");}});
el("printBtn")?.addEventListener("click",()=>window.print());
el("copyBtn")?.addEventListener("click",async()=>{
  calculate();
  const text=[`${projectName}结果1：${el("summary1")?.textContent}${unit}`,`${projectName}结果2：${el("summary2")?.textContent}${unit}`,`相对偏差：${el("summaryRd")?.textContent}%`,`平均结果：${el("summaryAvg")?.textContent}${unit}`,`结论：${el("overallStatus")?.textContent}`].join("\n");
  try{await navigator.clipboard.writeText(text);toast("结果已复制");}catch(_){prompt("复制以下结果：",text);}
});

apply(defaults);
