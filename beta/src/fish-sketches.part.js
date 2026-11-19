/* Eigene, schematische SVG-Zeichnungen. Keine Bilder oder Schriften nachladen.
   Schnurkreuzungen sind mit einem kleinen Abstand zwischen Vorder-/Hinterstrang gezeichnet. */
function sketchPath(d,style="sk-line"){return '<path class="'+style+'" d="'+d+'"/>';}
function sketchOver(d,style="sk-end"){return sketchPath(d,"sk-gap")+sketchPath(d,style);}
function sketchText(x,y,label,style="sk-label"){return '<text class="'+style+'" x="'+x+'" y="'+y+'">'+esc(label)+'</text>';}
function sketchCircle(x,y,r,style="sk-metal"){return '<circle class="'+style+'" cx="'+x+'" cy="'+y+'" r="'+r+'"/>';}
function sketchSVG(title,description,height,body){
  return '<svg class="rig-svg" viewBox="0 0 260 '+height+'" role="img" aria-label="'+esc(title+". "+description)+'" xmlns="http://www.w3.org/2000/svg"><title>'+esc(title)+'</title>'+body+'</svg>';
}
function sketchLabel(y,label,sub="",x=104){
  return sketchPath('M78 '+(y-5)+' H'+(x-9),"sk-guide")+sketchText(x,y,label)+(sub?sketchText(x,y+18,sub,"sk-sub"):"");
}
function sketchHook(x,y,scale=1){
  return '<g transform="translate('+x+' '+y+') scale('+scale+')">'+sketchCircle(0,0,3)+sketchPath("M0 3 V24 C0 45 26 45 26 25 V17","sk-metal")+'</g>';
}
function sketchSwivel(x,y){
  return '<g transform="translate('+x+' '+y+')">'+sketchCircle(0,-9,4)+sketchCircle(0,9,4)+'<rect class="sk-metal" x="-4" y="-5" width="8" height="10" rx="3"/></g>';
}
function sketchSnap(x,y){
  return '<g transform="translate('+x+' '+y+')">'+sketchPath("M0 -10 C-12 -10 -11 10 0 13 C11 10 12 -10 0 -10 M0 -10 L5 8","sk-metal")+'</g>';
}
function sketchWeight(x,y){
  return '<g transform="translate('+x+' '+y+')">'+sketchCircle(0,-13,3)+sketchPath("M-2 -10 C-4 -7 -15 6 -12 14 Q0 23 12 14 C15 6 4 -7 2 -10 Z","sk-weight")+'</g>';
}
function sketchFloat(x,y){
  return '<g transform="translate('+x+' '+y+')">'+sketchPath("M0 -33 V35","sk-metal")+'<ellipse class="sk-bait" cx="0" cy="0" rx="10" ry="22"/>'+sketchPath("M0 -33 V-24","sk-end")+'</g>';
}
function sketchNymph(x,y){
  return '<g transform="translate('+x+' '+y+')">'+sketchHook(0,0,.7)+sketchCircle(0,7,4,"sk-bait")+sketchPath("M-3 12 H3 M-3 16 H3 M-3 20 H3","sk-end")+'</g>';
}
function sketchSoftBait(x,y){
  return '<g transform="translate('+x+' '+y+')">'+sketchPath("M0 0 C5 -7 24 -6 31 0 L39 -6 L39 6 L31 1 C21 9 7 8 0 0 Z","sk-bait")+sketchCircle(7,-1,1,"sk-eye")+'</g>';
}
function sketchJig(x,y){
  return '<g transform="translate('+x+' '+y+')">'+sketchSoftBait(6,3)+sketchPath("M0 2 H27 C45 2 44 -22 29 -22 L23 -19","sk-metal")+sketchCircle(0,0,8,"sk-weight")+sketchCircle(0,-11,3)+'</g>';
}
function sketchBaitHook(x,y,bait){
  const corn=/Mais/.test(bait),maggot=/Maden/.test(bait);
  return sketchHook(x,y)+ '<g transform="translate('+x+' '+y+')">'+(corn?
    '<ellipse class="sk-bait" cx="5" cy="29" rx="6" ry="5"/><ellipse class="sk-bait" cx="14" cy="34" rx="6" ry="5"/>':
    maggot?sketchPath("M1 21 Q-6 24 0 31 M3 22 Q10 27 6 32","sk-end"):
    sketchPath("M2 10 C-9 13 9 19 1 24 C-7 28 3 34 9 29","sk-end"))+'</g>';
}
function rigSketch(rig,assessment,build){
  let draw="",height=326;
  const line=sketchPath("M58 12 V248"),name=rig.type;
  if(name==="bottom"){
    draw=line+sketchLabel(31,"Hauptschnur")+
      '<ellipse class="sk-weight" cx="58" cy="78" rx="13" ry="20"/>'+sketchPath("M58 56 V100")+
      sketchPath("M32 61 V95 M28 66 L32 61 L36 66 M28 90 L32 95 L36 90","sk-arrow")+
      sketchLabel(75,"Laufgewicht","gleitet auf der Schnur")+sketchCircle(58,123,5,"sk-bait")+sketchLabel(128,"Perle")+
      sketchSwivel(58,157)+sketchLabel(162,"Wirbel")+sketchLabel(211,"Vorfach")+
      sketchBaitHook(58,251,assessment.bait)+sketchLabel(277,"Einzelhaken","mit Köder");
  }else if(name==="float"){
    draw=line+sketchLabel(31,"Schnur")+sketchFloat(58,83)+sketchLabel(86,"Feststellzapfen")+
      sketchPath("M52 54 H64 M52 110 H64","sk-metal")+
      [146,166,187].map(y=>sketchCircle(58,y,4,"sk-weight")).join("")+sketchLabel(165,"Klemmgewichte")+
      sketchLabel(220,"ca. 20 cm","bis zum Haken")+sketchBaitHook(58,251,assessment.bait)+sketchLabel(277,"Einzelhaken","mit Köder");
  }else if(name==="drop"||name==="nymph"){
    const nymph=name==="nymph",hy=nymph?174:130,wy=282;
    draw=sketchPath('M58 12 V'+(wy-15))+sketchLabel(31,"Schnur");
    if(nymph)draw+=sketchPath("M54 48 H62","sk-metal")+sketchCircle(58,58,4,"sk-bait")+sketchLabel(53,"Stopper + Perle")+
      sketchFloat(58,102)+sketchLabel(107,"Laufzapfen");
    if(nymph)draw+=sketchNymph(58,hy)+sketchLabel(hy+6,"Nymphe");
    else draw+=sketchHook(58,hy,.8)+sketchSoftBait(78,hy+18)+sketchLabel(hy-14,"Einzelhaken","Spitze nach oben")+
      sketchPath('M93 '+(hy+25)+' L108 '+(hy+41),"sk-guide")+sketchText(108,hy+57,"Gummiköder");
    draw+=sketchPath('M27 '+(hy+3)+' V'+(wy-15)+' M23 '+(hy+8)+' L27 '+(hy+3)+' L31 '+(hy+8)+' M23 '+(wy-20)+' L27 '+(wy-15)+' L31 '+(wy-20),"sk-arrow")+
      sketchLabel(nymph?234:225,"30–50 cm","Schnur zum Gewicht")+sketchWeight(58,wy)+sketchLabel(wy+10,"Endgewicht");
  }else if(name==="fly"){
    draw=sketchPath("M58 12 V80")+sketchLabel(36,"Fliegenschnur")+
      sketchPath("M58 80 C42 92 44 119 58 124 C72 119 74 92 58 80")+
      sketchPath("M58 142 C43 129 44 108 58 99 C73 108 73 129 58 142 V261","sk-end")+
      sketchOver("M48 101 C49 113 52 120 58 124","sk-line")+sketchLabel(116,"Schlaufen","ineinander")+
      sketchLabel(197,"Vorfach")+sketchNymph(58,264)+sketchLabel(282,"Eine Nymphe");
  }else if(name==="spoon"){
    draw=sketchPath("M58 12 V100")+sketchLabel(35,"Schnur")+sketchSwivel(58,113)+sketchLabel(118,"Wirbel")+
      sketchSnap(58,139)+sketchLabel(153,"Karabiner")+sketchPath("M58 153 V177","sk-metal")+
      sketchPath("M58 177 C30 200 75 214 58 240 C90 227 74 195 58 177 Z","sk-bait")+
      sketchLabel(212,"Spoon / Blinker")+sketchPath("M58 240 V257","sk-metal")+sketchHook(58,261,.9)+sketchLabel(285,"Einzelhaken");
  }else if(["jig","pike","zander","catfish"].includes(name)){
    const leader=name!=="jig";
    draw=sketchPath('M46 12 V'+(leader?60:208))+sketchLabel(32,leader?"Hauptschnur":"Schnur");
    if(leader)draw+=sketchSwivel(46,73)+sketchLabel(78,"Wirbel")+sketchPath("M46 86 V180","sk-end")+
      sketchLabel(128,name==="pike"?"Stahl / Titan":"Abriebvorfach","fertig montiert")+
      sketchSnap(46,192)+sketchLabel(197,"Karabiner")+sketchPath("M46 206 V223","sk-metal");
    const jy=leader?237:222;
    draw+=sketchJig(46,jy)+sketchPath('M46 '+(jy+9)+' L62 261 H95',"sk-guide")+sketchText(104,266,"Jigkopf")+
      sketchPath('M83 '+(jy+9)+' L99 299',"sk-guide")+sketchText(104,307,"Gummifisch")+
      (!leader?sketchPath("M69 200 L95 146","sk-guide")+sketchText(104,151,"Einzelhaken")+sketchText(104,169,"am Jigkopf","sk-sub"):"");
  }else return "";
  const caption='Aufbau · schematisch, nicht massstabsgetreu';
  return '<figure class="rig-drawing">'+sketchSVG(rig.name,build.chain.join(' → ')+'. Ein Einzelhaken ohne Widerhaken. Köder: '+assessment.bait+'.',height,draw)+'<figcaption>'+caption+'</figcaption></figure>';
}

function knotLegend(id){
  return '<div class="knot-legend"><span><i class="sk-line-key"></i>'+(id==="loop"?"Fliegenschnur":"Schnur")+'</span><span><i class="sk-end-key"></i>'+(id==="loop"?"Vorfach":"freies Ende")+'</span></div>';
}
function knotEye(x=45,y=105){
  return sketchCircle(x,y,8)+sketchPath('M'+x+' '+(y+8)+' V'+(y+35)+' C'+x+' '+(y+65)+' '+(x+36)+' '+(y+65)+' '+(x+36)+' '+(y+37)+' V'+(y+26),"sk-metal")+
    sketchText(9,66,"Öhr")+sketchPath('M24 72 L'+(x-4)+' '+(y-8),"sk-guide");
}
function clinchTurns(start=112,count=5,compact=false){
  const step=compact?6:12,top=compact?94:87,bot=compact?114:121;
  let d='M'+start+' 104';
  for(let i=0;i<count;i++){const x=start+i*step;d+=' C'+(x-4)+' '+top+' '+(x+step+3)+' '+top+' '+(x+step)+' 104 C'+(x+step-4)+' '+bot+' '+(x+step-1)+' '+bot+' '+(x+step)+' 104';}
  return sketchPath(d,"sk-end");
}
function knotClinchSketch(step){
  let d=knotEye();
  if(step===0){
    d+=sketchPath("M244 98 H48")+sketchOver("M48 98 C34 152 98 162 126 120 L168 66")+
      sketchPath("M157 71 L168 66 L165 78","sk-arrow")+sketchText(141,47,"15 cm Ende");
  }else if(step===1){
    d+=sketchPath("M244 104 H47")+sketchPath("M47 104 C41 146 96 154 112 104","sk-end")+clinchTurns()+
      sketchPath("M172 104 L207 62","sk-end")+sketchText(115,55,"5 Windungen")+
      sketchPath("M125 62 H174 M125 62 V69 M174 62 V69","sk-guide");
  }else if(step===2){
    d+=sketchPath("M244 104 H173 C135 104 87 74 47 104")+sketchPath("M47 104 C40 149 98 158 112 104","sk-end")+clinchTurns()+
      sketchOver("M172 104 C213 200 83 202 83 149 V82 C98 80 119 110 134 149")+
      sketchPath("M76 92 L83 82 L89 92 M124 143 L134 149 L135 138","sk-arrow")+
      sketchText(20,29,"1 · kleine Schlaufe")+sketchPath("M69 37 L70 107","sk-guide")+
      sketchText(101,211,"2 · grosse Schlaufe");
  }else{
    d+=sketchPath("M244 104 H47")+sketchPath("M47 104 C47 121 67 126 80 104","sk-end")+clinchTurns(80,5,true)+
      sketchOver("M110 104 L124 123")+sketchPath("M205 85 H240 M233 80 L240 85 L233 90","sk-arrow")+
      sketchText(126,156,"ca. 3 mm Ende")+sketchPath("M136 144 L124 125","sk-guide")+sketchText(109,55,"Langsam zuziehen");
  }
  return d;
}
function palomarOverhand(){
  // Zwei Stränge in einem lockeren Überhandknoten. Der grosse Bogen bleibt offen.
  return sketchPath("M241 114 H154 C121 114 110 148 139 155 C177 166 185 112 146 103 C118 97 94 116 97 141")+
    sketchPath("M211 123 H157 C126 123 119 140 141 147 C168 155 177 121 146 112 C123 106 103 121 106 141","sk-end")+
    sketchOver("M140 109 C111 86 93 52 118 39 C151 20 176 49 157 79 L130 112","sk-line")+
    sketchPath("M147 115 C120 89 102 56 122 48 C145 34 166 53 149 76 L122 109","sk-end");
}
function knotPalomarSketch(step,longEnd){
  if(step===0)return knotEye(107,109)+sketchPath("M244 103 H67 C40 103 40 116 67 116")+
    sketchOver("M67 116 H215")+sketchPath("M82 77 H43 M49 71 L43 77 L49 83","sk-arrow")+
    sketchText(14,40,"Schnur doppelt");
  if(step===1)return sketchCircle(102,143,8)+sketchPath("M102 151 V172 C102 195 132 195 132 172 V163","sk-metal")+palomarOverhand()+
    sketchPath("M97 141 Q102 154 106 141")+sketchText(20,217,"Überhandknoten locker lassen");
  if(step===2)return sketchHook(126,108,1.4)+sketchPath("M242 50 H143 L127 83")+
    sketchPath("M208 62 H150 L135 83","sk-end")+sketchPath("M127 83 L126 108 M127 83 C52 48 49 192 116 196")+
    sketchPath("M135 83 Q140 112 126 108","sk-end")+
    sketchPath("M116 196 C189 206 196 62 135 83","sk-end")+
    sketchOver("M119 84 C115 96 145 96 141 82","sk-line")+
    sketchPath("M30 104 V175 M24 167 L30 175 L36 167","sk-arrow")+
    sketchText(18,25,"Schlaufe über den ganzen Haken");
  if(step===3){
    return sketchHook(117,120,1.5)+sketchPath("M120 112 C159 87 185 60 220 40")+
      sketchPath(longEnd?"M126 114 C182 108 215 127 215 192":"M126 114 L158 115","sk-end")+
      sketchOver("M114 113 C107 101 130 95 133 111 C137 123 110 126 111 113","sk-line")+
      sketchPath("M117 105 C123 98 140 117 128 121","sk-end")+
      sketchPath("M183 58 L219 25 M207 29 L219 25 L214 38","sk-arrow")+
      sketchText(15,31,"Anfeuchten & zuziehen")+
      (longEnd?sketchText(153,214,"Ende behalten"):sketchText(150,147,"ca. 3 mm"));
  }
  // Dropshot: das behaltene Ende von oben erneut durch dasselbe Öhr führen.
  return sketchPath("M58 12 V81")+sketchHook(58,85,1)+sketchSoftBait(84,102)+
    sketchPath("M61 80 C107 46 112 30 91 27 C69 24 58 45 58 85 V181","sk-end")+
    sketchPath("M48 48 V73 M42 66 L48 73 L54 66","sk-arrow")+
    sketchLabel(34,"Von oben","durchs Öhr")+sketchLabel(149,"30–50 cm","bis zum Gewicht")+sketchWeight(58,194);
}
function knotLoopSketch(step){
  if(step===0)return sketchPath("M16 102 H79 C111 65 175 75 175 102 C175 133 108 137 79 102")+
    sketchPath("M241 156 L168 124 C139 97 113 64 97 83 C77 105 125 137 168 124","sk-end")+
    sketchOver("M111 81 C136 75 158 82 170 94","sk-line")+
    sketchPath("M167 58 H100 M109 52 L100 58 L109 64","sk-arrow")+sketchText(25,193,"Eine Schlaufe durch die andere");
  if(step===1)return sketchPath("M16 107 H78 C109 72 191 65 191 105 C191 143 113 145 78 107")+
    sketchPath("M242 171 C181 178 128 166 117 137 C107 110 82 91 76 109 C68 133 110 144 136 130 C170 111 181 91 208 110 L239 137","sk-end")+
    sketchOver("M178 82 C195 88 197 108 183 125","sk-line")+
    sketchPath("M230 125 L239 137 L227 135","sk-arrow")+sketchText(21,30,"Ganzes Vorfach hindurch");
  return sketchPath("M15 109 H75 C75 82 147 82 147 109 C147 136 75 136 75 109")+
    sketchPath("M245 109 H185 C185 82 113 82 113 109 C113 136 185 136 185 109","sk-end")+
    sketchOver("M147 109 C147 126 121 132 108 129","sk-line")+
    sketchPath("M55 66 H17 M24 60 L17 66 L24 72 M205 66 H243 M236 60 L243 66 L236 72","sk-arrow")+
    sketchText(37,181,"Schlaufen liegen Ende an Ende");
}
const KNOT_STEP_LABELS={
  clinch:["Durchs Öhr","Fünfmal wickeln","Durch beide Schlaufen","Anfeuchten und festziehen"],
  palomar:["Doppelte Schnur durchs Öhr","Lockeren Knoten legen","Haken durch die Schlaufe","Anfeuchten und festziehen","Ende nochmals durchs Öhr"],
  loop:["Schlaufen ineinander","Vorfach durchziehen","Verbindung festziehen"]
};
function knotSketchSteps(id,longEnd=false){
  const k=RIG_KNOTS[id];if(!k)return [];
  const steps=k.steps.slice();
  if(id==="palomar"&&longEnd){
    steps[3]="Anfeuchten, beide Stränge ordnen und gleichmässig festziehen. Mit einem Zug prüfen. Das lange Ende für das Gewicht behalten.";
    steps.push("Das lange Ende nochmals von oben durch das Hakenöhr führen. Die Hakenspitze zeigt nach oben. 30–50 cm darunter das Endgewicht anklemmen.");
  }
  return steps.map((text,i)=>({label:KNOT_STEP_LABELS[id][i],text}));
}
function knotStage(id,index,longEnd){
  const steps=knotSketchSteps(id,longEnd),i=Math.max(0,Math.min(steps.length-1,index)),step=steps[i];
  if(!step)return "";
  const drawing=id==="clinch"?knotClinchSketch(i):id==="palomar"?knotPalomarSketch(i,longEnd):knotLoopSketch(i);
  return sketchSVG(RIG_KNOTS[id].name+' · Schritt '+(i+1)+': '+step.label,step.text,230,drawing)+
    '<div class="knot-step-copy"><strong>'+(i+1)+'. '+esc(step.label)+'</strong><p>'+esc(step.text)+'</p></div>';
}
function knotGuideMarkup(id,rig){
  const k=RIG_KNOTS[id],longEnd=id==="palomar"&&["drop","nymph"].includes(rig.type);
  const steps=knotSketchSteps(id,longEnd);
  return '<details class="rig-knot" data-knot="'+id+'" data-long-end="'+longEnd+'" data-step="0"><summary>'+esc(k.name)+' binden</summary><p class="rig-small">'+esc(k.for)+'</p>'+knotLegend(id)+
    '<div class="knot-stage" aria-live="polite" aria-atomic="true">'+knotStage(id,0,longEnd)+'</div>'+
    '<div class="knot-nav"><button type="button" data-knot-move="-1" aria-label="Vorheriger Schritt: '+esc(k.name)+'" disabled>Zurück</button><span class="knot-count">1 / '+steps.length+'</span><button type="button" data-knot-move="1" aria-label="Nächster Schritt: '+esc(k.name)+'">Weiter</button></div>'+
    '<a class="rig-link" href="'+esc(k.url)+'" target="_blank" rel="noopener noreferrer">Animation der Fachquelle</a></details>';
}
function moveKnotStep(button){
  const knot=button.closest(".rig-knot"),id=knot?.dataset.knot;if(!id)return;
  const longEnd=knot.dataset.longEnd==="true",steps=knotSketchSteps(id,longEnd),old=Number(knot.dataset.step)||0;
  const next=Math.max(0,Math.min(steps.length-1,old+Number(button.dataset.knotMove)));
  if(next===old)return;
  knot.dataset.step=String(next);
  patchRigHTML(knot.querySelector(".knot-stage"),knotStage(id,next,longEnd));
  knot.querySelector(".knot-count").textContent=(next+1)+' / '+steps.length;
  knot.querySelector('[data-knot-move="-1"]').disabled=next===0;
  knot.querySelector('[data-knot-move="1"]').disabled=next===steps.length-1;
}
