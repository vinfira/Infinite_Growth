const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');
const hint   = document.getElementById('hint');
const hint2  = document.getElementById('hint2');
const stats  = document.getElementById('stats');

const ACCENT     = '#98FF6E';
const ACCENT_RGB = '152,255,110';
const CONNECT_R  = 190;
const NODE_R     = 3.2;

let W = canvas.width  = window.innerWidth;
let H = canvas.height = window.innerHeight;

let nodes       = [];
let connections = [];
let particles   = [];
let mouse       = { x:-9999, y:-9999 };
let firstClick  = false;
let nodeCount   = 0;
let plantCount  = 0;

window.addEventListener('resize', () => {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
});

// ════════════════════════════════════════════
// PLANT TYPES
// ════════════════════════════════════════════

class TreePlant {
  constructor(ox, oy, angle) {
    this.ox = ox; this.oy = oy;
    this.opacity = 0; this.fading = false; this.dead = false;
    const maxD = 4 + Math.floor(Math.random()*2);
    const len  = 44 + Math.random()*50;
    this.root  = new TreeSeg(ox, oy, angle, len, 0, maxD);
  }
  update() {
    if (this.fading) { this.opacity -= 0.005; if (this.opacity<=0) this.dead=true; }
    else { this.opacity=Math.min(1,this.opacity+0.04); this.root.update(); }
  }
  draw() {
    if (this.dead) return;
    ctx.save(); ctx.globalAlpha=Math.max(0,this.opacity);
    this.root.draw(); ctx.restore();
  }
  getTips() { const a=[]; this.root.collectTips(a); return a; }
  fadeOut() { this.fading=true; }
}

class TreeSeg {
  constructor(sx,sy,angle,len,depth,maxD) {
    this.sx=sx; this.sy=sy; this.angle=angle; this.targetLen=len;
    this.currentLen=0; this.speed=0.8+(maxD-depth)*0.5+Math.random()*0.4;
    this.depth=depth; this.maxD=maxD;
    this.strokeW=Math.max(0.2,(maxD-depth+1)*0.82);
    this.alpha=0.28+((maxD-depth)/(maxD+1))*0.72;
    this.done=false; this.children=[]; this.isLeaf=depth>=maxD;
    this.leafProgress=0;
    const types=['triangle','circle','diamond','dots'];
    this.leafType=types[Math.floor(Math.random()*types.length)];
    this.leafAccent=Math.random()<0.22;
    this.leafSize=3+Math.random()*3.5;
    this.dotPos=[];
    if (this.leafType==='dots') {
      const n=4+Math.floor(Math.random()*3);
      for (let i=0;i<n;i++) { const a=(i/n)*Math.PI*2; this.dotPos.push([Math.cos(a),Math.sin(a)]); }
    }
  }
  get ex() { return this.sx+Math.sin(this.angle)*this.currentLen; }
  get ey() { return this.sy-Math.cos(this.angle)*this.currentLen; }
  get tipX() { return this.sx+Math.sin(this.angle)*this.targetLen; }
  get tipY() { return this.sy-Math.cos(this.angle)*this.targetLen; }

  update() {
    if (!this.done) {
      this.currentLen=Math.min(this.targetLen,this.currentLen+this.speed);
      if (this.currentLen>=this.targetLen) { this.done=true; if (!this.isLeaf) this.spawn(); }
    } else if (this.isLeaf) this.leafProgress=Math.min(1,this.leafProgress+0.025);
    this.children.forEach(c=>c.update());
  }
  spawn() {
    const r=Math.random(), n=this.depth===0?1:(r<0.5?2:r<0.85?3:1);
    const spd=0.3+Math.random()*0.44, nl=this.targetLen*(0.5+Math.random()*0.3);
    const offsets=n===1?[(Math.random()-0.5)*0.5]:n===2?[-spd,spd]:[-spd,(Math.random()-0.5)*0.2,spd];
    offsets.forEach(off=>this.children.push(new TreeSeg(this.tipX,this.tipY,
      this.angle+off+(Math.random()-0.5)*0.1,nl*(0.9+Math.random()*0.2),this.depth+1,this.maxD)));
  }
  draw() {
    ctx.save();
    ctx.strokeStyle=`rgba(255,255,255,${this.alpha})`;
    ctx.lineWidth=this.strokeW; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(this.sx,this.sy); ctx.lineTo(this.ex,this.ey); ctx.stroke();
    ctx.restore();
    if (this.done && !this.isLeaf && this.depth>0) {
      ctx.save(); ctx.fillStyle=`rgba(255,255,255,${this.alpha*0.5})`;
      ctx.beginPath(); ctx.arc(this.tipX,this.tipY,this.strokeW*0.8,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
    if (this.done && this.isLeaf && this.leafProgress>0) {
      const s=this.leafSize*this.leafProgress;
      const col=this.leafAccent?ACCENT:'rgba(255,255,255,0.82)';
      ctx.save(); ctx.translate(this.tipX,this.tipY); ctx.rotate(this.angle); ctx.fillStyle=col;
      if (this.leafAccent){ctx.shadowColor=ACCENT;ctx.shadowBlur=13;}
      switch(this.leafType) {
        case 'triangle':
          ctx.beginPath(); ctx.moveTo(0,-s*1.9); ctx.lineTo(-s*0.9,s*0.8); ctx.lineTo(s*0.9,s*0.8);
          ctx.closePath(); ctx.fill(); break;
        case 'circle':
          ctx.beginPath(); ctx.arc(0,0,s,0,Math.PI*2); ctx.fill(); break;
        case 'diamond':
          ctx.beginPath(); ctx.moveTo(0,-s*1.8); ctx.lineTo(s*0.85,0); ctx.lineTo(0,s*1.8); ctx.lineTo(-s*0.85,0);
          ctx.closePath(); ctx.fill(); break;
        case 'dots':
          this.dotPos.forEach(([cx,cy])=>{ctx.beginPath();ctx.arc(cx*s*1.3,cy*s*1.3,s*0.38,0,Math.PI*2);ctx.fill();});
          ctx.beginPath(); ctx.arc(0,0,s*0.4,0,Math.PI*2); ctx.fill(); break;
      }
      ctx.restore();
    }
    this.children.forEach(c=>c.draw());
  }
  collectTips(arr) {
    if (this.isLeaf&&this.leafProgress>0.4) arr.push({x:this.tipX,y:this.tipY});
    this.children.forEach(c=>c.collectTips(arr));
  }
}

// ────────────────────────────────
// FLOWER
// ────────────────────────────────
class FlowerPlant {
  constructor(ox, oy, angle) {
    this.ox=ox; this.oy=oy; this.angle=angle;
    this.opacity=0; this.fading=false; this.dead=false;
    this.stemLen=0; this.stemTarget=35+Math.random()*45;
    this.stemSpeed=1.2+Math.random()*0.8;
    this.stemDone=false;
    const n=5+Math.floor(Math.random()*4);
    this.petalCount=n;
    this.petalSize=8+Math.random()*10;
    this.petalProgress=0;
    this.centerSize=3+Math.random()*3;
    this.accent=Math.random()<0.3;
    this.lean=(Math.random()-0.5)*0.5;
    this.buds=[];
    if (Math.random()<0.55) {
      const nb=1+Math.floor(Math.random()*2);
      for (let i=0;i<nb;i++) {
        this.buds.push({
          t: 0.35+Math.random()*0.4,
          side: Math.random()<0.5?1:-1,
          stemLen:0, stemTarget:15+Math.random()*18, stemSpeed:0.8+Math.random()*0.5, stemDone:false,
          petalProgress:0, petalSize:4+Math.random()*5, petalCount:4+Math.floor(Math.random()*3),
          accent:Math.random()<0.2
        });
      }
    }
  }
  get tipX() { return this.ox+Math.sin(this.angle+this.lean)*this.stemLen; }
  get tipY() { return this.oy-Math.cos(this.angle+this.lean)*this.stemLen; }
  get fullTipX() { return this.ox+Math.sin(this.angle+this.lean)*this.stemTarget; }
  get fullTipY() { return this.oy-Math.cos(this.angle+this.lean)*this.stemTarget; }

  update() {
    if (this.fading) { this.opacity-=0.005; if(this.opacity<=0) this.dead=true; return; }
    this.opacity=Math.min(1,this.opacity+0.04);
    if (!this.stemDone) {
      this.stemLen=Math.min(this.stemTarget,this.stemLen+this.stemSpeed);
      if (this.stemLen>=this.stemTarget) this.stemDone=true;
    } else { this.petalProgress=Math.min(1,this.petalProgress+0.028); }
    this.buds.forEach(b=>{
      const bx=this.ox+Math.sin(this.angle+this.lean)*this.stemTarget*b.t;
      const by=this.oy-Math.cos(this.angle+this.lean)*this.stemTarget*b.t;
      if (this.stemLen>=this.stemTarget*b.t) {
        if (!b.stemDone) {
          b.stemLen=Math.min(b.stemTarget,b.stemLen+b.stemSpeed);
          if (b.stemLen>=b.stemTarget) b.stemDone=true;
        } else { b.petalProgress=Math.min(1,b.petalProgress+0.022); }
      }
      b.bx=bx; b.by=by;
    });
  }

  drawFlowerHead(cx,cy,size,petalCount,petalProgress,accent,scale=1) {
    if (petalProgress<=0) return;
    const s=size*petalProgress*scale;
    const col=accent?ACCENT:'rgba(255,255,255,0.84)';
    ctx.save(); ctx.translate(cx,cy); ctx.fillStyle=col;
    if (accent){ctx.shadowColor=ACCENT;ctx.shadowBlur=14;}
    else {ctx.shadowColor='rgba(255,255,255,0.2)';ctx.shadowBlur=5;}
    for (let i=0;i<petalCount;i++) {
      const a=(i/petalCount)*Math.PI*2;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath(); ctx.ellipse(0,-s*1.1,s*0.42,s,0,0,Math.PI*2); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle=accent?'rgba(255,255,255,0.95)':ACCENT;
    ctx.shadowColor=ACCENT; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.arc(0,0,s*0.48,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }

  draw() {
    if (this.dead) return;
    ctx.save(); ctx.globalAlpha=Math.max(0,this.opacity);
    ctx.strokeStyle='rgba(255,255,255,0.55)';
    ctx.lineWidth=1.2; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(this.ox,this.oy); ctx.lineTo(this.tipX,this.tipY); ctx.stroke();
    this.buds.forEach(b=>{
      if (!b.bx) return;
      const budTipX=b.bx+Math.sin(this.angle+b.side*0.9)*b.stemLen;
      const budTipY=b.by-Math.cos(this.angle+b.side*0.9)*b.stemLen;
      ctx.strokeStyle='rgba(255,255,255,0.35)';
      ctx.lineWidth=0.7; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(b.bx,b.by); ctx.lineTo(budTipX,budTipY); ctx.stroke();
      this.drawFlowerHead(budTipX,budTipY,b.petalSize,b.petalCount,b.petalProgress,b.accent,0.85);
    });
    this.drawFlowerHead(this.fullTipX,this.fullTipY,this.petalSize,this.petalCount,this.petalProgress,this.accent,1);
    ctx.restore();
  }
  getTips() {
    if (this.petalProgress>0.5) return [{x:this.fullTipX,y:this.fullTipY}];
    return [];
  }
  fadeOut() { this.fading=true; }
}

// ────────────────────────────────
// GRASS
// ────────────────────────────────
class GrassPlant {
  constructor(ox, oy, angle) {
    this.ox=ox; this.oy=oy; this.angle=angle;
    this.opacity=0; this.fading=false; this.dead=false;
    const count=3+Math.floor(Math.random()*5);
    this.blades=[];
    for (let i=0;i<count;i++) {
      const spread=(Math.random()-0.5)*0.9;
      const len=22+Math.random()*40;
      this.blades.push({
        angle:angle+spread, targetLen:len, currentLen:0,
        speed:0.7+Math.random()*0.8,
        strokeW:0.6+Math.random()*0.8,
        alpha:0.35+Math.random()*0.5,
        done:false, tipProgress:0,
        accent:Math.random()<0.15
      });
    }
  }
  update() {
    if (this.fading) { this.opacity-=0.006; if(this.opacity<=0) this.dead=true; return; }
    this.opacity=Math.min(1,this.opacity+0.05);
    this.blades.forEach(b=>{
      if (!b.done) {
        b.currentLen=Math.min(b.targetLen,b.currentLen+b.speed);
        if (b.currentLen>=b.targetLen) b.done=true;
      } else { b.tipProgress=Math.min(1,b.tipProgress+0.03); }
    });
  }
  draw() {
    if (this.dead) return;
    ctx.save(); ctx.globalAlpha=Math.max(0,this.opacity);
    this.blades.forEach(b=>{
      const tx=this.ox+Math.sin(b.angle)*b.currentLen;
      const ty=this.oy-Math.cos(b.angle)*b.currentLen;
      ctx.strokeStyle=`rgba(255,255,255,${b.alpha})`;
      ctx.lineWidth=b.strokeW; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(this.ox,this.oy); ctx.lineTo(tx,ty); ctx.stroke();
      if (b.done&&b.tipProgress>0) {
        const s=2.5*b.tipProgress;
        const col=b.accent?ACCENT:`rgba(255,255,255,${b.alpha})`;
        ctx.save(); ctx.translate(tx,ty); ctx.rotate(b.angle); ctx.fillStyle=col;
        if (b.accent){ctx.shadowColor=ACCENT;ctx.shadowBlur=10;}
        ctx.beginPath(); ctx.moveTo(0,-s*2); ctx.lineTo(-s*0.7,s); ctx.lineTo(s*0.7,s);
        ctx.closePath(); ctx.fill(); ctx.restore();
      }
    });
    ctx.restore();
  }
  getTips() {
    return this.blades.filter(b=>b.tipProgress>0.5).map(b=>({
      x:this.ox+Math.sin(b.angle)*b.targetLen,
      y:this.oy-Math.cos(b.angle)*b.targetLen
    }));
  }
  fadeOut() { this.fading=true; }
}

// ────────────────────────────────
// MUSHROOM
// ────────────────────────────────
class MushroomPlant {
  constructor(ox, oy, angle) {
    this.ox=ox; this.oy=oy; this.angle=angle;
    this.opacity=0; this.fading=false; this.dead=false;
    this.stemH=0; this.stemTarget=20+Math.random()*30;
    this.stemW=4+Math.random()*5;
    this.stemSpeed=0.8+Math.random()*0.5;
    this.stemDone=false;
    this.capProgress=0;
    this.capR=12+Math.random()*16;
    this.accent=Math.random()<0.3;
    const nd=3+Math.floor(Math.random()*4);
    this.capDots=[];
    for (let i=0;i<nd;i++) {
      const a=(Math.random()-0.5)*0.85;
      const r=0.3+Math.random()*0.55;
      this.capDots.push({a,r,size:1+Math.random()*2});
    }
    this.cluster=[];
    if (Math.random()<0.5) {
      const nc=1+Math.floor(Math.random()*2);
      for(let i=0;i<nc;i++) {
        this.cluster.push({
          ox:ox+(Math.random()-0.5)*22,
          stemH:0, stemTarget:10+Math.random()*16, stemW:2+Math.random()*3,
          stemSpeed:0.6+Math.random()*0.4, stemDone:false, capProgress:0,
          capR:5+Math.random()*9, accent:false, delay:8+Math.random()*12, delayCount:0
        });
      }
    }
  }
  get tipY() { return this.oy-this.stemH; }
  get fullTipY() { return this.oy-this.stemTarget; }

  update() {
    if (this.fading) { this.opacity-=0.005; if(this.opacity<=0) this.dead=true; return; }
    this.opacity=Math.min(1,this.opacity+0.04);
    if (!this.stemDone) {
      this.stemH=Math.min(this.stemTarget,this.stemH+this.stemSpeed);
      if (this.stemH>=this.stemTarget) this.stemDone=true;
    } else { this.capProgress=Math.min(1,this.capProgress+0.025); }
    this.cluster.forEach(m=>{
      if (m.delayCount<m.delay) { m.delayCount++; return; }
      if (!m.stemDone) {
        m.stemH=Math.min(m.stemTarget,m.stemH+m.stemSpeed);
        if (m.stemH>=m.stemTarget) m.stemDone=true;
      } else { m.capProgress=Math.min(1,m.capProgress+0.022); }
    });
  }

  drawMushroom(ox,oy,stemH,stemW,capR,capProgress,accent,dots) {
    ctx.strokeStyle='rgba(255,255,255,0.5)';
    ctx.lineWidth=stemW; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(ox,oy-stemH); ctx.stroke();
    if (capProgress<=0) return;
    const cy=oy-stemH;
    const r=capR*capProgress;
    const col=accent?ACCENT:'rgba(255,255,255,0.85)';
    ctx.fillStyle=col;
    if (accent){ctx.shadowColor=ACCENT;ctx.shadowBlur=14;}
    ctx.beginPath(); ctx.arc(ox,cy,r,Math.PI,0); ctx.closePath(); ctx.fill();
    if (dots) {
      ctx.fillStyle=accent?'rgba(0,0,0,0.55)':'rgba(0,0,0,0.45)';
      dots.forEach(d=>{
        const dx=Math.sin(d.a)*r*d.r, dy=-Math.cos(d.a)*r*d.r*0.5;
        ctx.beginPath(); ctx.arc(ox+dx,cy+dy,d.size*capProgress,0,Math.PI*2); ctx.fill();
      });
    }
    ctx.strokeStyle='rgba(255,255,255,0.18)';
    ctx.lineWidth=0.6;
    ctx.beginPath(); ctx.moveTo(ox-r*0.9,cy); ctx.lineTo(ox+r*0.9,cy); ctx.stroke();
  }

  draw() {
    if (this.dead) return;
    ctx.save(); ctx.globalAlpha=Math.max(0,this.opacity);
    this.cluster.forEach(m=>{
      this.drawMushroom(m.ox,this.oy,m.stemH,m.stemW,m.capR,m.capProgress,m.accent,null);
    });
    this.drawMushroom(this.ox,this.oy,this.stemH,this.stemW,this.capR,this.capProgress,this.accent,this.capDots);
    ctx.restore();
  }
  getTips() {
    if (this.capProgress>0.5) return [{x:this.ox,y:this.fullTipY-this.capR}];
    return [];
  }
  fadeOut() { this.fading=true; }
}

// ────────────────────────────────
// DANDELION
// ────────────────────────────────
class DandelionPlant {
  constructor(ox, oy, angle) {
    this.ox=ox; this.oy=oy; this.angle=angle;
    this.opacity=0; this.fading=false; this.dead=false;
    this.stemLen=0; this.stemTarget=30+Math.random()*40;
    this.stemSpeed=1+Math.random()*0.6;
    this.stemDone=false;
    const n=12+Math.floor(Math.random()*10);
    this.rayCount=n;
    this.rayLen=14+Math.random()*12;
    this.rayProgress=0;
    this.accent=Math.random()<0.35;
    this.lean=(Math.random()-0.5)*0.45;
  }
  get tipX() { return this.ox+Math.sin(this.angle+this.lean)*this.stemTarget; }
  get tipY() { return this.oy-Math.cos(this.angle+this.lean)*this.stemTarget; }

  update() {
    if (this.fading) { this.opacity-=0.005; if(this.opacity<=0) this.dead=true; return; }
    this.opacity=Math.min(1,this.opacity+0.04);
    if (!this.stemDone) {
      this.stemLen=Math.min(this.stemTarget,this.stemLen+this.stemSpeed);
      if (this.stemLen>=this.stemTarget) this.stemDone=true;
    } else { this.rayProgress=Math.min(1,this.rayProgress+0.022); }
  }
  draw() {
    if (this.dead) return;
    ctx.save(); ctx.globalAlpha=Math.max(0,this.opacity);
    const curTipX=this.ox+Math.sin(this.angle+this.lean)*this.stemLen;
    const curTipY=this.oy-Math.cos(this.angle+this.lean)*this.stemLen;
    ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=0.9; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(this.ox,this.oy); ctx.lineTo(curTipX,curTipY); ctx.stroke();
    if (this.rayProgress>0) {
      const col=this.accent?ACCENT:'rgba(255,255,255,0.78)';
      ctx.strokeStyle=col; ctx.lineWidth=0.7;
      if (this.accent){ctx.shadowColor=ACCENT;ctx.shadowBlur=10;}
      for (let i=0;i<this.rayCount;i++) {
        const a=(i/this.rayCount)*Math.PI*2;
        const rl=this.rayLen*this.rayProgress;
        const ex=this.tipX+Math.cos(a)*rl, ey=this.tipY+Math.sin(a)*rl;
        ctx.beginPath(); ctx.moveTo(this.tipX,this.tipY); ctx.lineTo(ex,ey); ctx.stroke();
        ctx.fillStyle=col;
        ctx.beginPath(); ctx.arc(ex,ey,1.3*this.rayProgress,0,Math.PI*2); ctx.fill();
      }
      ctx.fillStyle=this.accent?'rgba(255,255,255,0.9)':ACCENT;
      ctx.shadowColor=ACCENT; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(this.tipX,this.tipY,2.5*this.rayProgress,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }
  getTips() {
    if (this.rayProgress>0.5) return [{x:this.tipX,y:this.tipY}];
    return [];
  }
  fadeOut() { this.fading=true; }
}

// ════════════════════════════════════════════
// FACTORY
// ════════════════════════════════════════════
const PLANT_TYPES = ['tree','tree','flower','flower','grass','mushroom','dandelion'];

function makePlant(ox, oy, angle) {
  const type = PLANT_TYPES[Math.floor(Math.random()*PLANT_TYPES.length)];
  switch(type) {
    case 'flower':    return new FlowerPlant(ox,oy,angle);
    case 'grass':     return new GrassPlant(ox,oy,angle);
    case 'mushroom':  return new MushroomPlant(ox,oy,angle);
    case 'dandelion': return new DandelionPlant(ox,oy,angle);
    default:          return new TreePlant(ox,oy,angle);
  }
}

// ════════════════════════════════════════════
// PARTICLES
// ════════════════════════════════════════════
class Particle {
  constructor(ax,ay,bx,by) {
    const t=Math.random();
    this.x=ax+(bx-ax)*t; this.y=ay+(by-ay)*t;
    const dx=bx-ax, dy=by-ay;
    const len=Math.sqrt(dx*dx+dy*dy)||1;
    const nx=dx/len, ny=dy/len;
    const perp=(Math.random()-0.5)*1.8;
    this.vx=nx*(0.4+Math.random()*1.2)+(-ny)*perp;
    this.vy=ny*(0.4+Math.random()*1.2)+nx*perp-(0.3+Math.random()*0.5);
    this.alpha=0.6+Math.random()*0.4;
    this.size=0.8+Math.random()*1.8;
    this.decay=0.008+Math.random()*0.012;
    this.accent=Math.random()<0.25;
  }
  update() {
    this.x+=this.vx; this.y+=this.vy;
    this.vy+=0.018;
    this.alpha-=this.decay;
  }
  draw() {
    if (this.alpha<=0) return;
    const col=this.accent?`rgba(${ACCENT_RGB},${this.alpha})`:`rgba(255,255,255,${this.alpha})`;
    ctx.fillStyle=col;
    ctx.beginPath(); ctx.arc(this.x,this.y,this.size,0,Math.PI*2); ctx.fill();
  }
  get dead() { return this.alpha<=0; }
}

function spawnParticles(ax,ay,bx,by) {
  const dx=bx-ax, dy=by-ay;
  const dist=Math.sqrt(dx*dx+dy*dy);
  const count=Math.min(60,18+Math.floor(dist/12));
  for (let i=0;i<count;i++) particles.push(new Particle(ax,ay,bx,by));
}

// ════════════════════════════════════════════
// CONNECTION
// ════════════════════════════════════════════
class Connection {
  constructor(nA, nB) {
    this.a=nA; this.b=nB;
    this.lineProgress=0; this.alpha=0;
    this.fading=false; this.dead=false;
    this.plants=[]; this.spawned=false;
    const dx=nB.x-nA.x, dy=nB.y-nA.y;
    this.len=Math.sqrt(dx*dx+dy*dy);
    this.lineAngle=Math.atan2(dx,-dy);
    this.particlesDone=false;
  }
  spawnPlants() {
    if (this.spawned) return; this.spawned=true;
    const count=1+Math.floor(this.len/95);
    for (let i=0;i<count;i++) {
      const t=count===1?0.5:0.2+(i/(count-1))*0.6;
      const ox=this.a.x+(this.b.x-this.a.x)*t;
      const oy=this.a.y+(this.b.y-this.a.y)*t;
      const perp=this.lineAngle+Math.PI/2*(Math.random()<0.5?1:-1);
      this.plants.push(makePlant(ox,oy,perp+(Math.random()-0.5)*0.55));
    }
    plantCount+=count;
    updateStats();
  }
  update() {
    if (this.fading) {
      this.alpha-=0.005;
      this.plants.forEach(p=>p.fadeOut());
      if (this.alpha<=0) this.dead=true;
    } else {
      this.lineProgress=Math.min(1,this.lineProgress+0.028);
      this.alpha=Math.min(0.35,this.alpha+0.015);
      if (this.lineProgress>=1) {
        if (!this.particlesDone) { spawnParticles(this.a.x,this.a.y,this.b.x,this.b.y); this.particlesDone=true; }
        if (!this.spawned) this.spawnPlants();
      }
    }
    this.plants.forEach(p=>p.update());
    this.plants=this.plants.filter(p=>!p.dead);
  }
  draw() {
    if (this.dead) return;
    const ex=this.a.x+(this.b.x-this.a.x)*this.lineProgress;
    const ey=this.a.y+(this.b.y-this.a.y)*this.lineProgress;
    ctx.save();
    ctx.strokeStyle=`rgba(255,255,255,${this.alpha})`;
    ctx.lineWidth=0.8; ctx.lineCap='round'; ctx.setLineDash([4,6]);
    ctx.beginPath(); ctx.moveTo(this.a.x,this.a.y); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    this.plants.forEach(p=>p.draw());
  }
  getTips() { const a=[]; this.plants.forEach(p=>a.push(...p.getTips())); return a; }
  fadeOut() { this.fading=true; }
}

// ════════════════════════════════════════════
// NODE
// ════════════════════════════════════════════
class Node {
  constructor(x,y,id) {
    this.x=x; this.y=y; this.id=id;
    this.alpha=0; this.pulse=0; this.fading=false; this.dead=false;
  }
  update() {
    if (this.fading) { this.alpha-=0.01; if(this.alpha<=0) this.dead=true; }
    else { this.alpha=Math.min(1,this.alpha+0.06); this.pulse=(this.pulse+0.04)%(Math.PI*2); }
  }
  draw() {
    if (this.dead) return;
    ctx.save(); ctx.globalAlpha=Math.max(0,this.alpha);
    const pr=NODE_R+4+Math.sin(this.pulse)*2.5;
    ctx.strokeStyle=`rgba(255,255,255,${0.1+Math.sin(this.pulse)*0.06})`;
    ctx.lineWidth=0.6;
    ctx.beginPath(); ctx.arc(this.x,this.y,pr,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle='#fff'; ctx.shadowColor='rgba(255,255,255,0.7)'; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.arc(this.x,this.y,NODE_R,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  fadeOut() { this.fading=true; }
}

// ════════════════════════════════════════════
// RIPPLES
// ════════════════════════════════════════════
const ripples=[];
function addRipple(x,y) { ripples.push({x,y,r:4,alpha:0.55}); }
function updateRipples() {
  for (let i=ripples.length-1;i>=0;i--) {
    ripples[i].r+=2.2; ripples[i].alpha-=0.025;
    if (ripples[i].alpha<=0) ripples.splice(i,1);
  }
}
function drawRipples() {
  ripples.forEach(r=>{
    ctx.save(); ctx.strokeStyle=`rgba(255,255,255,${r.alpha})`; ctx.lineWidth=0.7;
    ctx.beginPath(); ctx.arc(r.x,r.y,r.r,0,Math.PI*2); ctx.stroke(); ctx.restore();
  });
}

// ════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════
function findNearby(node) {
  let closest=null, closestDist=CONNECT_R;
  nodes.forEach(n=>{
    if (n.id===node.id||n.fading||n.dead) return;
    const dx=n.x-node.x, dy=n.y-node.y;
    const d=Math.sqrt(dx*dx+dy*dy);
    if (d<closestDist) { closestDist=d; closest=n; }
  });
  return closest ? [closest] : [];
}

function connectionExists(a,b) {
  return connections.some(c=>!c.fading&&!c.dead&&
    ((c.a.id===a.id&&c.b.id===b.id)||(c.a.id===b.id&&c.b.id===a.id)));
}

function updateStats() {
  const an=nodes.filter(n=>!n.fading&&!n.dead).length;
  stats.textContent=`${an} node${an===1?'':'s'} · ${plantCount} plant${plantCount===1?'':'s'}`;
}

// ════════════════════════════════════════════
// CURSOR
// ════════════════════════════════════════════
function drawCursor(x,y) {
  let closest=null, closestDist=CONNECT_R;
  nodes.forEach(n=>{
    if (n.fading||n.dead) return;
    const dx=n.x-x, dy=n.y-y, d=Math.sqrt(dx*dx+dy*dy);
    if (d<closestDist) { closestDist=d; closest=n; }
  });
  if (closest) {
    ctx.save();
    ctx.strokeStyle=`rgba(${ACCENT_RGB},${(1-closestDist/CONNECT_R)*0.28})`;
    ctx.lineWidth=0.6; ctx.setLineDash([3,6]);
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(closest.x,closest.y); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
  }
  ctx.save();
  ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=0.8;
  ctx.beginPath(); ctx.arc(x,y,11,0,Math.PI*2); ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,0.72)';
  ctx.beginPath(); ctx.arc(x,y,1.6,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=0.6;
  ctx.beginPath();
  ctx.moveTo(x-20,y);ctx.lineTo(x-14,y);
  ctx.moveTo(x+14,y);ctx.lineTo(x+20,y);
  ctx.moveTo(x,y-20);ctx.lineTo(x,y-14);
  ctx.moveTo(x,y+14);ctx.lineTo(x,y+20);
  ctx.stroke(); ctx.restore();
}

// ════════════════════════════════════════════
// TIP CONNECTIONS
// ════════════════════════════════════════════
function drawTipConnections(tips) {
  const MAX_D=75;
  ctx.save();
  for (let i=0;i<tips.length;i++) for (let j=i+1;j<tips.length;j++) {
    const dx=tips[i].x-tips[j].x, dy=tips[i].y-tips[j].y, d=Math.sqrt(dx*dx+dy*dy);
    if (d>=MAX_D) continue;
    ctx.setLineDash([2,5]);
    ctx.strokeStyle=`rgba(${ACCENT_RGB},${(1-d/MAX_D)*0.1})`;
    ctx.lineWidth=0.5;
    ctx.beginPath(); ctx.moveTo(tips[i].x,tips[i].y); ctx.lineTo(tips[j].x,tips[j].y); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.restore();
}

// ════════════════════════════════════════════
// EVENTS
// ════════════════════════════════════════════
let lastMs=0;

canvas.addEventListener('click',e=>{
  const now=Date.now(); if(now-lastMs<320) return; lastMs=now;
  if (!firstClick) {
    firstClick=true; hint.classList.add('fade');
    setTimeout(()=>hint2.classList.add('show'),2000);
  }
  const node=new Node(e.clientX,e.clientY,nodeCount++);
  const nearby=findNearby(node);
  nodes.push(node); addRipple(e.clientX,e.clientY);
  nearby.forEach(other=>{
    if (!connectionExists(node,other)) connections.push(new Connection(node,other));
  });
  updateStats();
});

canvas.addEventListener('dblclick',()=>{
  lastMs=Date.now();
  nodes.forEach(n=>n.fadeOut());
  connections.forEach(c=>c.fadeOut());
  hint2.classList.remove('show'); hint.classList.remove('fade');
  firstClick=false; nodeCount=0; plantCount=0; stats.textContent='';
});

canvas.addEventListener('mousemove',  e =>{ mouse.x=e.clientX; mouse.y=e.clientY; });
canvas.addEventListener('mouseleave', ()=>{ mouse.x=-9999; mouse.y=-9999; });

// ════════════════════════════════════════════
// LOOP
// ════════════════════════════════════════════
function loop() {
  ctx.clearRect(0,0,W,H);

  nodes=nodes.filter(n=>!n.dead);
  connections=connections.filter(c=>!c.dead);
  particles=particles.filter(p=>!p.dead);

  connections.forEach(c=>c.update());
  nodes.forEach(n=>n.update());
  particles.forEach(p=>p.update());
  updateRipples();

  connections.forEach(c=>c.draw());

  const tips=[];
  connections.forEach(c=>tips.push(...c.getTips()));
  if (tips.length>1&&tips.length<300) drawTipConnections(tips);

  particles.forEach(p=>p.draw());
  nodes.forEach(n=>n.draw());
  drawRipples();

  if (mouse.x>-9000) drawCursor(mouse.x,mouse.y);

  requestAnimationFrame(loop);
}

loop();