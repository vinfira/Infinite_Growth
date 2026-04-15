/* ── Elemente aus dem HTML holen ── */
const canvas = document.getElementById('canvas'); // Holt das Canvas-Element aus dem HTML
const ctx    = canvas.getContext('2d');            // Erstellt den 2D-Zeichenkontext – alle Zeichenbefehle laufen hierüber
const hint   = document.getElementById('hint');   // Referenz auf den ersten Hinweistext
const hint2  = document.getElementById('hint2');  // Referenz auf den zweiten Hinweistext
const stats  = document.getElementById('stats');  // Referenz auf die Statistikanzeige

/* ── Globale Konstanten ── */
const ACCENT     = '#98FF6E';        // Akzentfarbe als Hex-Wert (für einfache Farbangaben)
const ACCENT_RGB = '152,255,110';    // Akzentfarbe als RGB-Zahlen (für rgba() mit Transparenz)
const CONNECT_R  = 190;             // Maximale Distanz in Pixeln, bei der zwei Nodes sich verbinden
const NODE_R     = 3.2;             // Radius des weißen Punktes eines Nodes

/* ── Canvas-Größe auf Fenster setzen ── */
let W = canvas.width  = window.innerWidth;  // Breite: Canvas = Fensterbreite, auch in W gespeichert
let H = canvas.height = window.innerHeight; // Höhe:   Canvas = Fensterhöhe,  auch in H gespeichert

/* ── Globale Listen und Zustandsvariablen ── */
let nodes       = [];               // Liste aller platzierten Node-Objekte
let connections = [];               // Liste aller Verbindungen zwischen Nodes
let particles   = [];               // Liste aller aktiven Partikel
let mouse       = { x:-9999, y:-9999 }; // Aktuelle Mausposition (startet weit außerhalb)
let firstClick  = false;            // Wurde schon einmal geklickt? (steuert Hinweistexte)
let nodeCount   = 0;                // Zähler für eindeutige Node-IDs
let plantCount  = 0;                // Gesamtanzahl bisher gewachsener Pflanzen

/* Passt Canvas-Größe an wenn das Fenster vergrößert oder verkleinert wird */
window.addEventListener('resize', () => {
  W = canvas.width  = window.innerWidth;  // Neue Breite übernehmen
  H = canvas.height = window.innerHeight; // Neue Höhe übernehmen
});


// ════════════════════════════════════════════
// PFLANZENTYP 1: BAUM
// Wächst durch rekursive Verzweigung –
// jeder Ast erzeugt 1–3 Unteräste, bis zur
// maximalen Tiefe. Blätter erscheinen an den Enden.
// ════════════════════════════════════════════

class TreePlant {
  constructor(ox, oy, angle) {       // ox/oy = Ursprungspunkt, angle = Wachstumsrichtung
    this.ox = ox; this.oy = oy;      // Ursprungskoordinaten speichern
    this.opacity = 0;                // Startet unsichtbar (wird beim Einblenden hochgezählt)
    this.fading  = false;            // Ist die Pflanze gerade am Ausblenden?
    this.dead    = false;            // Ist die Pflanze komplett verschwunden und kann gelöscht werden?
    const maxD = 4 + Math.floor(Math.random()*2); // Zufällige maximale Tiefe: 4 oder 5 Ebenen
    const len  = 44 + Math.random()*50;           // Zufällige Länge des ersten Astes (44–94 Pixel)
    this.root  = new TreeSeg(ox, oy, angle, len, 0, maxD); // Erstellt den Wurzelast (Tiefe 0)
  }

  update() {                         // Wird jeden Frame aufgerufen um den Zustand zu aktualisieren
    if (this.fading) {
      this.opacity -= 0.005;         // Langsam ausblenden (0.005 pro Frame ≈ 3 Sekunden bis 0)
      if (this.opacity<=0) this.dead=true; // Wenn komplett unsichtbar: als tot markieren
    } else {
      this.opacity = Math.min(1, this.opacity+0.04); // Einblenden, maximal 1 (= 100% sichtbar)
      this.root.update();            // Wurzelast und alle seine Kinder aktualisieren
    }
  }

  draw() {                           // Zeichnet den Baum auf den Canvas
    if (this.dead) return;           // Tote Bäume werden übersprungen
    ctx.save();                      // Aktuellen Zeichenzustand sichern
    ctx.globalAlpha = Math.max(0, this.opacity); // Globale Transparenz setzen (nie unter 0)
    this.root.draw();                // Wurzelast zeichnen (zeichnet rekursiv alle Äste)
    ctx.restore();                   // Gesicherten Zeichenzustand wiederherstellen
  }

  getTips() {                        // Gibt Positionen aller Blattspitzen zurück
    const a=[]; this.root.collectTips(a); return a;
  }

  fadeOut() { this.fading=true; }    // Startet das Ausblenden der Pflanze
}


class TreeSeg {                      // Ein einzelnes Ast-Segment des Baums
  constructor(sx,sy,angle,len,depth,maxD) { // sx/sy = Startpunkt, depth = wie tief im Baum
    this.sx=sx; this.sy=sy;          // Startkoordinaten dieses Astes
    this.angle=angle;                // Wachstumsrichtung in Radiant (0 = gerade nach oben)
    this.targetLen=len;              // Ziellänge: so lang soll der Ast werden
    this.currentLen=0;               // Aktuelle Länge: startet bei 0, wächst mit jedem Frame
    this.speed = 0.8+(maxD-depth)*0.5+Math.random()*0.4; // Tiefere Äste wachsen langsamer
    this.depth=depth;                // Tiefe dieses Astes (0 = Stamm, maxD = Blatt)
    this.maxD=maxD;                  // Maximale Tiefe des gesamten Baums
    this.strokeW = Math.max(0.2,(maxD-depth+1)*0.82); // Strichdicke: Stamm dicker als Äste
    this.alpha   = 0.28+((maxD-depth)/(maxD+1))*0.72; // Transparenz: Stamm undurchsichtiger
    this.done=false;                 // Ist dieser Ast fertig gewachsen?
    this.children=[];                // Unteräste (leer, werden nach Wachstum erstellt)
    this.isLeaf = depth>=maxD;       // Ist das ein Blatt? (letzter Ast ohne Kinder)
    this.leafProgress=0;             // Fortschritt der Blatt-Animation (0–1)
    const types=['triangle','circle','diamond','dots']; // Mögliche Blattformen
    this.leafType  = types[Math.floor(Math.random()*types.length)]; // Zufällige Blattform
    this.leafAccent = Math.random()<0.22; // 22% Chance: Blatt erscheint in Akzentfarbe (grün)
    this.leafSize   = 3+Math.random()*3.5; // Zufällige Blattgröße (3–6.5)
    this.dotPos=[];                  // Vorberechnete Punkt-Positionen für Blatttyp "dots"
    if (this.leafType==='dots') {    // Nur wenn Blatttyp "dots" gewählt wurde
      const n=4+Math.floor(Math.random()*3); // 4–6 Punkte
      for (let i=0;i<n;i++) {
        const a=(i/n)*Math.PI*2;    // Winkel gleichmäßig auf dem Kreis verteilt
        this.dotPos.push([Math.cos(a),Math.sin(a)]); // X/Y-Einheitsvektor für jeden Punkt
      }
    }
  }

  /* Getter: berechnen aktuelle und finale Endposition des Astes */
  get ex()   { return this.sx+Math.sin(this.angle)*this.currentLen; } // Aktuelles Ende X (wächst)
  get ey()   { return this.sy-Math.cos(this.angle)*this.currentLen; } // Aktuelles Ende Y
  get tipX() { return this.sx+Math.sin(this.angle)*this.targetLen;  } // Finales Ende X
  get tipY() { return this.sy-Math.cos(this.angle)*this.targetLen;  } // Finales Ende Y

  update() {                         // Ast wachsen lassen und Kinder aktualisieren
    if (!this.done) {
      this.currentLen = Math.min(this.targetLen, this.currentLen+this.speed); // Länge erhöhen
      if (this.currentLen>=this.targetLen) {
        this.done=true;              // Ast hat Ziellänge erreicht
        if (!this.isLeaf) this.spawn(); // Wenn kein Blatt: Unteräste erzeugen
      }
    } else if (this.isLeaf) {
      this.leafProgress = Math.min(1, this.leafProgress+0.025); // Blatt langsam einblenden
    }
    this.children.forEach(c=>c.update()); // Alle Unteräste ebenfalls aktualisieren
  }

  spawn() {                          // Erzeugt 1–3 Unteräste an der Spitze dieses Astes
    const r=Math.random();
    const n = this.depth===0 ? 1    // Stamm (Tiefe 0): immer nur 1 Ast → gerader Stamm
            : r<0.5 ? 2             // 50% Chance: 2 Unteräste
            : r<0.85 ? 3            // 35% Chance: 3 Unteräste
            : 1;                    // 15% Chance: 1 Unterast (gerader Ast)
    const spd = 0.3+Math.random()*0.44;               // Zufällige Spreizung der Unteräste
    const nl  = this.targetLen*(0.5+Math.random()*0.3); // Unteräste sind 50–80% so lang
    const offsets = n===1 ? [(Math.random()-0.5)*0.5]    // 1 Kind: leicht zufälliger Winkel
                  : n===2 ? [-spd, spd]                   // 2 Kinder: links und rechts
                  : [-spd, (Math.random()-0.5)*0.2, spd]; // 3 Kinder: links, mitte, rechts
    offsets.forEach(off =>
      this.children.push(new TreeSeg(
        this.tipX, this.tipY,        // Kind startet an der Spitze des Elternastes
        this.angle+off+(Math.random()-0.5)*0.1, // Winkel + Versatz + kleine Zufälligkeit
        nl*(0.9+Math.random()*0.2),  // Leicht zufällige Länge
        this.depth+1, this.maxD      // Eine Ebene tiefer, gleiche Maximaltiefe
      ))
    );
  }

  draw() {                           // Zeichnet diesen Ast und sein Blatt
    ctx.save();
    ctx.strokeStyle=`rgba(255,255,255,${this.alpha})`; // Weiß mit berechneter Transparenz
    ctx.lineWidth=this.strokeW; ctx.lineCap='round';   // Strichdicke, abgerundete Enden
    ctx.beginPath();
    ctx.moveTo(this.sx,this.sy);     // Startpunkt des Astes
    ctx.lineTo(this.ex,this.ey);     // Endpunkt (aktuell, wächst noch)
    ctx.stroke();                    // Linie zeichnen
    ctx.restore();

    // Kleiner Punkt an Verzweigungsstellen (nicht am Stamm, nicht an Blättern)
    if (this.done && !this.isLeaf && this.depth>0) {
      ctx.save();
      ctx.fillStyle=`rgba(255,255,255,${this.alpha*0.5})`; // Halbtransparenter Punkt
      ctx.beginPath();
      ctx.arc(this.tipX,this.tipY,this.strokeW*0.8,0,Math.PI*2); // Kleiner Kreis
      ctx.fill();
      ctx.restore();
    }

    // Blatt zeichnen (nur wenn fertig gewachsen und Fortschritt > 0)
    if (this.done && this.isLeaf && this.leafProgress>0) {
      const s   = this.leafSize * this.leafProgress; // Aktuelle Blattgröße (wächst mit Fortschritt)
      const col = this.leafAccent ? ACCENT : 'rgba(255,255,255,0.82)'; // Grün oder Weiß
      ctx.save();
      ctx.translate(this.tipX, this.tipY); // Koordinatensystem an Blattspitze verschieben
      ctx.rotate(this.angle);              // Blatt in Wachstumsrichtung drehen
      ctx.fillStyle=col;
      if (this.leafAccent){ctx.shadowColor=ACCENT;ctx.shadowBlur=13;} // Grüner Leuchteffekt
      switch(this.leafType) {
        case 'triangle':                   // Dreieck-Blatt
          ctx.beginPath();
          ctx.moveTo(0,-s*1.9);            // Spitze oben
          ctx.lineTo(-s*0.9,s*0.8);        // Unten links
          ctx.lineTo(s*0.9,s*0.8);         // Unten rechts
          ctx.closePath(); ctx.fill(); break;
        case 'circle':                     // Kreis-Blatt
          ctx.beginPath(); ctx.arc(0,0,s,0,Math.PI*2); ctx.fill(); break;
        case 'diamond':                    // Raute-Blatt
          ctx.beginPath();
          ctx.moveTo(0,-s*1.8);            // Oben
          ctx.lineTo(s*0.85,0);            // Rechts
          ctx.lineTo(0,s*1.8);             // Unten
          ctx.lineTo(-s*0.85,0);           // Links
          ctx.closePath(); ctx.fill(); break;
        case 'dots':                       // Punkte-Cluster als Blatt
          this.dotPos.forEach(([cx,cy])=>{
            ctx.beginPath();
            ctx.arc(cx*s*1.3,cy*s*1.3,s*0.38,0,Math.PI*2); // Äußere Punkte
            ctx.fill();
          });
          ctx.beginPath(); ctx.arc(0,0,s*0.4,0,Math.PI*2); ctx.fill(); break; // Mittelpunkt
      }
      ctx.restore();
    }
    this.children.forEach(c=>c.draw()); // Alle Unteräste ebenfalls zeichnen (Rekursion)
  }

  collectTips(arr) {                 // Sammelt Blattspitzen-Koordinaten für Verbindungslinien
    if (this.isLeaf&&this.leafProgress>0.4) // Nur wenn Blatt bereits zu >40% sichtbar
      arr.push({x:this.tipX, y:this.tipY});
    this.children.forEach(c=>c.collectTips(arr)); // Rekursiv bei allen Unterästen
  }
}


// ════════════════════════════════════════════
// PFLANZENTYP 2: BLUME
// Stiel wächst nach oben, danach entfalten
// sich Ellipsen-Blütenblätter. Optional
// wachsen kleine Seitenblüten am Stiel.
// ════════════════════════════════════════════

class FlowerPlant {
  constructor(ox, oy, angle) {
    this.ox=ox; this.oy=oy; this.angle=angle; // Ursprungsposition und Wachstumsrichtung
    this.opacity=0; this.fading=false; this.dead=false; // Startzustand
    this.stemLen=0;                            // Aktuelle Stiellänge (wächst mit jedem Frame)
    this.stemTarget=35+Math.random()*45;       // Ziel-Stiellänge: 35–80 Pixel
    this.stemSpeed=1.2+Math.random()*0.8;      // Wachstumsgeschwindigkeit des Stiels
    this.stemDone=false;                       // Ist der Stiel fertig gewachsen?
    const n=5+Math.floor(Math.random()*4);     // Anzahl Blütenblätter: 5–8
    this.petalCount=n;                         // Anzahl speichern
    this.petalSize=8+Math.random()*10;         // Blütenblattgröße: 8–18 Pixel
    this.petalProgress=0;                      // Blüh-Fortschritt (0 = Knospe, 1 = voll erblüht)
    this.centerSize=3+Math.random()*3;         // Größe des Blütenzentrums
    this.accent=Math.random()<0.3;             // 30% Chance: grüne Akzentfarbe
    this.lean=(Math.random()-0.5)*0.5;         // Leichte zufällige Neigung des Stiels
    this.buds=[];                              // Array für Seitenblüten
    if (Math.random()<0.55) {                  // 55% Chance: Seitenblüten erzeugen
      const nb=1+Math.floor(Math.random()*2);  // 1–2 Seitenblüten
      for (let i=0;i<nb;i++) {
        this.buds.push({
          t: 0.35+Math.random()*0.4,           // Position am Stiel (35–75% der Stielhöhe)
          side: Math.random()<0.5?1:-1,         // Links oder rechts
          stemLen:0, stemTarget:15+Math.random()*18, // Kurzer Seitenstiel
          stemSpeed:0.8+Math.random()*0.5, stemDone:false,
          petalProgress:0, petalSize:4+Math.random()*5,
          petalCount:4+Math.floor(Math.random()*3),
          accent:Math.random()<0.2              // 20% Chance: grüne Seitenblüte
        });
      }
    }
  }

  /* Aktuelle und finale Stielspitze berechnen */
  get tipX()     { return this.ox+Math.sin(this.angle+this.lean)*this.stemLen;    } // Aktuelle Spitze X
  get tipY()     { return this.oy-Math.cos(this.angle+this.lean)*this.stemLen;    } // Aktuelle Spitze Y
  get fullTipX() { return this.ox+Math.sin(this.angle+this.lean)*this.stemTarget; } // Finale Spitze X
  get fullTipY() { return this.oy-Math.cos(this.angle+this.lean)*this.stemTarget; } // Finale Spitze Y

  update() {
    if (this.fading) { this.opacity-=0.005; if(this.opacity<=0) this.dead=true; return; } // Ausblenden
    this.opacity=Math.min(1,this.opacity+0.04); // Einblenden
    if (!this.stemDone) {
      this.stemLen=Math.min(this.stemTarget,this.stemLen+this.stemSpeed); // Stiel wächst
      if (this.stemLen>=this.stemTarget) this.stemDone=true; // Fertig wenn Ziel erreicht
    } else {
      this.petalProgress=Math.min(1,this.petalProgress+0.028); // Stiel fertig: Blüte öffnet sich
    }
    this.buds.forEach(b=>{                     // Alle Seitenblüten aktualisieren
      const bx=this.ox+Math.sin(this.angle+this.lean)*this.stemTarget*b.t; // X-Position am Stiel
      const by=this.oy-Math.cos(this.angle+this.lean)*this.stemTarget*b.t; // Y-Position am Stiel
      if (this.stemLen>=this.stemTarget*b.t) { // Erst wachsen wenn Hauptstiel dort angekommen
        if (!b.stemDone) {
          b.stemLen=Math.min(b.stemTarget,b.stemLen+b.stemSpeed); // Seitenstiel wächst
          if (b.stemLen>=b.stemTarget) b.stemDone=true;
        } else { b.petalProgress=Math.min(1,b.petalProgress+0.022); } // Seitenblüte öffnet sich
      }
      b.bx=bx; b.by=by; // Koordinaten für draw() speichern
    });
  }

  drawFlowerHead(cx,cy,size,petalCount,petalProgress,accent,scale=1) { // Zeichnet einen Blütenkopf
    if (petalProgress<=0) return;    // Noch nicht sichtbar → abbrechen
    const s  =size*petalProgress*scale; // Aktuelle Größe skaliert mit Fortschritt
    const col=accent?ACCENT:'rgba(255,255,255,0.84)'; // Grün oder Weiß
    ctx.save();
    ctx.translate(cx,cy);            // Koordinatensystem zur Blütenmitte verschieben
    ctx.fillStyle=col;
    if (accent){ctx.shadowColor=ACCENT;ctx.shadowBlur=14;} // Grüner Schein
    else {ctx.shadowColor='rgba(255,255,255,0.2)';ctx.shadowBlur=5;} // Weißer Schein
    for (let i=0;i<petalCount;i++) { // Jedes Blütenblatt einzeln zeichnen
      const a=(i/petalCount)*Math.PI*2; // Winkel gleichmäßig um den Kreis verteilt
      ctx.save(); ctx.rotate(a);     // Koordinatensystem für dieses Blütenblatt drehen
      ctx.beginPath();
      ctx.ellipse(0,-s*1.1,s*0.42,s,0,0,Math.PI*2); // Ellipse: schmal und lang = Blütenblatt
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle=accent?'rgba(255,255,255,0.95)':ACCENT; // Blütenzentrum in Kontrastfarbe
    ctx.shadowColor=ACCENT; ctx.shadowBlur=10;
    ctx.beginPath(); ctx.arc(0,0,s*0.48,0,Math.PI*2); ctx.fill(); // Blütenzentrum als Kreis
    ctx.restore();
  }

  draw() {
    if (this.dead) return;
    ctx.save(); ctx.globalAlpha=Math.max(0,this.opacity);
    ctx.strokeStyle='rgba(255,255,255,0.55)'; // Stielfarbe: halb-transparentes Weiß
    ctx.lineWidth=1.2; ctx.lineCap='round';
    ctx.beginPath();
    ctx.moveTo(this.ox,this.oy); ctx.lineTo(this.tipX,this.tipY); // Stiel zeichnen
    ctx.stroke();
    this.buds.forEach(b=>{           // Alle Seitenblüten zeichnen
      if (!b.bx) return;             // Noch nicht initialisiert
      const budTipX=b.bx+Math.sin(this.angle+b.side*0.9)*b.stemLen; // Spitze des Seitenstiels X
      const budTipY=b.by-Math.cos(this.angle+b.side*0.9)*b.stemLen; // Spitze des Seitenstiels Y
      ctx.strokeStyle='rgba(255,255,255,0.35)'; // Dünner Seitenstiel
      ctx.lineWidth=0.7; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(b.bx,b.by); ctx.lineTo(budTipX,budTipY); ctx.stroke();
      this.drawFlowerHead(budTipX,budTipY,b.petalSize,b.petalCount,b.petalProgress,b.accent,0.85); // Seitenblüte zeichnen
    });
    this.drawFlowerHead(this.fullTipX,this.fullTipY,this.petalSize,this.petalCount,this.petalProgress,this.accent,1); // Hauptblüte zeichnen
    ctx.restore();
  }

  getTips() {
    if (this.petalProgress>0.5) return [{x:this.fullTipX,y:this.fullTipY}]; // Blütenmitte als Spitze
    return [];
  }
  fadeOut() { this.fading=true; }
}


// ════════════════════════════════════════════
// PFLANZENTYP 3: GRAS
// Mehrere dünne Halme wachsen in leicht
// unterschiedlichen Winkeln. Dreieck-Spitze
// erscheint am Ende jedes Halms.
// ════════════════════════════════════════════

class GrassPlant {
  constructor(ox, oy, angle) {
    this.ox=ox; this.oy=oy; this.angle=angle;
    this.opacity=0; this.fading=false; this.dead=false;
    const count=3+Math.floor(Math.random()*5); // 3–7 Grashalme
    this.blades=[];                            // Array für alle Halme
    for (let i=0;i<count;i++) {
      const spread=(Math.random()-0.5)*0.9;    // Zufällige Spreizung (Winkelabweichung)
      const len=22+Math.random()*40;           // Halmlänge: 22–62 Pixel
      this.blades.push({
        angle:    angle+spread,      // Halm-Winkel = Basiswinkel + zufällige Spreizung
        targetLen: len,              // Ziellänge des Halms
        currentLen: 0,               // Aktuelle Länge, wächst mit jedem Frame
        speed:    0.7+Math.random()*0.8, // Wachstumsgeschwindigkeit
        strokeW:  0.6+Math.random()*0.8, // Strichdicke: sehr dünn (Gras!)
        alpha:    0.35+Math.random()*0.5, // Zufällige Transparenz
        done:     false,             // Ist dieser Halm fertig gewachsen?
        tipProgress: 0,              // Fortschritt der Dreieck-Spitze (0–1)
        accent:   Math.random()<0.15 // 15% Chance: grüne Dreieck-Spitze
      });
    }
  }

  update() {
    if (this.fading) { this.opacity-=0.006; if(this.opacity<=0) this.dead=true; return; }
    this.opacity=Math.min(1,this.opacity+0.05); // Etwas schneller einblenden als andere Typen
    this.blades.forEach(b=>{
      if (!b.done) {
        b.currentLen=Math.min(b.targetLen,b.currentLen+b.speed); // Halm wächst
        if (b.currentLen>=b.targetLen) b.done=true; // Fertig wenn Ziellänge erreicht
      } else {
        b.tipProgress=Math.min(1,b.tipProgress+0.03); // Dreieck-Spitze erscheint
      }
    });
  }

  draw() {
    if (this.dead) return;
    ctx.save(); ctx.globalAlpha=Math.max(0,this.opacity);
    this.blades.forEach(b=>{
      const tx=this.ox+Math.sin(b.angle)*b.currentLen; // Aktuelle Halmspitze X
      const ty=this.oy-Math.cos(b.angle)*b.currentLen; // Aktuelle Halmspitze Y
      ctx.strokeStyle=`rgba(255,255,255,${b.alpha})`; // Halm-Farbe mit individueller Transparenz
      ctx.lineWidth=b.strokeW; ctx.lineCap='round';
      ctx.beginPath(); ctx.moveTo(this.ox,this.oy); ctx.lineTo(tx,ty); ctx.stroke(); // Halm zeichnen
      if (b.done&&b.tipProgress>0) { // Dreieck-Spitze zeichnen wenn Halm fertig
        const s  =2.5*b.tipProgress; // Größe wächst mit Fortschritt
        const col=b.accent?ACCENT:`rgba(255,255,255,${b.alpha})`; // Grün oder Halmfarbe
        ctx.save();
        ctx.translate(tx,ty);        // Zur Halmspitze verschieben
        ctx.rotate(b.angle);         // In Halmrichtung drehen
        ctx.fillStyle=col;
        if (b.accent){ctx.shadowColor=ACCENT;ctx.shadowBlur=10;} // Grüner Schein
        ctx.beginPath();
        ctx.moveTo(0,-s*2);          // Dreieckspitze oben
        ctx.lineTo(-s*0.7,s);        // Unten links
        ctx.lineTo(s*0.7,s);         // Unten rechts
        ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    });
    ctx.restore();
  }

  getTips() {                        // Finale Spitzenpositionen aller fertigen Halme
    return this.blades.filter(b=>b.tipProgress>0.5).map(b=>({
      x:this.ox+Math.sin(b.angle)*b.targetLen,
      y:this.oy-Math.cos(b.angle)*b.targetLen
    }));
  }
  fadeOut() { this.fading=true; }
}


// ════════════════════════════════════════════
// PFLANZENTYP 4: PILZ
// Dicker Stiel wächst nach oben, dann klappt
// ein Halbkreis-Kappe darüber. Punkte auf
// der Kappe. Optional kleine Pilze daneben.
// ════════════════════════════════════════════

class MushroomPlant {
  constructor(ox, oy, angle) {
    this.ox=ox; this.oy=oy; this.angle=angle;
    this.opacity=0; this.fading=false; this.dead=false;
    this.stemH=0;                            // Aktuelle Stielhöhe (wächst hoch)
    this.stemTarget=20+Math.random()*30;     // Ziel-Stielhöhe: 20–50 Pixel
    this.stemW=4+Math.random()*5;            // Stielbreite: 4–9 Pixel (dicker als Gras)
    this.stemSpeed=0.8+Math.random()*0.5;    // Wachstumsgeschwindigkeit
    this.stemDone=false;                     // Ist der Stiel fertig?
    this.capProgress=0;                      // Fortschritt der Kappe (0–1)
    this.capR=12+Math.random()*16;           // Kappenradius: 12–28 Pixel
    this.accent=Math.random()<0.3;           // 30% Chance auf grüne Kappe
    const nd=3+Math.floor(Math.random()*4);  // 3–6 Punkte auf der Kappe
    this.capDots=[];
    for (let i=0;i<nd;i++) {
      const a=(Math.random()-0.5)*0.85;      // Zufälliger Winkel (nicht ganz am Rand)
      const r=0.3+Math.random()*0.55;        // Zufälliger Abstand vom Mittelpunkt
      this.capDots.push({a,r,size:1+Math.random()*2}); // Punkt-Daten speichern
    }
    this.cluster=[];                         // Kleine Pilze daneben
    if (Math.random()<0.5) {                 // 50% Chance auf Begleitpilze
      const nc=1+Math.floor(Math.random()*2); // 1–2 kleine Pilze
      for(let i=0;i<nc;i++) {
        this.cluster.push({
          ox: ox+(Math.random()-0.5)*22,     // Versetzt links oder rechts
          stemH:0, stemTarget:10+Math.random()*16, stemW:2+Math.random()*3,
          stemSpeed:0.6+Math.random()*0.4, stemDone:false, capProgress:0,
          capR:5+Math.random()*9, accent:false,
          delay:8+Math.random()*12,          // Kleiner Pilz wächst mit Verzögerung
          delayCount:0                       // Zählt Frames bis Verzögerung abgelaufen
        });
      }
    }
  }

  get tipY()     { return this.oy-this.stemH;      } // Aktuelle Stielspitze Y
  get fullTipY() { return this.oy-this.stemTarget; } // Finale Stielspitze Y

  update() {
    if (this.fading) { this.opacity-=0.005; if(this.opacity<=0) this.dead=true; return; }
    this.opacity=Math.min(1,this.opacity+0.04);
    if (!this.stemDone) {
      this.stemH=Math.min(this.stemTarget,this.stemH+this.stemSpeed); // Stiel wächst
      if (this.stemH>=this.stemTarget) this.stemDone=true;
    } else {
      this.capProgress=Math.min(1,this.capProgress+0.025); // Kappe klappt auf
    }
    this.cluster.forEach(m=>{
      if (m.delayCount<m.delay) { m.delayCount++; return; } // Warten bis Verzögerung abgelaufen
      if (!m.stemDone) {
        m.stemH=Math.min(m.stemTarget,m.stemH+m.stemSpeed); // Kleiner Stiel wächst
        if (m.stemH>=m.stemTarget) m.stemDone=true;
      } else { m.capProgress=Math.min(1,m.capProgress+0.022); } // Kleine Kappe klappt auf
    });
  }

  drawMushroom(ox,oy,stemH,stemW,capR,capProgress,accent,dots) { // Zeichnet einen einzelnen Pilz
    ctx.strokeStyle='rgba(255,255,255,0.5)'; // Stielfarbe
    ctx.lineWidth=stemW; ctx.lineCap='round'; // Dicke Linie mit runden Enden = Pilzstiel
    ctx.beginPath(); ctx.moveTo(ox,oy); ctx.lineTo(ox,oy-stemH); ctx.stroke(); // Stiel zeichnen
    if (capProgress<=0) return;      // Keine Kappe wenn noch nicht gestartet
    const cy=oy-stemH;               // Y-Position der Kappenunterseite
    const r=capR*capProgress;        // Aktuelle Kappengröße
    const col=accent?ACCENT:'rgba(255,255,255,0.85)';
    ctx.fillStyle=col;
    if (accent){ctx.shadowColor=ACCENT;ctx.shadowBlur=14;}
    ctx.beginPath();
    ctx.arc(ox,cy,r,Math.PI,0);      // Halbkreis von links (π) nach rechts (0) = Pilzkappe
    ctx.closePath(); ctx.fill();     // Halbkreis schließen und füllen
    if (dots) {                      // Punkte auf der Kappe zeichnen
      ctx.fillStyle=accent?'rgba(0,0,0,0.55)':'rgba(0,0,0,0.45)'; // Dunkle Punkte auf der Kappe
      dots.forEach(d=>{
        const dx=Math.sin(d.a)*r*d.r;       // X-Position des Punktes auf der Kappe
        const dy=-Math.cos(d.a)*r*d.r*0.5;  // Y-Position (flacher wegen Halbkreis)
        ctx.beginPath(); ctx.arc(ox+dx,cy+dy,d.size*capProgress,0,Math.PI*2); ctx.fill();
      });
    }
    ctx.strokeStyle='rgba(255,255,255,0.18)'; // Lamellen: dünne Linie unter der Kappe
    ctx.lineWidth=0.6;
    ctx.beginPath(); ctx.moveTo(ox-r*0.9,cy); ctx.lineTo(ox+r*0.9,cy); ctx.stroke();
  }

  draw() {
    if (this.dead) return;
    ctx.save(); ctx.globalAlpha=Math.max(0,this.opacity);
    this.cluster.forEach(m=>{        // Kleine Pilze zuerst (= im Hintergrund)
      this.drawMushroom(m.ox,this.oy,m.stemH,m.stemW,m.capR,m.capProgress,m.accent,null);
    });
    this.drawMushroom(this.ox,this.oy,this.stemH,this.stemW,this.capR,this.capProgress,this.accent,this.capDots); // Hauptpilz zeichnen
    ctx.restore();
  }

  getTips() {
    if (this.capProgress>0.5) return [{x:this.ox,y:this.fullTipY-this.capR}]; // Oberste Punkt der Kappe
    return [];
  }
  fadeOut() { this.fading=true; }
}


// ════════════════════════════════════════════
// PFLANZENTYP 5: LÖWENZAHN
// Stiel wächst hoch, danach erscheinen viele
// kurze Linien radial um die Spitze (Pusteblume).
// Jede Linie hat einen kleinen Punkt am Ende.
// ════════════════════════════════════════════

class DandelionPlant {
  constructor(ox, oy, angle) {
    this.ox=ox; this.oy=oy; this.angle=angle;
    this.opacity=0; this.fading=false; this.dead=false;
    this.stemLen=0;
    this.stemTarget=30+Math.random()*40; // Stiellänge: 30–70 Pixel
    this.stemSpeed=1+Math.random()*0.6;
    this.stemDone=false;
    const n=12+Math.floor(Math.random()*10); // 12–21 Strahllinien
    this.rayCount=n;
    this.rayLen=14+Math.random()*12;         // Strahlenlänge: 14–26 Pixel
    this.rayProgress=0;                      // Fortschritt der Strahlen (0–1)
    this.accent=Math.random()<0.35;          // 35% Chance auf grüne Strahlen
    this.lean=(Math.random()-0.5)*0.45;      // Leichte Neigung des Stiels
  }

  get tipX() { return this.ox+Math.sin(this.angle+this.lean)*this.stemTarget; } // Mittelpunkt der Pusteblume X
  get tipY() { return this.oy-Math.cos(this.angle+this.lean)*this.stemTarget; } // Mittelpunkt der Pusteblume Y

  update() {
    if (this.fading) { this.opacity-=0.005; if(this.opacity<=0) this.dead=true; return; }
    this.opacity=Math.min(1,this.opacity+0.04);
    if (!this.stemDone) {
      this.stemLen=Math.min(this.stemTarget,this.stemLen+this.stemSpeed); // Stiel wächst
      if (this.stemLen>=this.stemTarget) this.stemDone=true;
    } else {
      this.rayProgress=Math.min(1,this.rayProgress+0.022); // Strahlen wachsen heraus
    }
  }

  draw() {
    if (this.dead) return;
    ctx.save(); ctx.globalAlpha=Math.max(0,this.opacity);
    const curTipX=this.ox+Math.sin(this.angle+this.lean)*this.stemLen; // Aktuelle Stielspitze X
    const curTipY=this.oy-Math.cos(this.angle+this.lean)*this.stemLen; // Aktuelle Stielspitze Y
    ctx.strokeStyle='rgba(255,255,255,0.5)'; ctx.lineWidth=0.9; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(this.ox,this.oy); ctx.lineTo(curTipX,curTipY); ctx.stroke(); // Stiel zeichnen
    if (this.rayProgress>0) {
      const col=this.accent?ACCENT:'rgba(255,255,255,0.78)';
      ctx.strokeStyle=col; ctx.lineWidth=0.7;
      if (this.accent){ctx.shadowColor=ACCENT;ctx.shadowBlur=10;}
      for (let i=0;i<this.rayCount;i++) { // Alle Strahlen gleichmäßig im Kreis verteilen
        const a=(i/this.rayCount)*Math.PI*2; // Winkel dieses Strahls
        const rl=this.rayLen*this.rayProgress; // Aktuelle Strahlenlänge
        const ex=this.tipX+Math.cos(a)*rl;    // Strahlen-Endpunkt X
        const ey=this.tipY+Math.sin(a)*rl;    // Strahlen-Endpunkt Y
        ctx.beginPath(); ctx.moveTo(this.tipX,this.tipY); ctx.lineTo(ex,ey); ctx.stroke(); // Strahl zeichnen
        ctx.fillStyle=col;
        ctx.beginPath(); ctx.arc(ex,ey,1.3*this.rayProgress,0,Math.PI*2); ctx.fill(); // Punkt am Strahlenende
      }
      ctx.fillStyle=this.accent?'rgba(255,255,255,0.9)':ACCENT; // Mittelpunkt in Kontrastfarbe
      ctx.shadowColor=ACCENT; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.arc(this.tipX,this.tipY,2.5*this.rayProgress,0,Math.PI*2); ctx.fill(); // Mittelpunkt zeichnen
    }
    ctx.restore();
  }

  getTips() {
    if (this.rayProgress>0.5) return [{x:this.tipX,y:this.tipY}]; // Mittelpunkt als Spitze
    return [];
  }
  fadeOut() { this.fading=true; }
}


// ════════════════════════════════════════════
// FACTORY-FUNKTION
// Wählt zufällig einen Pflanzentyp aus und
// erstellt ihn. Baum und Blume sind doppelt
// gewichtet (erscheinen häufiger).
// ════════════════════════════════════════════

const PLANT_TYPES=['tree','tree','flower','flower','grass','mushroom','dandelion']; // Gewichtete Liste

function makePlant(ox,oy,angle) {    // Erstellt eine zufällige Pflanze an Position ox/oy
  const type=PLANT_TYPES[Math.floor(Math.random()*PLANT_TYPES.length)]; // Zufälligen Typ wählen
  switch(type) {
    case 'flower':    return new FlowerPlant(ox,oy,angle);
    case 'grass':     return new GrassPlant(ox,oy,angle);
    case 'mushroom':  return new MushroomPlant(ox,oy,angle);
    case 'dandelion': return new DandelionPlant(ox,oy,angle);
    default:          return new TreePlant(ox,oy,angle); // Fallback: Baum
  }
}


// ════════════════════════════════════════════
// PARTIKEL
// Kleine Punkte die beim Entstehen einer
// Verbindung aufsprühen, durch Schwerkraft
// nach unten fallen und langsam verblassen.
// ════════════════════════════════════════════

class Particle {
  constructor(ax,ay,bx,by) {         // ax/ay = Startpunkt, bx/by = Endpunkt der Verbindungslinie
    const t=Math.random();           // Zufällige Position entlang der Linie (0–1)
    this.x=ax+(bx-ax)*t;             // X: irgendwo zwischen A und B
    this.y=ay+(by-ay)*t;             // Y: irgendwo zwischen A und B
    const dx=bx-ax, dy=by-ay;
    const len=Math.sqrt(dx*dx+dy*dy)||1; // Länge der Verbindungslinie
    const nx=dx/len, ny=dy/len;      // Richtungsvektor normalisiert (Länge = 1)
    const perp=(Math.random()-0.5)*1.8; // Zufällige seitliche Ablenkung
    this.vx=nx*(0.4+Math.random()*1.2)+(-ny)*perp; // Geschwindigkeit X: entlang + quer der Linie
    this.vy=ny*(0.4+Math.random()*1.2)+nx*perp-(0.3+Math.random()*0.5); // Geschwindigkeit Y: etwas nach oben
    this.alpha=0.6+Math.random()*0.4;  // Startdurchsichtigkeit
    this.size=0.8+Math.random()*1.8;   // Partikelgröße
    this.decay=0.008+Math.random()*0.012; // Wie schnell der Partikel verschwindet
    this.accent=Math.random()<0.25;    // 25% Chance: grüner Partikel
  }

  update() {
    this.x+=this.vx; this.y+=this.vy; // Position nach Geschwindigkeit verschieben
    this.vy+=0.018;                    // Schwerkraft: zieht Partikel nach unten
    this.alpha-=this.decay;            // Partikel wird langsam unsichtbar
  }

  draw() {
    if (this.alpha<=0) return;         // Unsichtbare Partikel nicht zeichnen
    const col=this.accent
      ?`rgba(${ACCENT_RGB},${this.alpha})` // Grüner Partikel
      :`rgba(255,255,255,${this.alpha})`;  // Weißer Partikel
    ctx.fillStyle=col;
    ctx.beginPath(); ctx.arc(this.x,this.y,this.size,0,Math.PI*2); ctx.fill();
  }

  get dead() { return this.alpha<=0; } // Gilt als tot wenn komplett transparent
}

function spawnParticles(ax,ay,bx,by) { // Erzeugt mehrere Partikel entlang einer Linie
  const dx=bx-ax, dy=by-ay;
  const dist=Math.sqrt(dx*dx+dy*dy);              // Länge der Linie
  const count=Math.min(60,18+Math.floor(dist/12)); // Mehr Partikel bei längeren Linien, max 60
  for (let i=0;i<count;i++) particles.push(new Particle(ax,ay,bx,by)); // Partikel erstellen
}


// ════════════════════════════════════════════
// VERBINDUNG (CONNECTION)
// Verwaltet die animierte gestrichelte Linie
// zwischen zwei Nodes sowie alle Pflanzen
// die entlang der Linie wachsen.
// ════════════════════════════════════════════

class Connection {
  constructor(nA,nB) {               // nA und nB = die zwei verbundenen Nodes
    this.a=nA; this.b=nB;            // Referenzen auf die Nodes speichern
    this.lineProgress=0;             // Fortschritt der Linienzeichnung (0–1)
    this.alpha=0;                    // Transparenz der Linie
    this.fading=false; this.dead=false;
    this.plants=[]; this.spawned=false; // Pflanzen-Array + ob sie schon erzeugt wurden
    const dx=nB.x-nA.x, dy=nB.y-nA.y;
    this.len=Math.sqrt(dx*dx+dy*dy); // Länge der Verbindungslinie in Pixeln
    this.lineAngle=Math.atan2(dx,-dy); // Winkel der Linie (für senkrechtes Pflanzenwachstum)
    this.particlesDone=false;        // Wurden Partikel schon ausgelöst?
  }

  spawnPlants() {                    // Erzeugt Pflanzen entlang der Linie
    if (this.spawned) return;        // Nicht doppelt ausführen
    this.spawned=true;
    const count=1+Math.floor(this.len/95); // 1 Pflanze pro ~95 Pixel Linienlänge
    for (let i=0;i<count;i++) {
      const t=count===1?0.5:0.2+(i/(count-1))*0.6; // Position auf der Linie (20%–80%)
      const ox=this.a.x+(this.b.x-this.a.x)*t;     // X-Ursprung der Pflanze
      const oy=this.a.y+(this.b.y-this.a.y)*t;     // Y-Ursprung der Pflanze
      const perp=this.lineAngle+Math.PI/2*(Math.random()<0.5?1:-1); // Senkrecht zur Linie
      this.plants.push(makePlant(ox,oy,perp+(Math.random()-0.5)*0.55)); // Pflanze erzeugen
    }
    plantCount+=count;               // Globalen Zähler erhöhen
    updateStats();                   // Anzeige aktualisieren
  }

  update() {
    if (this.fading) {
      this.alpha-=0.005;             // Linie verblasst
      this.plants.forEach(p=>p.fadeOut()); // Alle Pflanzen auch ausblenden
      if (this.alpha<=0) this.dead=true;
    } else {
      this.lineProgress=Math.min(1,this.lineProgress+0.028); // Linie zeichnet sich animiert
      this.alpha=Math.min(0.35,this.alpha+0.015);            // Linie wird sichtbar (max 35%)
      if (this.lineProgress>=1) {    // Linie komplett gezeichnet:
        if (!this.particlesDone) {
          spawnParticles(this.a.x,this.a.y,this.b.x,this.b.y); // Partikel einmalig auslösen
          this.particlesDone=true;
        }
        if (!this.spawned) this.spawnPlants(); // Pflanzen einmalig erzeugen
      }
    }
    this.plants.forEach(p=>p.update());         // Alle Pflanzen aktualisieren
    this.plants=this.plants.filter(p=>!p.dead); // Tote Pflanzen entfernen
  }

  draw() {
    if (this.dead) return;
    const ex=this.a.x+(this.b.x-this.a.x)*this.lineProgress; // Animierter Endpunkt X
    const ey=this.a.y+(this.b.y-this.a.y)*this.lineProgress; // Animierter Endpunkt Y
    ctx.save();
    ctx.strokeStyle=`rgba(255,255,255,${this.alpha})`; // Weiß, leicht transparent
    ctx.lineWidth=0.8; ctx.lineCap='round';
    ctx.setLineDash([4,6]);          // Gestrichelte Linie: 4px Strich, 6px Lücke
    ctx.beginPath(); ctx.moveTo(this.a.x,this.a.y); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.setLineDash([]);             // Strichelung zurücksetzen
    ctx.restore();
    this.plants.forEach(p=>p.draw()); // Alle Pflanzen dieser Verbindung zeichnen
  }

  getTips() {                        // Alle Blattspitzen aller Pflanzen dieser Verbindung
    const a=[]; this.plants.forEach(p=>a.push(...p.getTips())); return a;
  }
  fadeOut() { this.fading=true; }
}


// ════════════════════════════════════════════
// NODE – ein platzierter Punkt
// Pulsierender Ring-Effekt, blendet sanft ein.
// ════════════════════════════════════════════

class Node {
  constructor(x,y,id) {
    this.x=x; this.y=y;              // Position des Nodes
    this.id=id;                      // Eindeutige ID (wichtig für Verbindungsprüfung)
    this.alpha=0;                    // Startet unsichtbar
    this.pulse=0;                    // Puls-Phase, läuft in einer Endlosschleife
    this.fading=false; this.dead=false;
  }

  update() {
    if (this.fading) {
      this.alpha-=0.01;              // Schneller ausblenden als Pflanzen
      if(this.alpha<=0) this.dead=true;
    } else {
      this.alpha=Math.min(1,this.alpha+0.06);         // Einblenden
      this.pulse=(this.pulse+0.04)%(Math.PI*2);       // Puls-Phase voranschreiten (Modulo = Endlosschleife)
    }
  }

  draw() {
    if (this.dead) return;
    ctx.save(); ctx.globalAlpha=Math.max(0,this.alpha);
    const pr=NODE_R+4+Math.sin(this.pulse)*2.5; // Pulsierender Ring-Radius (schwingt mit sin)
    ctx.strokeStyle=`rgba(255,255,255,${0.1+Math.sin(this.pulse)*0.06})`; // Transparenz pulsiert auch
    ctx.lineWidth=0.6;
    ctx.beginPath(); ctx.arc(this.x,this.y,pr,0,Math.PI*2); ctx.stroke(); // Pulsierender Ring
    ctx.fillStyle='#fff'; ctx.shadowColor='rgba(255,255,255,0.7)'; ctx.shadowBlur=10; // Weißer Leuchteffekt
    ctx.beginPath(); ctx.arc(this.x,this.y,NODE_R,0,Math.PI*2); ctx.fill(); // Kern-Punkt
    ctx.restore();
  }

  fadeOut() { this.fading=true; }
}


// ════════════════════════════════════════════
// RIPPLES – Klick-Feedback
// Kurze kreisförmige Wellen beim Klicken.
// ════════════════════════════════════════════

const ripples=[];                    // Array für alle aktiven Ripple-Objekte

function addRipple(x,y) {
  ripples.push({x,y,r:4,alpha:0.55}); // Neuer Ripple: klein (r=4) und halbtransparent
}

function updateRipples() {
  for (let i=ripples.length-1;i>=0;i--) { // Rückwärts iterieren (sicheres Löschen aus Array)
    ripples[i].r    +=2.2;           // Ring wächst nach außen
    ripples[i].alpha-=0.025;         // Ring verblasst
    if (ripples[i].alpha<=0) ripples.splice(i,1); // Unsichtbare Ripples aus Array löschen
  }
}

function drawRipples() {
  ripples.forEach(r=>{
    ctx.save();
    ctx.strokeStyle=`rgba(255,255,255,${r.alpha})`; ctx.lineWidth=0.7;
    ctx.beginPath(); ctx.arc(r.x,r.y,r.r,0,Math.PI*2); ctx.stroke(); // Ring zeichnen
    ctx.restore();
  });
}


// ════════════════════════════════════════════
// HILFSFUNKTIONEN
// ════════════════════════════════════════════

function findNearby(node) {          // Findet den nächsten Node innerhalb von CONNECT_R
  let closest=null, closestDist=CONNECT_R; // Startet mit maximaler Reichweite als Schwelle
  nodes.forEach(n=>{
    if (n.id===node.id||n.fading||n.dead) return; // Sich selbst und sterbende Nodes überspringen
    const dx=n.x-node.x, dy=n.y-node.y;
    const d=Math.sqrt(dx*dx+dy*dy);  // Abstand zum anderen Node (Pythagoras)
    if (d<closestDist) { closestDist=d; closest=n; } // Näheren Node merken
  });
  return closest ? [closest] : [];  // Als Array zurückgeben (leer wenn keiner gefunden)
}

function connectionExists(a,b) {     // Prüft ob zwischen zwei Nodes bereits eine Verbindung existiert
  return connections.some(c=>        // Gibt true zurück wenn mindestens eine Verbindung...
    !c.fading&&!c.dead&&             // ...noch aktiv ist...
    ((c.a.id===a.id&&c.b.id===b.id)||(c.a.id===b.id&&c.b.id===a.id)) // ...A↔B verbindet (beide Richtungen)
  );
}

function updateStats() {             // Aktualisiert die Statistik-Anzeige
  const an=nodes.filter(n=>!n.fading&&!n.dead).length; // Anzahl lebender Nodes
  stats.textContent=`${an} node${an===1?'':'s'} · ${plantCount} plant${plantCount===1?'':'s'}`; // Text setzen
}


// ════════════════════════════════════════════
// CURSOR
// Eigener Cursor: Kreis + Fadenkreuz +
// Vorschaulinie zum nächsten Node.
// ════════════════════════════════════════════

function drawCursor(x,y) {
  let closest=null, closestDist=CONNECT_R; // Nächsten Node zur Mausposition suchen
  nodes.forEach(n=>{
    if (n.fading||n.dead) return;
    const dx=n.x-x, dy=n.y-y, d=Math.sqrt(dx*dx+dy*dy);
    if (d<closestDist) { closestDist=d; closest=n; } // Nächsten Node merken
  });
  if (closest) {                     // Vorschaulinie zum nächsten Node zeichnen
    ctx.save();
    ctx.strokeStyle=`rgba(${ACCENT_RGB},${(1-closestDist/CONNECT_R)*0.28})`; // Stärker je näher
    ctx.lineWidth=0.6; ctx.setLineDash([3,6]); // Gestrichelte grüne Vorschaulinie
    ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(closest.x,closest.y); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
  }
  ctx.save();
  ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=0.8;
  ctx.beginPath(); ctx.arc(x,y,11,0,Math.PI*2); ctx.stroke(); // Äußerer Cursor-Ring
  ctx.fillStyle='rgba(255,255,255,0.72)';
  ctx.beginPath(); ctx.arc(x,y,1.6,0,Math.PI*2); ctx.fill(); // Cursor-Mittelpunkt
  ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.lineWidth=0.6;
  ctx.beginPath();
  ctx.moveTo(x-20,y); ctx.lineTo(x-14,y); // Fadenkreuz links
  ctx.moveTo(x+14,y); ctx.lineTo(x+20,y); // Fadenkreuz rechts
  ctx.moveTo(x,y-20); ctx.lineTo(x,y-14); // Fadenkreuz oben
  ctx.moveTo(x,y+14); ctx.lineTo(x,y+20); // Fadenkreuz unten
  ctx.stroke(); ctx.restore();
}


// ════════════════════════════════════════════
// BLATTSPITZEN-VERBINDUNGEN
// Wenn Blattspitzen verschiedener Pflanzen
// nah beieinander sind, werden sie mit
// feinen Akzentlinien verbunden.
// ════════════════════════════════════════════

function drawTipConnections(tips) {
  const MAX_D=75;                    // Maximale Distanz für eine Verbindung (75 Pixel)
  ctx.save();
  for (let i=0;i<tips.length;i++)    // Alle Blattspitzen-Paare vergleichen
    for (let j=i+1;j<tips.length;j++) { // j startet bei i+1 → keine Doppelvergleiche
      const dx=tips[i].x-tips[j].x, dy=tips[i].y-tips[j].y;
      const d=Math.sqrt(dx*dx+dy*dy);
      if (d>=MAX_D) continue;        // Zu weit entfernt → überspringen
      ctx.setLineDash([2,5]);        // Kurze Strichelung
      ctx.strokeStyle=`rgba(${ACCENT_RGB},${(1-d/MAX_D)*0.1})`; // Grün, fast unsichtbar
      ctx.lineWidth=0.5;
      ctx.beginPath(); ctx.moveTo(tips[i].x,tips[i].y); ctx.lineTo(tips[j].x,tips[j].y); ctx.stroke();
    }
  ctx.setLineDash([]); ctx.restore();
}


// ════════════════════════════════════════════
// EVENT LISTENER – Benutzer-Interaktion
// ════════════════════════════════════════════

let lastMs=0;                        // Zeitstempel des letzten Klicks (für Doppelklick-Erkennung)

canvas.addEventListener('click',e=>{
  const now=Date.now();              // Aktuelle Zeit in Millisekunden
  if(now-lastMs<320) return;         // Weniger als 320ms = erster Klick eines Doppelklicks → ignorieren
  lastMs=now;                        // Zeitstempel für nächste Prüfung merken
  if (!firstClick) {                 // Beim allerersten Klick:
    firstClick=true;
    hint.classList.add('fade');      // Ersten Hinweis ausblenden
    setTimeout(()=>hint2.classList.add('show'),2000); // Nach 2 Sekunden zweiten Hinweis einblenden
  }
  const node=new Node(e.clientX,e.clientY,nodeCount++); // Neuen Node an Klickposition erstellen
  const nearby=findNearby(node);     // Nächsten Node in Reichweite suchen (vor dem Hinzufügen!)
  nodes.push(node);                  // Node zur globalen Liste hinzufügen
  addRipple(e.clientX,e.clientY);    // Klick-Welle erzeugen
  nearby.forEach(other=>{            // Für jeden gefundenen Nachbar-Node:
    if (!connectionExists(node,other)) // Wenn noch keine Verbindung existiert:
      connections.push(new Connection(node,other)); // Neue Verbindung erstellen
  });
  updateStats();                     // Statistik-Anzeige aktualisieren
});

canvas.addEventListener('dblclick',()=>{
  lastMs=Date.now();                 // Verhindert dass der Einzelklick danach noch ausgelöst wird
  nodes.forEach(n=>n.fadeOut());     // Alle Nodes ausblenden
  connections.forEach(c=>c.fadeOut()); // Alle Verbindungen ausblenden
  hint2.classList.remove('show');    // Zweiten Hinweis verstecken
  hint.classList.remove('fade');     // Ersten Hinweis wieder zeigen
  firstClick=false;                  // Zustand zurücksetzen
  nodeCount=0; plantCount=0;        // Zähler zurücksetzen
  stats.textContent='';             // Statistik löschen
});

canvas.addEventListener('mousemove',  e =>{ mouse.x=e.clientX; mouse.y=e.clientY; }); // Mausposition verfolgen
canvas.addEventListener('mouseleave', ()=>{ mouse.x=-9999; mouse.y=-9999; });          // Maus außerhalb: Cursor verstecken


// ════════════════════════════════════════════
// RENDER LOOP – das Herzstück der Animation
// Wird ~60 Mal pro Sekunde aufgerufen.
// Löscht den Canvas und zeichnet alles neu.
// ════════════════════════════════════════════

function loop() {
  ctx.clearRect(0,0,W,H);           // Canvas komplett leeren (altes Bild löschen)

  nodes      =nodes.filter(n=>!n.dead);       // Tote Nodes aus der Liste entfernen
  connections=connections.filter(c=>!c.dead); // Tote Verbindungen entfernen
  particles  =particles.filter(p=>!p.dead);   // Tote Partikel entfernen

  connections.forEach(c=>c.update()); // Verbindungen aktualisieren (steuern auch Pflanzen)
  nodes.forEach(n=>n.update());       // Nodes aktualisieren
  particles.forEach(p=>p.update());   // Partikel aktualisieren
  updateRipples();                    // Ripples aktualisieren

  connections.forEach(c=>c.draw());   // Verbindungen + Pflanzen zeichnen (im Hintergrund)

  const tips=[];                      // Alle Blattspitzen sammeln
  connections.forEach(c=>tips.push(...c.getTips())); // Spread-Operator: Array in Array einfügen
  if (tips.length>1&&tips.length<300) // Nur wenn sinnvolle Menge vorhanden
    drawTipConnections(tips);         // Akzent-Linien zwischen nahen Blattspitzen zeichnen

  particles.forEach(p=>p.draw());     // Partikel über den Pflanzen zeichnen
  nodes.forEach(n=>n.draw());         // Nodes ganz oben zeichnen (immer sichtbar)
  drawRipples();                      // Klick-Wellen über allem zeichnen

  if (mouse.x>-9000) drawCursor(mouse.x,mouse.y); // Cursor zeichnen wenn Maus auf Canvas

  requestAnimationFrame(loop);        // Browser: ruf loop() beim nächsten Frame erneut auf
}

loop();                               // Render-Loop das erste Mal starten