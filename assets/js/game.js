// Episode VII: a trench run printed in three riso inks. Loaded only when someone finds it.
import * as THREE from "three";
import { kit, geo, SV, SF, PV } from "./road.js";
import { rgb } from "./print.js";

// every word the game prints lives here, so the theme is data
export const COPY = {
	label: "Episode VII: a trench-run game",
	load: "That's no moon. It's a model.",
	loading: "printing the station…",
	phases: ["The approach", "Inside the network", "The last layer"],
	tut: [
		["mouse or WASD to steer", "click or space to fire", "shift to boost"],
		["drag to steer", "hold to fire", "double-tap to boost"],
	],
	shields: "shields",
	score: "tokens",
	layer: (n) => `layer ${n} / 96`,
	out: "OUTPUT",
	chatter: "I have a bad feeling about this prompt.",
	target: "switch off your autocomplete",
	fire: ["in range: E or right-click", "in range: stamp it"],
	torpedo: "Torpedo",
	miss: "Missed. One more pass…",
	picks: ["context window +1", "fine-tune: faster fire", "human in the loop"],
	gain: ["+1 shield", "fine-tune ×2", "+ wingman"],
	loss: "−1 shield",
	meet: {
		hal: "hallucination — shoot it",
		inj: "prompt injection — shoot it (it splits)",
		head: "attention head — dodge its gaze",
		grad: "exploding gradient — dodge the burst",
		ctx: "context window — grab it",
		tune: "fine-tune — grab it",
		hitl: "human in the loop — grab it",
	},
	layers: ["embedding", "attention", "MLP", "norm"],
	input: "INPUT",
	here: "you are here",
	prompt: ["Wake", " up", "."],
	win: "The model is asleep. For now.",
	motto: "May the attention be with you.",
	over: "The model hallucinated you out of existence.",
	lost: "The printer jammed, so the run stops here.",
	ranks: ["Autocomplete", "Copilot", "Agent", "AGI"],
	stats: ["tokens", "time", "rank", "best"],
	paused: "Paused",
	btn: [
		"Play again",
		"Try again",
		"Say hi",
		"Back to the site",
		"Share your score",
		"Resume",
		"Pause",
		"Exit",
		"copied",
	],
	share: (t, r) => `I put the model back to sleep in ${t} on ugm2.github.io — rank: ${r}`,
};

const { Vector3: V3, Matrix4: M4 } = THREE;
const PI = Math.PI;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
const R = (a = 0, b = 1) => a + (b - a) * Math.random();

// the run: three stretches of world units flown at ~46 u/s, about 70 s in all
const P1 = 1250,
	P2 = 1450,
	P3 = 480,
	END = P1 + P2 + P3,
	SPD = 46,
	TW = 7,
	TF = -12,
	GAP = 16,
	LG = 20,
	NY = -6.2;
// the play box: out over the surface, then inside the network
const BOX = [
	[-12, 12, 3, 10],
	[-5.3, 5.3, -10.4, -2.4],
];
const NIGHT = "oklch(.19 .04 168)";
// kinds already introduced by a hand-note, for this visit
const MET = new Set();

const CSS = `
.gm{position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;overflow:hidden;
background:${NIGHT};color:var(--paper);touch-action:none;user-select:none;-webkit-user-select:none;overscroll-behavior:contain}
.gm::backdrop{background:${NIGHT}}
.gm-c{position:absolute;inset:0;width:100%;height:100%;display:block;cursor:crosshair;outline:0}
.gm-hud{position:absolute;inset:max(12px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) auto max(12px,env(safe-area-inset-left));
display:grid;grid-template-columns:1fr auto 1fr;align-items:start;gap:6px 8px;pointer-events:none;font:600 .875rem/1.2 var(--hand);letter-spacing:.06em}
.gm-hud>div{display:flex;flex-direction:column;gap:4px}
.gm-sc{align-items:center}.gm-sc b{font:700 clamp(1.5rem,1.1rem + 1.6vw,2.4rem)/1 var(--serif-d);color:var(--yellow);letter-spacing:0}
.gm-win{height:18px;width:calc(var(--n) * 14px + 8px);border:2px solid var(--paper);border-radius:3px;transition:width .4s var(--spring);
background:repeating-linear-gradient(90deg,var(--yellow) 0 10px,#0000 10px 14px) 4px 50%/calc(100% - 6px) 8px no-repeat}
.gm-hud .gm-bt{flex-direction:row;justify-content:flex-end;gap:8px}
.gm-b{pointer-events:auto;min-width:44px;min-height:44px;border:2px solid var(--paper);border-radius:999px;background:${NIGHT};
color:var(--paper);font:700 .8rem var(--hand);cursor:pointer;display:grid;place-items:center;padding:0 12px}
.gm :focus-visible{outline:3px solid var(--yellow);outline-offset:3px}
.gm-hud .gm-bar{grid-column:1/-1;flex-direction:row;align-items:center;gap:10px;margin:2px auto 0;width:min(560px,100%)}
.gm-bar i{flex:1;height:6px;border:1.5px solid var(--paper);border-radius:4px;position:relative;container-type:inline-size;
background:linear-gradient(var(--pink),var(--pink)) 0 0/var(--d,0%) 100% no-repeat}
.gm-bar i::after{content:"";position:absolute;top:-5px;bottom:-5px;left:${(P1 / END) * 100}%;width:2px;background:var(--paper);
box-shadow:${(P2 / END) * 100}cqw 0 var(--paper)}
.gm-bar span{min-width:10ch;text-align:right}
.gm-toast,.gm-chat{position:absolute;left:50%;translate:-50% 0;margin:0;text-align:center;pointer-events:none;color:var(--yellow);opacity:0;transition:opacity .4s}
.gm-toast{top:24%;width:90%;font:700 clamp(1.3rem,1rem + 1.4vw,2rem)/1.1 var(--serif-d);text-shadow:.05em .04em 0 var(--pink)}
.gm-chat{bottom:calc(max(22px,env(safe-area-inset-bottom)) + 100% - var(--ih,100%) + 120px);padding:6px 12px;border:1.5px dashed;
border-radius:6px;font:italic 600 clamp(1rem,.9rem + .5vw,1.3rem) var(--hand);width:max-content;max-width:86vw;background:${NIGHT}}
.gm .on{opacity:1}
.gm-tut{position:absolute;left:50%;bottom:calc(max(26px,env(safe-area-inset-bottom)) + 100% - var(--ih,100%));translate:-50% 0;display:flex;
flex-wrap:wrap;justify-content:center;gap:6px 22px;width:max-content;max-width:92vw;pointer-events:none;font:600 1rem var(--hand);transition:opacity .6s}
.gm-tut span{rotate:-3deg;transition:opacity .4s}.gm-tut span+span{rotate:2deg}.gm-tut .ok{opacity:.2;text-decoration:line-through}
.gm-aim{position:absolute;left:50%;top:50%;width:min(420px,78vw);translate:-50% -40%;pointer-events:none;opacity:0;transition:opacity .5s}
.gm-aim svg{width:100%;overflow:visible;fill:none;stroke:var(--yellow);stroke-width:1.6;stroke-linecap:round}
.gm-aim .lk{stroke:var(--pink);stroke-width:3}
.gm-aim p{position:absolute;right:-4%;top:-36px;margin:0;rotate:-4deg;font:600 .95rem var(--hand)}
.gm-aim text{fill:var(--yellow);stroke:none;font:700 10px var(--hand);letter-spacing:.12em}
.gm-out{position:absolute;left:0;top:0;padding:3px 8px;border:2px solid var(--yellow);border-radius:4px;color:var(--yellow);
font:700 .75rem var(--hand);letter-spacing:.2em;rotate:-6deg;pointer-events:none;opacity:0}
.gm-stk{position:absolute;left:0;top:0;width:96px;height:96px;margin:-48px;border:3px dashed var(--ink);border-radius:50%;box-shadow:0 0 0 2px var(--paper),inset 0 0 0 2px var(--paper);opacity:0;pointer-events:none}
.gm-stk.on{opacity:.8}.gm-stk i{position:absolute;left:50%;top:50%;width:40px;height:40px;margin:-20px;border:3px solid var(--ink);border-radius:50%;background:var(--pink)}
.gm-tp{position:absolute;right:max(18px,env(safe-area-inset-right));bottom:calc(max(22px,env(safe-area-inset-bottom)) + 100% - var(--ih,100%));
width:108px;height:108px;border:3px solid var(--ink);border-radius:50%;background:var(--yellow);color:var(--ink);font:800 .95rem var(--hand);
letter-spacing:.08em;text-transform:uppercase;rotate:-8deg;box-shadow:6px 5px 0 var(--pink);cursor:pointer;animation:gm-stamp .4s var(--spring)}
.gm-tp:active{scale:.9}.gm-tp[hidden]{display:none}
.gm-card{position:absolute;left:50%;top:50%;translate:-50% -50%;width:min(88vw,31rem);max-height:92%;overflow:auto;box-sizing:border-box;
padding:clamp(22px,4vw,38px) clamp(18px,3vw,32px);border:2px solid var(--ink);border-radius:18px;background:var(--grain),var(--paper);
color:var(--ink);text-align:center;box-shadow:9px 8px 0 var(--pink);animation:gm-stamp .45s var(--spring) both;user-select:text}
.gm-card[hidden]{display:none}
@keyframes gm-stamp{from{scale:1.25;rotate:-5deg;opacity:0}}
.gm-card h2{margin:0 0 14px;font:700 clamp(1.5rem,1.1rem + 2vw,2.4rem)/1.08 var(--serif-d);font-variation-settings:"SOFT" 100,"WONK" 1;text-wrap:balance}
.gm-card p{margin:0 0 16px;font:500 1rem/1.45 var(--serif)}
.gm-card dl{display:grid;grid-auto-flow:column;grid-template-rows:auto auto;justify-content:center;gap:2px 18px;margin:0 0 16px}
.gm-card dt{font:600 .7rem var(--hand);letter-spacing:.1em;text-transform:uppercase;color:var(--ink-2)}
.gm-card dd{margin:0;font:700 1.25rem var(--serif-d)}
.gm-bs{display:flex;flex-wrap:wrap;justify-content:center;gap:10px}
.gm-card .gm-n{margin:0 0 14px;font:600 1rem var(--hand);color:var(--ink-2);rotate:-2deg}
.gm-moon{width:120px;margin:0 auto 10px;display:block;fill:none;stroke:var(--ink);stroke-width:2}
.gm-moon circle{fill:var(--pink-t)}
html.playing{overflow:hidden}
.gm-ft{position:absolute;left:0;top:0;margin:0;font:800 1.1rem var(--hand);letter-spacing:.04em;pointer-events:none;opacity:0;white-space:nowrap}
.gm-ft.go{animation:gm-ft 1s ease-out}.gm-ft.up{color:var(--yellow)}.gm-ft.dn{color:var(--pink)}
@keyframes gm-ft{0%{opacity:0;transform:translate(-50%,0) scale(.6)}15%{opacity:1;transform:translate(-50%,-14px) scale(1.1)}to{opacity:0;transform:translate(-50%,-72px)}}
.gm-win.up{animation:gm-up .7s}.gm-win.dn{animation:gm-dn .7s}
@keyframes gm-up{30%{background-color:var(--yellow);border-color:var(--yellow)}}@keyframes gm-dn{30%{background-color:var(--pink);border-color:var(--pink)}}
.gm-lab{position:absolute;left:0;top:0;margin:0;display:flex;align-items:flex-end;gap:2px;pointer-events:none;font:700 1.15rem var(--hand);opacity:0;transition:opacity .3s;white-space:nowrap}
.gm-lab.on{opacity:1}.gm-lab.foe{color:var(--pink)}.gm-lab.pal{color:var(--yellow)}
.gm-lab span{padding:2px 8px;border-radius:4px;background:${NIGHT}}
.gm-lab svg{width:34px;height:28px;margin-bottom:-18px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round}
.gm-ll{position:absolute;left:0;top:0;margin:0;padding:2px 8px;border:1.5px solid var(--ink);border-radius:3px;background:var(--paper);color:var(--ink);
font:700 .72rem var(--hand);letter-spacing:.14em;text-transform:uppercase;pointer-events:none;opacity:0;translate:-50% -50%}
.gm-map{width:120px;height:30px;overflow:visible;fill:none;stroke:var(--paper);stroke-width:.7}
.gm-map circle{fill:${NIGHT};stroke-width:1.2}.gm-map .o,.gm-map .you{fill:var(--yellow)}.gm-map .you{stroke:var(--ink);transition:cx .4s}
.gm-dia{position:absolute;inset:0;display:grid;place-items:center;background:oklch(.19 .04 168 / .72);pointer-events:none;opacity:0;
transition:opacity .5s,transform 1s cubic-bezier(.6,0,.9,.4);transform-origin:20% 50%}
.gm-dia.on{opacity:1}.gm-dia.in{opacity:0;transform:scale(4)}
.gm-dia svg{width:min(88vw,760px);overflow:visible;fill:none;stroke:var(--paper);stroke-width:1.4}
.gm-dia circle{fill:${NIGHT};stroke-width:2.4}.gm-dia .o{fill:var(--yellow)}
.gm-dia text{fill:var(--paper);stroke:none;font:700 15px var(--hand);letter-spacing:.14em}
.gm-dia .t{fill:var(--yellow);stroke:var(--ink);stroke-width:2}.gm-dia .t+text{fill:var(--ink);letter-spacing:0}
.gm-dia .y{fill:var(--yellow)}.gm-dia.on .tk{animation:gm-tk 1.1s cubic-bezier(.3,0,.3,1) both}
@keyframes gm-tk{from{transform:translate(-340px,0)}}
`;

/* ---------- shaders: the road's G-buffer, instanced; one print pass under a night sky ---------- */
const SVI = SV.replace("in vec3 position,", "in mat4 instanceMatrix;in vec3 instanceColor;in vec3 position,")
	.replace("modelMatrix*uM[i]", "modelMatrix*instanceMatrix*uM[i]")
	.replace("vI=ink;", "vI=dot(instanceColor,vec3(1))>0.?vec4(instanceColor,2.):ink;");
const GF = `precision highp float;
uniform sampler2D tC,tN,tD;uniform vec2 uRes,uNF,uStar;uniform float uDpr,uMis,uT,uSpd,uHit,uFlash,uWave;
uniform vec3 uY,uP,uK,uPap,uSky,uNode;uniform vec4 uBoom;
out vec4 o;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f*=f*(3.-2.*f);
return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
vec4 C(vec2 p){return texture(tC,p/uRes);}
float Z(vec2 p){float d=texture(tD,p/uRes).r;return uNF.x*uNF.y/(uNF.y-d*(uNF.y-uNF.x));}
float dots(vec2 f,float a,float cell,float d){mat2 R=mat2(cos(a),-sin(a),sin(a),cos(a));
vec2 c=fract(R*f/cell)-.5;float r=sqrt(d)*.62;return smoothstep(r+.08,r-.08,length(c))*step(.03,d);}
float edge(vec2 p,float r,float g){vec4 a=texture(tN,p/uRes);float za=Z(p),e=0.,s=1.+za*.05;
for(int i=0;i<4;i++){vec2 q=p+vec2(i==0?r:i==1?-r:0.,i==2?r:i==3?-r:0.);
vec4 b=texture(tN,q/uRes);float zb=Z(q);
float d=max(smoothstep(.012*s,.04*s,abs(za-zb)/min(za,zb)),max(smoothstep(.18,.34,distance(a.xy,b.xy)),step(.002,abs(a.z-b.z))));
e=max(e,d*step(g+.001,za<zb?a.w:b.w));}
return e;}
float ring(float d,float r,float w){return smoothstep(w,0.,abs(d-r));}
void main(){vec2 px=gl_FragCoord.xy,fc=px/uDpr;float n=h(floor(fc/1.5));
float z=Z(px),sky=step(.9999,texture(tD,px/uRes).r),fog=max(sky,smoothstep(uNF.y*.5,uNF.y*.96,z));
vec2 w=(vec2(vn(fc*.035),vn(fc*.035+19.))-.5)*2.6*uDpr;
float k=edge(px+w,uDpr*(1.+.8*vn(fc*.02+7.)),h(floor(fc/2.)+7.)*.95)*(1.-smoothstep(uNF.y*.35,uNF.y*.6,z));
vec4 c=C(px);k=max(k,c.a>.97?1.:dots(fc,.785,3.4,c.a));
vec2 oP=(vec2(4.,-3.)+uMis*vec2(8.,5.))*uDpr,oY=(vec2(-4.,3.)+uMis*vec2(-9.,-4.))*uDpr;
vec4 cp=C(px-oP),cy=C(px-oY);
k=max(k,dots(fc,.26,5.5,clamp((c.r-.38)*1.1,0.,1.))*.6);float p=cp.g;
float y=cy.b>.97?1.:smoothstep(cy.b*.5+.05,cy.b*.5-.05,abs(fract((fc.x+fc.y)/8.)-.5))*step(.03,cy.b);
y*=.8+.2*n;p*=.82+.18*n;k*=.9+.1*n;
vec3 col=uPap*(.96+.04*n)*mix(vec3(1),uY,y)*mix(vec3(1),uP,p)*mix(vec3(1),uK,k);
col=mix(col,uSky,max(fog*fog,dots(fc,.5,4.,fog)));
// the crawl's halftone stars, and speed lines streaming out of the middle
vec2 sp=(fc+uStar)/9.,ce=floor(sp);float r=h(ce);
float st=step(.94,r)*smoothstep(.1+.28*(r-.94)/.06,0.,length(fract(sp)-.5-(vec2(h(ce+3.),h(ce+5.))-.5)*.6));
col=mix(col,r>.994?uP:uY,st*fog);
float nr=length(px-uNode.xy)/max(uNode.z,1.);
col=mix(col,uPap,step(.5,uNode.z)*fog*smoothstep(.1,0.,abs(fract(nr*1.4-uT*.8)-.5)-.36)*step(nr,3.));col=mix(col,uY,dots(fc,.3,4.,smoothstep(1.,.4,nr)*fog)*step(.5,uNode.z));
vec2 q=(px-uRes*.5)/uRes.y;float L=h(vec2(floor(atan(q.y,q.x)*42.),1.));
col=mix(col,uPap,step(.86,L)*uSpd*smoothstep(.25,.95,length(q))*step(fract(length(q)*1.6-uT*(2.+2.*L)),.22)*.55);
// lights out: a halftone wave rolls out of the node, then a paper flash and rings in all three inks
float bd=length(px-uBoom.xy)/uRes.y;
col=mix(col,uSky,dots(fc,.9,5.,ring(bd,uWave,.12)*.9));
col=mix(col,uPap,uFlash);
if(uBoom.w>0.){float bt=uBoom.z;col=mix(col,uY,dots(fc,.3,6.,ring(bd,bt*.9,.16)));
col=mix(col,uP,dots(fc,.9,5.,ring(bd,bt*.62,.13)));col=mix(col,uK,dots(fc,1.4,4.5,ring(bd,bt*.4,.1)));}
col=mix(col,uP,dots(fc,.26,6.,uHit*smoothstep(.3,.85,length(q))));
o=vec4(col,1);}`;

/* ---------- models, built with the road's parts kit (ink codes as in road.js) ---------- */
const model = (f) => {
	const L = [];
	f(kit(L));
	return geo(L);
};
const pts = (s) => s.split(" ").map((p) => new THREE.Vector2(...p.split(",").map(Number)));
// a side profile extruded across the width: +u is the nose (-z)
const ext = (s, w) =>
	new THREE.ExtrudeGeometry(new THREE.Shape(pts(s)), { depth: w, bevelEnabled: false, curveSegments: 3 })
		.rotateY(PI / 2)
		.translate(-w / 2, 0, 0);
// a wing plank in plan view: root chord at x = 0, a swept tip out at |x| = 1.45
const plank = (sx) =>
	new THREE.ExtrudeGeometry(new THREE.Shape(pts(`0,0 ${sx * 1.45},.32 ${sx * 1.45},.86 0,1.1`)), {
		depth: 0.07,
		bevelEnabled: false,
	}).rotateX(PI / 2);
const WING = [
	[-1, 1],
	[1, 1],
	[-1, -1],
	[1, -1],
];
// U and G as the car wears them, in stroke boxes
const UG = [
	[-0.075, 0, 0.026, 0.12],
	[-0.013, 0, 0.026, 0.12],
	[-0.044, -0.056, 0.074, 0.026],
	[0.022, 0, 0.026, 0.12],
	[0.056, 0.056, 0.074, 0.026],
	[0.056, -0.056, 0.074, 0.026],
	[0.082, -0.026, 0.026, 0.06],
];
// the car's aerial cousin: pink body, twin yellow stripes, UG roundels, four wing tips that splay
function starfighter(P) {
	P(ext("2.15,.05 2,.34 1.4,.52 .5,.6 -.5,.62 -1.5,.56 -1.95,.36 -2,.05 -1.85,-.2 1.7,-.22", 1.5), "p");
	P(ext(".55,.58 .1,.95 -.4,1 -.85,.9 -1.3,.6", 0.9), "k4");
	P.src(`x yo .2 .64 -.1 .16 .05 3.3
		x yo= -.2 .64 -.1 .16 .05 3.3
		c k .42 .05 1.95 .42 .7 .42 1.5708
		c k= -.42 .05 1.95 .42 .7 .42 1.5708
		c ylo .42 .05 2.32 .3 .04 .3 1.5708
		c ylo= -.42 .05 2.32 .3 .04 .3 1.5708
		k y 0 .1 -2.3 .34 .5 .34 -1.5708`);
	WING.forEach(([sx, sy], i) => {
		const W = P.part(i + 1),
			x = sx * 0.72,
			y = sy > 0 ? 0.2 : -0.12;
		W(plank(sx), "p", x, y, 0.1);
		W("x", "y", sx * 2.12, y - 0.035, 0.72, 0.18, 0.12, 0.62);
		if (sy < 0) return;
		W("c", "w", sx * 1.4, y + 0.01, 0.62, 0.56, 0.03, 0.56);
		for (const [a, b, lw, lh] of UG)
			W("x", "k o", sx * 1.4 + a * 2.1, y + 0.03, 0.62 - b * 2.1, lw * 2.1, 0.012, lh * 2.1);
	});
}
// shapes with corners: pyramids (spikes, shards), a warning triangle and a hexagon (both face ±z)
const PYR = new THREE.ConeGeometry(0.5, 1, 4),
	TRI = new THREE.CylinderGeometry(0.5, 0.5, 1, 3).rotateX(-PI / 2),
	HEX = new THREE.CylinderGeometry(0.5, 0.5, 1, 6).rotateX(PI / 2);
// every hostile wears a printed hazard sign: a paper triangle with a pink "!"
const hazard = (P, y, z, s = 1) => {
	P(TRI, "w", 0, y, z, s, s, 0.1 * s);
	P("x", "p o", 0, y + 0.08 * s, z, 0.08 * s, 0.26 * s, 0.14 * s);
	P("x", "p o=", 0, y - 0.2 * s, z, 0.08 * s, 0.07 * s, 0.14 * s);
};
// every help is a yellow hexagon with a halftone halo, a "+" and its own glyph
const help = (P, glyph) => {
	P(HEX, "y", 0, 0, 0, 1.9, 1.9, 0.3);
	P("o", "y l o", 0, 0, 0, 2.7);
	P("x", "k o", 0.62, 0.62, 0, 0.34, 0.08, 0.36);
	P("x", "k o=", 0.62, 0.62, 0, 0.08, 0.34, 0.36);
	glyph(P);
};
// stroke letters for the dies, seven-segment style, lying flat (up on the page = away from you)
const SEG = {
	a: [0.25, 0.8, 0.5, 0.08],
	d: [0.25, 0, 0.5, 0.08],
	g: [0.25, 0.4, 0.5, 0.08],
	k: [0.38, 0.4, 0.25, 0.08],
	f: [0, 0.6, 0.08, 0.4],
	e: [0, 0.2, 0.08, 0.4],
	b: [0.5, 0.6, 0.08, 0.4],
	c: [0.5, 0.2, 0.08, 0.4],
	v: [0.25, 0.6, 0.08, 0.4],
};
const LET = { G: "afedck", P: "abgfe", U: "fedcb", H: "fegbc", B: "abcdefg", M: "febcv" };
const word = (P, w, y, s) =>
	[...w].forEach((ch, i) => {
		for (const q of LET[ch]) {
			const [x, z, sx, sz] = SEG[q];
			P("x", "k l o", (i * 0.8 - (w.length * 0.8 - 0.3) / 2 + x) * s, y, (0.4 - z) * s, sx * s, 0.02, sz * s);
		}
	});
const die = (P, label) => {
	P("x", "w", 0, 0.25, 0, 3, 0.5, 3);
	P("x", "k4 o", 0, 0.52, 0, 1.9, 0.03, 1.9);
	for (let i = 0; i < 5; i++)
		for (const s of [-1, 1]) {
			P("x", "k o", s * 1.62, 0.12, -1.1 + i * 0.55, 0.3, 0.1, 0.16);
			P("x", "k o", -1.1 + i * 0.55, 0.12, s * 1.62, 0.16, 0.1, 0.3);
		}
	if (label) (P("x", "w o", 0, 0.55, 0, 1.6, 0.03, 1.2), word(P, label, 0.58, 0.9));
};
const MODELS = {
	ship: starfighter,
	// hallucination fighter: a pink shard with a staring eye, very sure of itself
	hal: (P) => {
		P(PYR, "p", 0, 0, -0.9, 1.3, 1.9, 1.3, -PI / 2);
		P(PYR, "p=", 0, 0, 0.55, 1.2, 1.1, 1.2, PI / 2);
		for (const s of [-1, 1]) {
			P("x", "p", s * 1.35, 0, 0.3, 1.9, 0.08, 0.9, 0, 0, -s * 0.45);
			P(PYR, "p", s * 2.25, 0.4, 0.3, 0.35, 1, 0.35, 0, 0, -s * 0.6);
		}
		P("s", "w", 0, 0.42, -0.45, 0.62, 0.62, 0.5);
		P("s", "k", 0, 0.44, -0.66, 0.28);
		hazard(P, 1.3, 0.2, 0.8);
	},
	// prompt-injection drone: a spiked diamond that splits in two
	inj: (P) => {
		P(PYR, "p", 0, 0.55, 0, 1.9, 1.1, 1.9);
		P(PYR, "p=", 0, -0.55, 0, 1.9, 1.1, 1.9, PI);
		P("c", "k", 0, 0, 0, 1.4, 0.12, 1.4);
		for (const s of [-1, 1]) P(PYR, "p", s * 1.25, 0, 0, 0.4, 1, 0.4, 0, 0, (-s * PI) / 2);
		P("s", "w", 0, 0.05, -0.62, 0.45, 0.45, 0.3);
		P("s", "k", 0, 0.05, -0.74, 0.2);
		hazard(P, 1.6, 0, 0.7);
	},
	// attention head: an eye in a spiked pink crown (its face is +z); it turns to look, then fires along its gaze
	head: (P) => {
		P(PYR, "p", 0, -0.55, 0, 2.3, 1.2, 2.3, PI);
		for (let i = 0; i < 5; i++)
			P(
				PYR,
				"p",
				Math.cos((i / 4) * PI) * 1,
				0.35 + Math.sin((i / 4) * PI) * 0.7,
				-0.1,
				0.36,
				0.9,
				0.36,
				0,
				0,
				(i / 4) * PI - PI / 2,
			);
		P("s", "w", 0, 0.1, 0.25, 1.55, 1.55, 1.2);
		P("o", "p", 0, 0.1, 0.9, 0.95);
		P("s", "k", 0, 0.1, 0.95, 0.42, 0.42, 0.2);
		hazard(P, 1.55, 0.2, 0.7);
	},
	// exploding gradient: a pink pylon banded with hazard ink, a spike on top (unit height, base at 0)
	grad: (P) => (
		P("c", "p", 0, 0.4, 0, 1, 0.8, 1),
		[0.12, 0.3, 0.48, 0.66].forEach((y) => P("c", "k", 0, y, 0, 1.04, 0.05, 1.04)),
		P(PYR, "p", 0, 0.9, 0, 1, 0.2, 1)
	),
	// hostile shots: elongated pink diamonds; your own shots: round yellow dots
	shot: (P) => (P(PYR, "p l", 0, 0, -0.55, 0.8, 1.1, 0.8, -PI / 2), P(PYR, "p l =", 0, 0, 0.55, 0.8, 1.1, 0.8, PI / 2)),
	laser: (P) => P("s", "y l o", 0, 0, 0, 0.55, 0.55, 1.5),
	line: (P) => P("x", "p l o", 0, 0, 0.5, 0.08, 0.08, 1),
	spark: (P) => P("q", "w o"),
	neuron: (P) => P("s", "w", 0, 0, 0, 1.1),
	pulse: (P) => P("s", "k l o", 0, 0, 0, 0.5),
	weight: (P) => P("x", "k l o", 0, 0, 0.5, 0.045, 0.045, 1),
	gate: (P) =>
		P.src(`b w -6.55 -6 0 .6 12 .6
		b w= 6.55 -6 0 .6 12 .6
		b w= 0 -.4 0 13.7 .5 .6
		x klo -6.2 -6 -.3 .05 11 .05
		x klo= 6.2 -6 -.3 .05 11 .05`),
	// the walls you bounce off carry pink hazard hatching along both edges
	wall: (P) => {
		P("x", "w", 0, -6, 0, 0.3, 12, GAP);
		for (let z = -GAP / 2 + 0.8; z < GAP / 2; z += 1.6)
			for (const y of [-0.9, -11.1]) P("x", "p o", -0.17, y, z, 0.04, 0.8, 0.55, 0.7);
		for (const y of [-3.2, -8.8]) P("x", "k l o", -0.17, y, 0, 0.04, 0.05, GAP);
	},
	floor: (P) => {
		P("x", "w", 0, TF - 0.15, 0, TW * 2 + 0.6, 0.3, GAP);
		for (const x of [-4.2, -1.4, 1.4, 4.2]) P("x", "k l o", x, TF + 0.02, 0, 0.06, 0.03, GAP);
	},
	// the station's surface: a wafer of dies with pins, a few labelled, traces and vias between them
	die: (P) => die(P),
	gpu: (P) => die(P, "GPU"),
	hbm: (P) => (
		P.src(`x w 0 .2 0 2.4 .4 3.6
		x w= 0 .55 0 2.2 .3 3.4
		x w= 0 .85 0 2 .3 3.2`),
		word(P, "HBM", 1.02, 0.8)
	),
	trace: (P) => {
		for (let i = 0; i < 4; i++) P("x", "k l o", i * 0.45 - 0.675, 0.03, 0, 0.1, 0.04, 1);
	},
	via: (P) => (P("c", "k o", 0, 0.035, 0, 0.55, 0.05, 0.55), P("c", "w o", 0, 0.07, 0, 0.26, 0.05, 0.26)),
	board: (P) => P("x", "w", 0, -0.5, 0, 1, 1, 1),
	// pickups: a context window, a fine-tune (tuning fork), a human in the loop
	ctx: (P) =>
		help(P, (Q) =>
			Q.src(`x k 0 .38 0 .8 .1 .36
			x k= 0 -.38 0 .8 .1 .36
			x k= .38 0 0 .1 .8 .36
			x k= -.38 0 0 .1 .8 .36`),
		),
	tune: (P) =>
		help(P, (Q) =>
			Q.src(`x k -.2 .15 0 .1 .6 .36
			x k= .2 .15 0 .1 .6 .36
			x k= 0 -.15 0 .5 .1 .36
			x k= 0 -.4 0 .1 .45 .36`),
		),
	hitl: (P) => help(P, (Q) => (Q("s", "k", 0, 0.25, 0, 0.36, 0.36, 0.36), Q("x", "k", 0, -0.25, 0, 0.44, 0.5, 0.36))),
	torp: (P) =>
		P.src(`l y 0 0 0 .5 .9 .5 1.5708
		k k 0 0 -1 .5 .6 .5 -1.5708
		x k .38 0 .7 .7 .05 .35
		x k= -.38 0 .7 .7 .05 .35`),
	node: (P) =>
		P.src(`s yl 0 0 0 5.6
		o k 0 0 0 8.4
		o k= 0 0 0 6.8 6.8 6.8 .3 .8
		s w 0 0 2.2 1.4 1.4 .6`),
};

export async function game({ snd, back, onClose } = {}) {
	if (document.querySelector("dialog.gm")) return;
	if (!document.getElementById("gm-css"))
		document.head.append(Object.assign(document.createElement("style"), { id: "gm-css", textContent: CSS }));
	const root = document.documentElement;
	const touch = matchMedia("(pointer: coarse)").matches;
	const ac = new AbortController();
	const on = (t, e, f, o) => t.addEventListener(e, f, { signal: ac.signal, ...o });
	const y0 = scrollY;
	const opener = back || document.activeElement;
	const B = COPY.btn;
	// the establishing shot: a classic node-and-edge network, the prompt's tokens flying into its input layer
	const COL = [3, 5, 5, 5, 1],
		cx = (i) => 90 + i * 150,
		cy = (n, j) => 180 + (j - (n - 1) / 2) * 62;
	let edges = "",
		nodes = "";
	COL.forEach((n, i) => {
		for (let j = 0; j < n; j++) {
			nodes += `<circle cx="${cx(i)}" cy="${cy(n, j)}" r="${i > 3 ? 22 : 13}"${i > 3 ? ' class="o"' : ""}/>`;
			if (i < 4)
				for (let q = 0; q < COL[i + 1]; q++) edges += `M${cx(i)} ${cy(n, j)}L${cx(i + 1)} ${cy(COL[i + 1], q)}`;
		}
	});
	const toks = COPY.prompt
		.map(
			(t, j) =>
				`<g class="tk" style="animation-delay:${0.4 + j * 0.28}s"><rect class="t" x="-60" y="${cy(3, j) - 14}" width="94" height="28" rx="4"/><text x="-13" y="${cy(3, j) + 5}" text-anchor="middle">${t}</text></g>`,
		)
		.join("");
	const DIA = `<div class="gm-dia"><svg viewBox="-70 0 830 390"><path d="${edges}"/>${nodes}${toks}<path class="y" d="M81 70h18l-9 14z"/><text x="90" y="58" text-anchor="middle" class="y">${COPY.here}</text><text x="90" y="380" text-anchor="middle">${COPY.input}</text><text x="690" y="380" text-anchor="middle">${COPY.out}</text></svg></div>`;
	// the minimap: the same network in miniature, with you on it
	let me = "";
	for (let i = 0; i < 5; i++)
		for (let j = 0; j < 4; j++) me += `<circle cx="${6 + i * 22}" cy="${4 + j * 7.3}" r="2"/>`;
	const MAP = `<svg class="gm-map" viewBox="0 0 120 30" aria-hidden="true"><path d="M6 4h88M6 11.3h88M6 18.6h88M6 26h88M94 4 116 15M94 26 116 15"/>${me}<circle class="o" cx="116" cy="15" r="4"/><circle class="you" cx="6" cy="15" r="3.4"/></svg>`;
	const d = document.createElement("dialog");
	d.className = "gm";
	d.setAttribute("aria-label", COPY.label);
	d.innerHTML = `<canvas class="gm-c" tabindex="-1"></canvas>
<div class="gm-hud"><div><span>${COPY.shields}</span><span class="gm-win"></span></div>
<div class="gm-sc"><span>${COPY.score}</span><b>0</b></div>
<div class="gm-bt"><button class="gm-b" type="button" data-a="pause" aria-label="${B[6]}">II</button><button class="gm-b" type="button" data-a="exit" aria-label="${B[7]}">✕&#xFE0E;</button></div>
<div class="gm-bar"><i></i><span></span>${MAP}</div></div>
<p class="gm-toast"></p><p class="gm-chat"></p>
<div class="gm-tut">${COPY.tut[touch ? 1 : 0].map((t) => `<span>${t}</span>`).join("")}</div>
<div class="gm-aim"><p>${COPY.target}</p><svg viewBox="0 0 200 130"><rect x="2" y="2" width="196" height="126" rx="8" fill="oklch(.19 .04 168 / .45)"/>
<path d="M2 128 80 62M198 128 120 62M2 2 80 62M198 2 120 62M80 62h40"/><path class="gm-ln" d="M40 100h120"/>
<circle class="gm-rt" cx="100" cy="66" r="15"/><path d="M100 40v12M100 80v12M74 66h12M114 66h12"/><text x="10" y="121" class="gm-rd"></text></svg></div>
<span class="gm-out">${COPY.out}</span><div class="gm-stk"><i></i></div>${DIA}<p class="gm-lab"><svg viewBox="0 0 34 28"><path d="M32 4C20 4 10 10 5 22M1 15l4 8 8-3"/></svg><span></span></p>${"<p class=gm-ll></p>".repeat(3)}${"<p class=gm-ft></p>".repeat(4)}
<button class="gm-tp" type="button" data-a="torp" hidden>${COPY.torpedo}</button>
<div class="gm-card" role="group"></div><p class="sr" aria-live="polite"></p>`;
	const $ = (s) => d.querySelector(s);
	const cv = $(".gm-c"),
		card = $(".gm-card"),
		live = $(".sr"),
		toastEl = $(".gm-toast"),
		chat = $(".gm-chat"),
		tut = $(".gm-tut"),
		tutS = [...tut.children],
		aim = $(".gm-aim"),
		rd = $(".gm-rd"),
		rt0 = $(".gm-rt"),
		ln = $(".gm-ln"),
		outEl = $(".gm-out"),
		stick = $(".gm-stk"),
		knob = stick.firstChild,
		tpBtn = $(".gm-tp"),
		scoreEl = $(".gm-sc b"),
		winEl = $(".gm-win"),
		bar = $(".gm-bar i"),
		layerEl = $(".gm-bar span"),
		dia = $(".gm-dia"),
		lab = $(".gm-lab"),
		labT = lab.lastChild,
		lls = [...d.querySelectorAll(".gm-ll")],
		fts = [...d.querySelectorAll(".gm-ft")],
		you = $(".gm-map .you");
	document.body.append(d);
	root.classList.add("playing");
	d.showModal();
	const say = (t) => (live.textContent = t);
	const stamp = (html) => {
		card.innerHTML = html;
		card.hidden = false;
		card.querySelector("button, a")?.focus();
	};
	const btn = (a, t, k = "") => `<button class="pill ${k}" type="button" data-a="${a}">${t}</button>`;
	stamp(`<svg class="gm-moon" viewBox="0 0 120 120"><circle cx="60" cy="60" r="54"/><path d="M6 64h108M60 6v18M28 18l10 14M92 18 82 32M60 36a22 22 0 1 0 .1 0"/></svg>
<h2>${COPY.load}</h2><p class="gm-n">${COPY.loading}</p><div class="gm-bs">${btn("exit", B[3])}</div>`);
	say(COPY.load);
	const G = { mode: "load", best: 0 };

	/* ---------- renderer ---------- */
	let renderer;
	try {
		renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: "high-performance" });
	} catch {
		stamp(`<h2>${COPY.lost}</h2><div class="gm-bs">${btn("exit", B[3])}</div>`);
		on(d, "click", (e) => e.target.closest("[data-a]") && close());
		return;
	}
	renderer.setClearColor(0, 0);
	const cap = Math.min(devicePixelRatio || 1, touch ? 1.25 : 1.5);
	let pr = cap;
	const camera = new THREE.PerspectiveCamera(62, 1, 1, 340);
	const scene = new THREE.Scene();
	const trash = [];
	const keep = (x) => (trash.push(x), x);
	const sun = new V3(0.25, 0.9, 0.3).normalize();
	const mat = (vs) =>
		keep(
			new THREE.RawShaderMaterial({
				glslVersion: THREE.GLSL3,
				vertexShader: vs,
				fragmentShader: SF,
				uniforms: {
					uSun: { value: sun },
					uFade: { value: new THREE.Vector4(0, 0, 1e6, 1e6) },
					uM: { value: Array.from({ length: 16 }, () => new M4()) },
					uA: { value: Array(16).fill(1) },
				},
			}),
		);
	const matI = mat(SVI),
		matS = mat(SV);
	const G3 = {};
	for (const k in MODELS) G3[k] = keep(model(MODELS[k]));
	for (const k of ["hal", "inj", "shot"]) G3[k].scale(1.35, 1.35, 1.35);
	const rt = keep(
		new THREE.WebGLRenderTarget(1, 1, {
			count: 2,
			minFilter: THREE.NearestFilter,
			magFilter: THREE.NearestFilter,
			depthTexture: new THREE.DepthTexture(1, 1),
		}),
	);
	const cs = getComputedStyle(d);
	const ink = (v) => new V3(...rgb(v.startsWith("--") ? cs.getPropertyValue(v) : v));
	const U = {
		tC: { value: rt.textures[0] },
		tN: { value: rt.textures[1] },
		tD: { value: rt.depthTexture },
		uRes: { value: new THREE.Vector2(1, 1) },
		uNF: { value: new THREE.Vector2(camera.near, camera.far) },
		uStar: { value: new THREE.Vector2() },
		uDpr: { value: pr },
		uMis: { value: 0 },
		uT: { value: 0 },
		uSpd: { value: 0 },
		uHit: { value: 0 },
		uFlash: { value: 0 },
		uWave: { value: -1 },
		uBoom: { value: new THREE.Vector4() },
		uNode: { value: new V3() },
		uY: { value: ink("--yellow") },
		uP: { value: ink("--pink") },
		uK: { value: ink("--ink") },
		uPap: { value: ink("--paper") },
		uSky: { value: ink(NIGHT) },
	};
	const postM = keep(
		new THREE.RawShaderMaterial({
			glslVersion: THREE.GLSL3,
			vertexShader: PV,
			fragmentShader: GF,
			depthTest: false,
			depthWrite: false,
			uniforms: U,
		}),
	);
	const tri = keep(
		new THREE.BufferGeometry().setAttribute(
			"position",
			new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
		),
	);
	const post = new THREE.Mesh(tri, postM);
	post.frustumCulled = false;
	const printScene = new THREE.Scene().add(post);

	/* ---------- pools: one instanced mesh per kind; live items are packed to the front ---------- */
	const _o = new THREE.Object3D(),
		_v = new V3(),
		_mR = new M4(),
		_e = new THREE.Euler(),
		_mT = new M4(),
		_proj = new V3();
	_o.rotation.order = "YXZ";
	const pools = [];
	// static pools re-upload only when something moved
	function pool(g, n, still) {
		const mesh = new THREE.InstancedMesh(G3[g], matI, n);
		mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
		mesh.frustumCulled = false;
		mesh.count = 0;
		scene.add(mesh);
		const items = Array.from({ length: n }, () => ({ on: false }));
		const P = { mesh, items, still, dirty: true };
		P.get = () => {
			for (const it of items)
				if (!it.on) {
					it.on = true;
					it.x = it.y = it.z = it.vx = it.vy = it.vz = it.rx = it.ry = it.rz = 0;
					it.t = it.f = it.c = it.a = it.b = it.k = 0;
					it.sx = it.sy = it.sz = it.hp = 1;
					P.dirty = true;
					return it;
				}
			return null;
		};
		P.flush = () => {
			if (still && !P.dirty) return;
			P.dirty = false;
			let i = 0;
			const col = mesh.instanceColor.array;
			for (const it of items) {
				if (!it.on) continue;
				_o.position.set(it.x, it.y, it.z);
				_o.rotation.set(it.rx, it.ry, it.rz);
				_o.scale.set(it.sx, it.sy, it.sz);
				_o.updateMatrix();
				mesh.setMatrixAt(i, _o.matrix);
				// c: an ink override (1 pink, 2 yellow, 3 ink); f > 0: a hit flash prints solid ink
				const k = it.f > 0 ? 3 : it.c;
				col[i * 3] = +(k === 1);
				col[i * 3 + 1] = +(k === 2);
				col[i * 3 + 2] = k === 3 ? 1 : k === 4 ? 0.45 : 0;
				i++;
			}
			mesh.count = i;
			mesh.instanceMatrix.needsUpdate = true;
			mesh.instanceColor.needsUpdate = true;
		};
		P.clear = () => {
			for (const it of items) it.on = false;
			P.dirty = true;
		};
		pools.push(P);
		return P;
	}
	const hal = pool("hal", 14),
		inj = pool("inj", 8),
		half = pool("inj", 14),
		heads = pool("head", 10),
		gaze = pool("line", 10),
		grads = pool("grad", 8),
		shots = pool("shot", 60),
		lasers = pool("laser", 48),
		sparks = pool("spark", 200),
		picks = [pool("ctx", 3), pool("tune", 3), pool("hitl", 3)],
		torp = pool("torp", 1),
		node = pool("node", 1),
		neurons = pool("neuron", 420, 1),
		weights = pool("weight", 1300, 1),
		gates = pool("gate", 34, 1),
		walls = pool("wall", 52, 1),
		floors = pool("floor", 26, 1),
		dies = pool("die", 392, 1),
		gpus = pool("gpu", 40, 1),
		hbms = pool("hbm", 60, 1),
		traces = pool("trace", 110, 1),
		vias = pool("via", 110, 1),
		board = pool("board", 2, 1),
		pulses = pool("pulse", 90),
		mates = pool("ship", 1);
	const KIND = [
		[hal, "hal", 0],
		[inj, "inj", 0],
		[heads, "head", 0],
		[grads, "grad", 0],
		[picks[0], "ctx", 1],
		[picks[1], "tune", 1],
		[picks[2], "hitl", 1],
	];
	const ship = new THREE.Mesh(G3.ship, matS);
	ship.frustumCulled = false;
	scene.add(ship);
	const WM = matS.uniforms.uM.value;

	/* ---------- state ---------- */
	Object.assign(G, {
		keys: {},
		ptr: null,
		mouse: null,
		ev: { steer: 0, fire: 0, boost: 0 },
		spawn: {},
		shake: 0,
		stop: 0,
		slow: 1,
		mis: 0,
		hit: 0,
		fire: 0,
		boostT: 0,
		roll: 0,
		pitch: 0,
		splay: 0,
		cool: 0,
		side: 1,
		x: 0,
		y: 6,
		wx: 0,
		wy: 6,
		D: 0,
		t: 0,
		score: 0,
		sh: 5,
		inv: 0,
		mate: 0,
		layer: 0,
		phase: 0,
		boom: -1,
		out: -END,
	});
	try {
		G.best = +localStorage.getItem("riso-trench") || 0;
	} catch {}
	const box = [...BOX[0]];
	const zS = () => -G.D;
	const S = G.spawn;
	const K = G.keys;

	/* ---------- sound: synthesised, and only when the site's sound is on ---------- */
	const A = await (snd?.audio?.() || null);
	let eng = null;
	if (A) {
		const o = new OscillatorNode(A.ac, { type: "sawtooth", frequency: 46 }),
			f = new BiquadFilterNode(A.ac, { frequency: 260, Q: 2 }),
			g = new GainNode(A.ac, { gain: 0 });
		o.connect(f).connect(g).connect(A.out);
		o.start();
		eng = { o, f, g };
	}
	const env = (node, vol, t, dur) => {
		node.gain.setValueAtTime(vol, t);
		node.gain.exponentialRampToValueAtTime(1e-4, t + dur);
	};
	const tone = (f0, f1, dur, vol, type = "sine", at = 0) => {
		if (!A) return;
		const t = A.ac.currentTime + at,
			o = new OscillatorNode(A.ac, { type, frequency: f0 }),
			g = new GainNode(A.ac);
		o.frequency.setValueAtTime(f0, t);
		o.frequency.exponentialRampToValueAtTime(f1, t + dur);
		env(g, vol, t, dur);
		o.connect(g).connect(A.out);
		o.start(t);
		o.stop(t + dur + 0.02);
	};
	const hiss = (f0, f1, dur, vol, type = "lowpass") => {
		if (!A) return;
		const t = A.ac.currentTime,
			s = new AudioBufferSourceNode(A.ac, { buffer: A.buf }),
			fl = new BiquadFilterNode(A.ac, { type, frequency: f0 }),
			g = new GainNode(A.ac);
		fl.frequency.setValueAtTime(f0, t);
		fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
		env(g, vol, t, dur);
		s.connect(fl).connect(g).connect(A.out);
		s.start(t, Math.random() * 0.5, dur + 0.05);
	};
	const sfx = {
		pew: () => tone(1500, 420, 0.07, 0.045, "square"),
		boom: (v = 1) => (hiss(1600, 120, 0.35 * v + 0.1, 0.5 * v), tone(120, 36, 0.3 * v + 0.1, 0.3 * v)),
		big: () => (hiss(900, 60, 2.2, 0.9), tone(70, 22, 2, 0.5), tone(140, 40, 1.2, 0.2, "triangle")),
		chime: () => (tone(660, 990, 0.12, 0.08), tone(990, 1480, 0.2, 0.07, "sine", 0.09)),
		beep: () => tone(1760, 1750, 0.05, 0.05),
		hurt: () => (hiss(500, 90, 0.3, 0.7), tone(110, 45, 0.3, 0.28, "square")),
		whoosh: () => hiss(300, 2400, 0.5, 0.3, "bandpass"),
		split: () => tone(600, 1400, 0.12, 0.05, "triangle"),
	};
	const buzz = (ms) => navigator.vibrate?.(ms);

	/* ---------- layout, and resolution that follows real frame times ---------- */
	let W = 1,
		H = 1;
	const fov0 = () => (W < H ? 80 : 62);
	const layout = () => {
		W = Math.max(1, d.clientWidth);
		H = Math.max(1, d.clientHeight);
		renderer.setPixelRatio(pr);
		renderer.setSize(W, H, false);
		const w = Math.round(W * pr),
			h = Math.round(H * pr);
		rt.setSize(w, h);
		U.uRes.value.set(w, h);
		U.uDpr.value = pr;
		camera.aspect = W / H;
		camera.fov = fov0();
		camera.updateProjectionMatrix();
	};
	layout();
	on(window, "resize", layout);
	let slowF = 0,
		fastF = 0,
		frames = 0;
	const adapt = (fdt) => {
		if (++frames < 40) return;
		slowF = slowF * 0.95 + (fdt > 0.026 ? 0.05 : 0);
		fastF = fdt < 0.018 ? fastF + 1 : 0;
		const to =
			slowF > 0.6 && pr > 0.75 ? Math.max(0.75, pr - 0.25) : fastF > 240 && pr < cap ? Math.min(cap, pr + 0.25) : pr;
		if (to !== pr) {
			pr = to;
			slowF = fastF = 0;
			layout();
		}
	};

	/* ---------- world: a wafer of dies, the trench, and the network's layers ---------- */
	// the wafer: a grid of dies (a few labelled GPU or HBM) with traces and vias in the streets between
	const COLS = [11, 19, 27, 35],
		ROW = 8,
		SPAN = 49 * ROW;
	const traceAt = (c) => {
		const i = (R() * 4) | 0;
		c.ry = R() < 0.6 ? 0 : PI / 2;
		c.x = (R() < 0.5 ? -1 : 1) * (c.ry ? COLS[i] : COLS[i] + 4);
		c.sz = c.ry ? R(4, 7.5) : R(6, 22);
	};
	const viaAt = (c) => (c.x = (R() < 0.5 ? -1 : 1) * (COLS[(R() * 4) | 0] + 4 + R(-0.4, 0.4)));
	// a layer: a gate you fly through, a ring of twelve neurons, weights to the layer before
	const NP = [
		[-6.2, -10],
		[-6.2, -6.5],
		[-6.2, -3],
		[-3.4, -1],
		[0, -1],
		[3.4, -1],
		[6.2, -3],
		[6.2, -6.5],
		[6.2, -10],
		[3.4, -11.4],
		[0, -11.4],
		[-3.4, -11.4],
	];
	let layerN = 0;
	const wire = (a, bx, by, bz, nb, k = 0) => {
		const w = weights.get();
		if (!w) return;
		w.x = a.x;
		w.y = a.y;
		w.z = a.z;
		_v.set(bx - a.x, by - a.y, bz - a.z);
		w.sz = _v.length();
		w.ry = Math.atan2(_v.x, _v.z);
		w.rx = -Math.asin(_v.y / w.sz);
		w.dx = _v.x;
		w.dy = _v.y;
		w.dz = _v.z;
		w.na = a;
		w.nb = nb;
		w.k = k;
	};
	function layerAt(z) {
		const g = gates.get();
		if (!g) return;
		g.z = z;
		g.k = ++layerN;
		for (let i = 0; i < 12; i++) {
			const n = neurons.get();
			if (!n) return;
			n.x = NP[i][0];
			n.y = NP[i][1];
			n.z = z;
			n.k = i;
		}
		for (const a of neurons.items)
			if (a.on && Math.abs(a.z - z) < 0.01)
				for (const b of neurons.items)
					if (b.on && Math.abs(b.z - z - LG) < 0.01 && (Math.abs(a.k - b.k) <= 1 || Math.abs(a.k - b.k) === 11))
						wire(a, b.x, b.y, b.z, b);
	}
	function seed() {
		layerN = 0;
		G.conv = 0;
		for (let r = 0; r < 49; r++)
			for (const x of COLS)
				for (const s of [-1, 1]) {
					const q = R(),
						c = (q < 0.07 ? gpus : q < 0.16 ? hbms : dies).get();
					if (!c) continue;
					c.x = s * x;
					c.z = -r * ROW;
				}
		for (let i = 0; i < 110; i++) {
			const c = traces.get(),
				v = vias.get();
			traceAt(c);
			viaAt(v);
			c.z = -i * 3.55;
			v.z = -i * 3.55 - 1.7;
		}
		for (const s of [-1, 1]) Object.assign(board.get(), { x: s * (TW + 60.3), sx: 120, sz: 360, z: -150 });
		for (let i = 0; i < 26; i++) {
			const z = 20 - i * GAP;
			Object.assign(walls.get(), { x: TW + 0.15, z });
			Object.assign(walls.get(), { x: -TW - 0.15, z, ry: PI });
			floors.get().z = z;
		}
		for (let i = 0; i < 32; i++) layerAt(-P1 + 220 - i * LG);
	}
	const recycle = () => {
		const zs = zS();
		let m = 0;
		for (const P of [dies, gpus, hbms]) for (const c of P.items) if (c.on && c.z > zs + 14) ((c.z -= SPAN), (m = 1));
		for (const c of traces.items) if (c.on && c.z > zs + 14 + c.sz / 2) (traceAt(c), (c.z -= 390.5), (m = 1));
		for (const c of vias.items) if (c.on && c.z > zs + 14) (viaAt(c), (c.z -= 390.5), (m = 1));
		if (m) dies.dirty = gpus.dirty = hbms.dirty = traces.dirty = vias.dirty = true;
		for (const b of board.items) b.z = zs - 150;
		board.dirty = true;
		for (const n of neurons.items) if (n.on && n.sx && n.z > zs + 5) ((n.sx = n.sy = n.sz = 0), (neurons.dirty = true));
		for (const w of weights.items)
			if (w.on && w.sx && w.z > zs - 2 && w.k !== 9) ((w.sx = w.sy = w.sz = 0), (weights.dirty = true));
		for (const P of [walls, floors])
			for (const w of P.items) if (w.on && w.z > zs + 20) ((w.z -= 26 * GAP), (P.dirty = true));
		let far = 0;
		for (const g of gates.items) {
			if (!g.on) continue;
			if (g.z < zs + 24) {
				far = Math.min(far, g.z);
				continue;
			}
			g.on = false;
			for (const n of neurons.items) if (n.on && Math.abs(n.z - g.z) < 0.01) n.on = false;
			for (const w of weights.items) if (w.on && Math.abs(w.z - g.z) < 0.01) w.on = false;
			gates.dirty = neurons.dirty = weights.dirty = true;
		}
		if (!far) return;
		if (far - LG > G.out + 8) layerAt(far - LG);
		// the last layer: every neuron's weight converges on the one OUTPUT node
		else if (!G.conv) {
			G.conv = 1;
			for (const n of neurons.items) if (n.on && Math.abs(n.z - far) < 0.01) wire(n, 0, NY, G.out, null, 9);
			weights.dirty = true;
		}
	};
	/* ---------- spawning, by distance flown ---------- */
	const ahead = (dz) => zS() - dz;
	function spawn() {
		const D = G.D;
		if (D > S.wave && D < P1 - 120) {
			S.wave = D + R(30, 52);
			const n = D < 250 ? 1 : R() < 0.5 ? 2 : 3,
				wrong = R() < 0.4;
			for (let i = 0; i < n; i++) {
				const P = R() < 0.28 && D > 180 ? inj : hal,
					e = P.get();
				if (!e) break;
				e.x = R(-10, 10);
				e.y = R(4, 9);
				e.z = ahead(190 + i * 9);
				// the confident ones fly the wrong way, nose first, away from the fight
				e.vz = wrong ? -18 : R(6, 14);
				e.ry = wrong ? 0 : PI;
				e.a = R(0, 6);
				e.t = R(0.5, 2);
				e.hp = P === hal ? 2 : 1;
			}
		}
		if (D > P1 - 20 && D < P1 + P2 - 60) {
			const early = D < P1 + 300;
			if (D > S.head) {
				S.head = D + R(46, 74) * (early ? 1.3 : 1);
				const h = heads.get();
				if (h)
					Object.assign(h, {
						x: (R() < 0.5 ? -1 : 1) * (TW - 0.6),
						sx: 1.5,
						sy: 1.5,
						sz: 1.5,
						y: R(-9, -3),
						z: ahead(240),
						hp: 2,
						t: R(0, 0.6),
					});
			}
			if (D > S.grad) {
				S.grad = D + R(58, 90) * (early ? 1.4 : 1);
				const g = grads.get();
				if (g) Object.assign(g, { x: R(-3.6, 3.6), y: TF, z: ahead(280), sy: 0.01, hp: 3 });
			}
			if (D > S.late) {
				S.late = D + R(140, 200);
				const e = hal.get();
				if (e) Object.assign(e, { x: R(-4, 4), y: R(-9, -4), z: ahead(200), vz: 10, a: R(0, 6), hp: 2, ry: PI, t: 2 });
			}
		}
		if (D > S.pick && D < P1 + P2 - 100) {
			S.pick = D + R(250, 330);
			const b = D < P1 - 60 ? BOX[0] : BOX[1],
				p = picks[G.sh < 3 ? 0 : (R() * 3) | 0].get();
			if (p) Object.assign(p, { x: R(b[0] + 1, b[1] - 1), y: R(b[2] + 1, b[3] - 1), z: ahead(200) });
		}
	}

	/* ---------- effects ---------- */
	const spark = (x, y, z, vx, vy, vz, a, b, c) => {
		const s = sparks.get();
		if (!s) return;
		s.x = x;
		s.y = y;
		s.z = z;
		s.vx = vx;
		s.vy = vy;
		s.vz = vz;
		s.a = a;
		s.b = b;
		s.c = c;
	};
	const burst = (x, y, z, n, sp, big = 1, pal = 0) => {
		for (let i = 0; i < n; i++) {
			_v.set(R(-1, 1), R(-1, 1), R(-1, 1))
				.normalize()
				.multiplyScalar(R(0.3, 1) * sp);
			const k = R();
			spark(
				x,
				y,
				z,
				_v.x,
				_v.y,
				_v.z - SPD * 0.3,
				R(0.35, 0.8) * big,
				R(0.3, 1.2) * big,
				pal === 1 ? 2 : pal ? (k < 0.4 ? 2 : k < 0.75 ? 1 : 3) : k < 0.6 ? 1 : 3,
			);
		}
	};
	const shoot = (x, y, z, tx, ty, tz, v, k = 0) => {
		const s = shots.get();
		if (!s) return;
		_v.set(tx - x, ty - y, tz - z)
			.normalize()
			.multiplyScalar(v);
		s.x = x;
		s.y = y;
		s.z = z;
		s.vx = _v.x;
		s.vy = _v.y;
		s.vz = _v.z;
		s.k = k;
		// shots fly point first
		s.ry = Math.atan2(_v.x, _v.z);
		s.rx = -Math.asin(_v.y / v);
	};
	// feedback printed where the ship is: yellow for what helps, pink for what hurts; the shield window flashes too
	let ftI = 0;
	const float = (t, up) => {
		const e = fts[ftI++ % 4];
		e.textContent = t;
		e.className = `gm-ft ${up ? "up" : "dn"}`;
		e.style.translate = `${G.sx | 0}px ${G.sy | 0}px`;
		void e.offsetWidth;
		e.classList.add("go");
		winEl.classList.remove("up", "dn");
		void winEl.offsetWidth;
		winEl.classList.add(up ? "up" : "dn");
	};
	let toastT = 0;
	const toast = (t, dur = 1.8) => {
		toastEl.textContent = t;
		toastEl.classList.add("on");
		toastT = dur;
	};
	const hurt = (why) => {
		if (G.inv > 0 || G.mode !== "run" || G.cine > 0) return;
		G.why = why;
		float(COPY.loss, 0);
		G.sh--;
		G.inv = 1.8;
		G.shake = Math.min(1, G.shake + 0.7);
		G.hit = 1;
		G.mis = 1.6;
		G.hits++;
		sfx.hurt();
		buzz(40);
		burst(G.x, G.y, zS(), 10, 10, 0.6);
		if (G.sh <= 0) {
			// out of shields: the ship goes up in a printed burst, in slow motion
			G.dead = 1;
			G.slow = 0.35;
			G.shake = 1;
			burst(G.x, G.y, zS(), 44, 22, 1.5);
			sfx.big();
			buzz([60, 40, 120]);
			end(false);
		}
	};
	const kill = (e, pts, n = 14) => {
		e.on = false;
		G.score += pts;
		if (pts) G.kills++;
		G.stop = 0.055;
		G.shake = Math.min(1, G.shake + 0.25);
		burst(e.x, e.y, e.z, n, 16);
		sfx.boom(0.7);
		buzz(12);
	};
	function pop(e) {
		e.on = false;
		burst(e.x, TF + e.sy, e.z, 16, 14);
		sfx.boom(0.8);
		G.shake = Math.min(1, G.shake + 0.2);
		for (let i = 0; i < 8; i++) {
			const a = (i / 8) * PI * 2;
			shoot(e.x, TF + e.sy * 0.8, e.z, e.x + Math.cos(a), TF + e.sy * 0.8 + Math.sin(a), e.z + 1, 17, 1);
		}
	}
	// what a laser does to each kind it meets
	const HIT = [
		[hal, 2.4, (e) => (--e.hp <= 0 ? kill(e, 100) : ((e.f = 0.08), sfx.split()))],
		[
			inj,
			2.1,
			(e) => {
				kill(e, 150, 8);
				sfx.split();
				for (const s of [-1, 1]) {
					const q = half.get();
					if (q) Object.assign(q, { x: e.x + s * 0.8, y: e.y, z: e.z, vx: s * 9, vz: 6, sx: 0.55, sy: 0.55, sz: 0.55 });
				}
			},
		],
		[half, 1.1, (e) => kill(e, 50, 6)],
		[heads, 2.4, (e) => (--e.hp <= 0 ? kill(e, 200) : (e.f = 0.08))],
		[grads, 1.9, (e) => (--e.hp <= 0 ? ((G.score += 120), pop(e)) : (e.f = 0.08))],
		[shots, 0.8, (e) => ((e.on = false), (G.score += 10), burst(e.x, e.y, e.z, 3, 6, 0.5))],
	];
	function laserHit(l, z0) {
		for (const [P, r, fx] of HIT)
			for (const e of P.items)
				if (
					e.on &&
					Math.abs(e.x - l.x) < r &&
					Math.abs((P === grads ? TF + e.sy / 2 : e.y) - l.y) < (P === grads ? e.sy / 2 + 0.6 : r) &&
					e.z < z0 + r &&
					e.z > l.z - r
				) {
					l.on = false;
					fx(e);
					return;
				}
	}

	/* ---------- input ---------- */
	const act = (a) => {
		if (a === "pause") pause(G.mode === "run");
		else if (a === "exit") close();
		else if (a === "torp") fireTorp();
		else if (a === "again") start();
		else if (a === "resume") pause(false);
		else if (a === "share") share();
	};
	on(d, "click", (e) => {
		const b = e.target.closest("[data-a]");
		if (b) act(b.dataset.a);
		else if (e.target.closest('a[href="#contact"]')) close(false);
	});
	// Esc pauses; Esc again (or on a card) leaves
	on(d, "cancel", (e) => (e.preventDefault(), G.mode === "run" ? pause(true) : close()));
	on(d, "close", () => close());
	const STEER = [" ", "arrowup", "arrowdown", "arrowleft", "arrowright"];
	on(window, "keydown", (e) => {
		const k = e.key.toLowerCase();
		if (G.mode === "run" && STEER.includes(k)) e.preventDefault();
		if (k === "p") return pause(G.mode === "run");
		if (k === "e") fireTorp();
		K[k] = true;
		G.mouse = null;
	});
	on(window, "keyup", (e) => (K[e.key.toLowerCase()] = false));
	let lastTap = 0;
	on(cv, "contextmenu", (e) => (e.preventDefault(), fireTorp()));
	on(cv, "pointerdown", (e) => {
		if (e.button === 2) return;
		try {
			cv.setPointerCapture(e.pointerId);
		} catch {}
		G.fire = 1;
		if (e.pointerType === "mouse") return;
		// a stick appears wherever the thumb lands; a double tap boosts
		const now = performance.now();
		if (now - lastTap < 300) ((G.boostT = 1.2), (G.ev.boost = 1), sfx.whoosh());
		lastTap = now;
		G.ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 };
		stick.style.translate = `${e.clientX}px ${e.clientY}px`;
		stick.classList.add("on");
	});
	on(cv, "pointermove", (e) => {
		if (e.pointerType === "mouse") return void (G.mouse = [(e.clientX / W) * 2 - 1, (e.clientY / H) * 2 - 1]);
		const p = G.ptr;
		if (!p || p.id !== e.pointerId) return;
		p.dx = clamp((e.clientX - p.x) / 48, -1, 1);
		p.dy = clamp((e.clientY - p.y) / 48, -1, 1);
		knob.style.translate = `${p.dx * 30}px ${p.dy * 30}px`;
	});
	const lift = (e) => {
		if (e.pointerType === "mouse") return void (G.fire = 0);
		if (G.ptr?.id !== e.pointerId) return;
		G.ptr = null;
		G.fire = 0;
		stick.classList.remove("on");
		knob.style.translate = "";
	};
	on(cv, "pointerup", lift);
	on(cv, "pointercancel", lift);
	// pause whenever the tab, the window or the dialog loses attention
	on(document, "visibilitychange", () => document.hidden && pause(true));
	on(window, "blur", () => pause(true));
	on(d, "focusout", (e) => e.relatedTarget && !d.contains(e.relatedTarget) && pause(true));
	on(cv, "webglcontextlost", (e) => (e.preventDefault(), end(false, true)));
	const pads = navigator.getGamepads?.bind(navigator);
	function pollPad() {
		const p = pads?.()?.[0];
		if (!p) return;
		const [x = 0, y = 0] = p.axes,
			b = (i) => p.buttons[i]?.pressed;
		G.gp = Math.hypot(x, y) > 0.2 ? [x, y] : null;
		G.gpFire = b(0) || b(7);
		G.gpBoost = b(4) || b(5);
		if (b(1) || b(2)) fireTorp();
		if (b(9) && !G.gpStart) pause(G.mode === "run");
		G.gpStart = b(9);
	}

	/* ---------- the run ---------- */
	let raf = 0,
		last = 0,
		beepT = 0;
	const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
	function start() {
		for (const p of pools) p.clear();
		Object.assign(G, {
			mode: "run",
			phase: 0,
			D: 0,
			t: 0,
			score: 0,
			sh: 5,
			inv: 2,
			hits: 0,
			kills: 0,
			x: 0,
			y: 6,
			vx: 0,
			vy: 0,
			wx: 0,
			wy: 6,
			boostT: 0,
			fast: 0,
			mate: 0,
			passes: 0,
			out: -END,
			boom: -1,
			layer: 0,
			torpOK: false,
			slow: 1,
			ph1: 0,
			dead: 0,
			shots: 0,
		});
		Object.assign(S, { wave: 60, head: P1 + 60, grad: P1 + 110, pick: 180, late: P1 + 300 });
		Object.assign(G.ev, { steer: 0, fire: 0, boost: 0 });
		seed();
		Object.assign(node.get(), { y: NY, z: G.out });
		card.hidden = true;
		tut.style.opacity = 1;
		aim.classList.remove("on");
		tpBtn.hidden = true;
		U.uWave.value = -1;
		dia.className = "gm-dia";
		lab.className = "gm-lab";
		G.lab = null;
		G.cine = G.cine0 = G.pt = 0;
		say(COPY.phases[0]);
		toast(COPY.phases[0]);
		cv.focus();
		last = performance.now();
		if (!raf) raf = requestAnimationFrame(loop);
	}
	function pause(p) {
		if (p && G.mode === "run") {
			G.mode = "pause";
			say(COPY.paused);
			stamp(`<h2>${COPY.paused}</h2><div class="gm-bs">${btn("resume", B[5], "btn-k")}${btn("exit", B[3])}</div>`);
			if (eng) eng.g.gain.setTargetAtTime(0, A.ac.currentTime, 0.05);
		} else if (!p && G.mode === "pause") {
			G.mode = "run";
			card.hidden = true;
			cv.focus();
			last = performance.now();
			if (!raf) raf = requestAnimationFrame(loop);
		}
	}
	function fireTorp() {
		if (G.mode !== "run" || !G.torpOK || torp.items[0].on) return;
		Object.assign(torp.get(), { x: G.x, y: G.y - 0.3, z: zS() - 2.5, vz: -150 });
		// the slow-motion beat
		G.slow = 0.3;
		G.torpOK = false;
		G.shots = (G.shots || 0) + 1;
		tpBtn.hidden = true;
		sfx.whoosh();
		buzz(25);
	}
	function miss() {
		if (G.mode !== "run") return;
		G.slow = 1;
		G.passes++;
		G.out -= P3;
		node.items[0].z = G.out;
		// the network grows another stretch; the converging weights move to the new last layer
		for (const w of weights.items) if (w.on && w.k === 9) w.on = false;
		weights.dirty = true;
		G.conv = 0;
		toast(COPY.miss, 2.2);
		say(COPY.miss);
		G.torpOK = false;
		tpBtn.hidden = true;
	}
	function win() {
		G.mode = "won";
		G.slow = 1;
		G.boom = 0;
		G.layer = 96;
		node.items[0].c = 3;
		pulses.clear();
		sfx.big();
		buzz([30, 40, 80]);
		aim.classList.remove("on");
		outEl.style.opacity = 0;
	}
	function end(won, lost) {
		if (G.mode === "end" || G.mode === "gone") return;
		G.mode = "end";
		const t = G.t;
		if (won) G.score += Math.round(3000 + G.sh * 600 + Math.max(0, 90 - t) * 100);
		const rank = COPY.ranks[G.score >= 26000 ? 3 : G.score >= 21000 ? 2 : G.score >= 15000 ? 1 : 0];
		const best = Math.max(G.best, won ? G.score : 0);
		if (best > G.best)
			try {
				localStorage.setItem("riso-trench", String(best));
			} catch {}
		G.best = best;
		G.last = { t: fmt(t), rank, won };
		if (eng) eng.g.gain.setTargetAtTime(0, A.ac.currentTime, 0.2);
		aim.classList.remove("on");
		tpBtn.hidden = true;
		outEl.style.opacity = 0;
		chat.classList.remove("on");
		const s = COPY.stats,
			n = (v) => (v ? v.toLocaleString("en") : "—");
		const dl = `<dl><dt>${s[0]}</dt><dd>${n(G.score)}</dd><dt>${s[1]}</dt><dd>${fmt(t)}</dd><dt>${s[2]}</dt><dd>${won ? rank : "—"}</dd><dt>${s[3]}</dt><dd>${n(best)}</dd></dl>`;
		const html = won
			? `<h2>${COPY.win}</h2>${dl}<p>${COPY.motto}</p><div class="gm-bs">${btn("again", B[0], "btn-k")}<a class="pill" href="#contact">${B[2]}</a>${btn("exit", B[3])}${btn("share", B[4])}</div>`
			: `<h2>${lost ? COPY.lost : COPY.over}</h2>${dl}<div class="gm-bs">${lost ? "" : btn("again", B[1], "btn-k")}${btn("exit", B[3])}</div>`;
		setTimeout(
			() => {
				if (G.mode !== "end") return;
				stamp(html);
				say(`${won ? COPY.win : lost ? COPY.lost : COPY.over} ${s[0]}: ${G.score}.`);
				snd?.play?.("paper");
			},
			won ? 300 : 900,
		);
	}
	async function share() {
		const text = COPY.share(G.last.t, G.last.rank),
			b = card.querySelector('[data-a="share"]');
		try {
			if (navigator.share) return void (await navigator.share({ text, url: location.origin + "/" }));
		} catch (e) {
			if (e.name === "AbortError") return;
		}
		try {
			await navigator.clipboard.writeText(text);
			b.textContent = B[8];
		} catch {}
	}

	function step(h) {
		const run = G.mode === "run";
		G.t += run ? h : 0;
		if (run && !G.cine0 && G.D > P1 - 150) {
			G.cine0 = 1;
			G.cine = 3.8;
			dia.classList.add("on");
			lab.className = "gm-lab";
			G.lab = null;
			say(`${COPY.input}: ${COPY.prompt.join("")}`);
		}
		if (G.cine > 0 && (G.cine -= h) < 1 && !dia.classList.contains("in")) dia.classList.add("in");
		const cine = G.cine > 0;
		G.D += SPD * (G.boostT > 0 ? 1.55 : 1) * (run ? (cine ? 0.25 : 1) : 0.3) * h;
		const zs = zS();
		G.phase = G.D < P1 ? 0 : G.D < P1 + P2 ? 1 : 2;
		if (run) spawn();
		// the play box eases from over the surface down into the network
		const k = clamp((G.D - (P1 - 90)) / 130, 0, 1),
			ke = k * k * (3 - 2 * k);
		for (let i = 0; i < 4; i++) box[i] = mix(BOX[0][i] * (i < 2 && W < H ? 0.7 : 1), BOX[1][i], ke);
		// steering: keys, the stick and a gamepad set a velocity; the mouse sets a target
		let ix = (K.d || K.arrowright ? 1 : 0) - (K.a || K.arrowleft ? 1 : 0),
			iy = (K.w || K.arrowup ? 1 : 0) - (K.s || K.arrowdown ? 1 : 0);
		if (G.ptr) ((ix = G.ptr.dx), (iy = -G.ptr.dy));
		else if (G.gp) ((ix = G.gp[0]), (iy = -G.gp[1]));
		else if (G.mouse && !ix && !iy) {
			ix = clamp((mix(box[0], box[1], (G.mouse[0] + 1) / 2) - G.x) / 3, -1, 1);
			iy = clamp((mix(box[3], box[2], (G.mouse[1] + 1) / 2) - G.y) / 3, -1, 1);
		}
		if (!run || cine) ix = iy = 0;
		if (ix || iy) G.ev.steer += h;
		G.vx += (ix * 20 - G.vx) * Math.min(1, h * 7);
		G.vy += (iy * 15 - G.vy) * Math.min(1, h * 7);
		G.x += G.vx * h;
		G.y += G.vy * h;
		// the network's walls bite; over the surface the box is soft
		if (G.x < box[0] || G.x > box[1]) {
			// the network's walls bounce you back (a shake, never a shield)
			if (ke > 0.9 && Math.abs(G.vx) > 4) ((G.vx *= -0.6), (G.shake = Math.min(1, G.shake + 0.3)), sfx.hurt());
			G.x = clamp(G.x, box[0], box[1]);
		}
		G.y = clamp(G.y, box[2], box[3]);
		G.roll = mix(G.roll, -G.vx * 0.045, Math.min(1, h * 8));
		G.pitch = mix(G.pitch, G.vy * 0.018, Math.min(1, h * 8));
		// fire from alternate wing tips (faster when fine-tuned); the wingman fires along
		const firing = run && !cine && (G.fire || K[" "] || G.gpFire);
		if (firing) G.ev.fire += h;
		G.splay = mix(G.splay, firing || G.phase === 0 ? 1 : 0.25, Math.min(1, h * 5));
		G.cool -= h;
		if (firing && G.cool <= 0) {
			G.cool = G.fast > 0 ? 0.075 : 0.13;
			const s = (G.side = -G.side);
			for (let i = 0; i < (G.mate > 0 ? 2 : 1); i++) {
				const l = lasers.get();
				if (!l) break;
				l.x = i ? G.wx : G.x + s * 2.4;
				l.y = i ? G.wy : G.y + s * 0.2;
				l.z = zs - 2;
				l.vz = -260;
			}
			spark(G.x + s * 2.4, G.y, zs - 2.6, 0, 0, -SPD, 0.5, 0.12, 2);
			sfx.pew();
		}
		G.inv -= h;
		G.boostT -= h;
		G.fast -= h;
		G.mate -= h;
		if (run && (K.shift || G.gpBoost)) {
			if (G.boostT < 0.1) sfx.whoosh();
			G.boostT = Math.max(G.boostT, 0.15);
			G.ev.boost = 1;
		}
		G.wx = mix(G.wx, G.x + 3.2, Math.min(1, h * 3));
		G.wy = mix(G.wy, G.y + 1.4, Math.min(1, h * 3));

		for (const l of lasers.items) {
			if (!l.on) continue;
			const z0 = l.z;
			l.z += l.vz * h;
			if ((l.t += h) > 1.1) l.on = false;
			else laserHit(l, z0);
		}
		for (const e of hal.items) {
			if (!e.on) continue;
			e.a += h;
			e.x += Math.sin(e.a * 1.7) * 5 * h;
			e.y += Math.cos(e.a * 1.3) * 2.5 * h;
			e.z += e.vz * h;
			// wobbly and certain: it rolls about but never changes its mind about the heading
			e.rz = Math.sin(e.a * 3) * 0.5;
			e.rx = Math.sin(e.a * 2.3) * 0.3;
			e.sx = 1 + Math.sin(e.a * 6) * 0.12;
			e.sy = 1 - Math.sin(e.a * 6) * 0.1;
			e.f -= h;
			const dz = zs - e.z;
			// they hold fire through the tutorial
			if ((e.t -= h) < 0 && dz > 30 && dz < 150 && run && G.t > 6)
				((e.t = R(1.5, 2.7)), shoot(e.x, e.y, e.z, G.x, G.y, zs - 20, 24));
			if (e.z > zs + 4) e.on = false;
			else if (Math.abs(e.z - zs) < 1.6 && Math.hypot(e.x - G.x, e.y - G.y) < 1.9 && G.inv <= 0)
				(hurt("hal"), kill(e, 0));
		}
		for (const P of [inj, half])
			for (const e of P.items) {
				if (!e.on) continue;
				e.a += h;
				e.x += e.vx * h + Math.sin(e.a * 2) * 2 * h;
				e.vx *= 1 - h * 1.5;
				e.z += (e.vz || 8) * h;
				e.ry += h * (P === half ? 6 : 1.2);
				e.sx = e.sy = e.sz = (P === half ? 0.55 : 1) * (1 + Math.sin(e.a * 5) * 0.07);
				if (e.z > zs + 4) e.on = false;
				else if (Math.abs(e.z - zs) < 1.4 && Math.hypot(e.x - G.x, e.y - G.y) < 2 * e.sx + 0.4 && G.inv <= 0)
					(hurt("inj"), kill(e, 0));
			}
		for (let i = 0; i < heads.items.length; i++) {
			const e = heads.items[i],
				g = gaze.items[i];
			if (!e.on) {
				if (g.on) ((g.on = false), (gaze.dirty = true));
				continue;
			}
			const dz = zs - e.z;
			// turn to look, hold the gaze (a pink line), then fire straight along it
			if (e.b === 0) {
				_v.set(G.x - e.x, G.y - e.y, zs - e.z);
				e.ry = Math.atan2(_v.x, _v.z);
				e.rx = -Math.atan2(_v.y, Math.hypot(_v.x, _v.z));
				if ((e.t -= h) < 0 && dz > 45 && dz < 200 && run) {
					e.b = 1;
					e.a = 0.85;
					e.gx = G.x;
					e.gy = G.y;
					e.gz = zs - 16;
				}
			} else if (e.b === 1) {
				if ((e.a -= h) < 0) {
					shoot(e.x, e.y, e.z, e.gx, e.gy, e.gz, 34, 2);
					sfx.pew();
					// deeper in, heads fire a pair along the same gaze
					if (!e.n && G.D > P1 + P2 / 2) ((e.n = 1), (e.a = 0.14));
					else ((e.b = 2), (e.n = 0), (e.t = R(1.2, 2.2)));
				}
			} else if ((e.t -= h) < 0) ((e.b = 0), (e.t = R(0.3, 0.9)));
			g.on = e.b === 1;
			if (g.on) {
				_v.set(e.gx - e.x, e.gy - e.y, e.gz - e.z);
				g.x = e.x;
				g.y = e.y;
				g.z = e.z;
				g.sz = _v.length();
				g.sx = g.sy = 1.2 + (0.85 - e.a) * 1.6;
				g.ry = Math.atan2(_v.x, _v.z);
				g.rx = -Math.asin(_v.y / g.sz);
			}
			e.f -= h;
			e.sx = e.sy = e.sz = 1.5 * (1 + Math.sin(G.t * 4 + i) * 0.05);
			if (Math.abs(e.z - zs) < 1.6 && Math.hypot(e.x - G.x, e.y - G.y) < 2.4) hurt("head");
			if (e.z > zs + 4) e.on = false;
		}
		for (const e of grads.items) {
			if (!e.on) continue;
			const dz = zs - e.z;
			// rise, swell and burst: dodge the ring
			e.sy = clamp((250 - dz) / 70, 0.01, 1) * 7.5;
			const sw = clamp((150 - dz) / 100, 0, 1);
			e.sx = e.sz = 1.8 + sw * 1.1 + Math.sin(G.t * 18) * 0.2 * sw;
			e.f -= h;
			if (dz < 42 && run) pop(e);
			else if (Math.abs(dz) < 1.5 && Math.abs(G.x - e.x) < e.sx / 2 + 1 && G.y < TF + e.sy) hurt("grad");
			if (e.z > zs + 4) e.on = false;
		}
		for (const s of shots.items) {
			if (!s.on) continue;
			s.x += s.vx * h;
			s.y += s.vy * h;
			s.z += s.vz * h;
			if ((s.t += h) > 5 || s.z > zs + 4 || s.y < TF - 1) s.on = false;
			else if (Math.abs(s.z - zs) < 1.4 && Math.hypot(s.x - G.x, s.y - G.y) < 1.5 && G.inv <= 0)
				((s.on = false), hurt(["shot", "burst", "gaze"][s.k]));
		}
		for (let k = 0; k < 3; k++)
			for (const p of picks[k].items) {
				if (!p.on) continue;
				p.ry += h * 2.4;
				p.y += Math.sin((p.a += h) * 3) * h;
				// help drifts towards you once it is close
				const dx = G.x - p.x,
					dy = G.y - p.y,
					dd = Math.hypot(dx, dy);
				if (zs - p.z < 45 && dd < 12 && dd > 0.2)
					((p.x += (dx / dd) * h * 9 * (1 - dd / 12)), (p.y += (dy / dd) * h * 9 * (1 - dd / 12)));
				if (p.z > zs + 10) p.on = false;
				else if (run && Math.abs(p.z - zs) < 2.4 && Math.hypot(p.x - G.x, p.y - G.y) < 2.8) {
					p.on = false;
					G.score += 50;
					if (k === 0) G.sh = Math.min(7, G.sh + 1);
					if (k === 1) G.fast = 8;
					if (k === 2) ((G.mate = 8), (G.wx = G.x), (G.wy = G.y));
					float(COPY.gain[k], 1);
					burst(p.x, p.y, p.z, 12, 10, 0.7, 1);
					say(COPY.picks[k]);
					sfx.chime();
					buzz(15);
				}
			}
		for (const s of sparks.items) {
			if (!s.on) continue;
			s.x += s.vx * h;
			s.y += s.vy * h;
			s.z += s.vz * h;
			s.vx *= 1 - h * 2;
			s.vy *= 1 - h * 2;
			const q = (s.t += h) / s.b;
			s.sx = s.sy = s.sz = s.a * (1 + q * 2.2) * (1 - q);
			if (q >= 1) s.on = false;
		}
		// the boost trail: halftone dots out of both engines
		if (G.boostT > 0 && run)
			for (const x of [-0.42, 0.42])
				spark(G.x + x, G.y, zs + 2.6, R(-1, 1), R(-1, 1), 20, 0.35, 0.45, R() < 0.5 ? 1 : 2);
		if (G.D > P1 - 400 && G.mode === "run")
			for (G.pt -= h; G.pt < 0; G.pt += 0.028)
				for (let i = 0; i < 6; i++) {
					const w = weights.items[(R() * weights.items.length) | 0];
					if (!w.on || w.z > zs + 6 || zs - w.z > 180) continue;
					const q = pulses.get();
					if (q) ((q.w = w), (q.t = 0));
					break;
				}
		for (const q of pulses.items) {
			if (!q.on) continue;
			const w = q.w,
				u = w.k === 9 ? q.t : 1 - q.t;
			if (!w.on || (q.t += h / 0.45) >= 1) {
				q.on = false;
				if (w.na && w.k !== 9) ((w.na.f = 0.12), (neurons.dirty = true));
				continue;
			}
			q.x = w.x + w.dx * u;
			q.y = w.y + w.dy * u;
			q.z = w.z + w.dz * u;
		}
		for (const n of neurons.items) if (n.on && n.f > 0 && (n.f -= h) <= 0) neurons.dirty = true;
		// layers: neurons light up as you pass them, and the counter counts up
		for (const g of gates.items)
			if (g.on && !g.c && g.z > zs && G.phase > 0 && run) {
				g.c = 1;
				for (const n of neurons.items) if (n.on && Math.abs(n.z - g.z) < 0.01) n.c = 4;
				neurons.dirty = true;
			}
		if (G.phase > 0 && G.mode !== "won") G.layer = clamp(Math.floor(((G.D - P1) / (P2 + P3)) * 95) + 1, 1, 95);
		// the last layer: chatter, the targeting computer, one torpedo
		const nd = zs - G.out;
		if (G.phase === 2 && run) {
			if (!aim.classList.contains("on")) {
				aim.classList.add("on");
				chat.textContent = COPY.chatter;
				chat.classList.add("on");
				setTimeout(() => chat.classList.remove("on"), 4200);
				say(`${COPY.phases[2]}. ${COPY.chatter}`);
				toast(COPY.phases[2]);
			}
			const ok = nd < 170 && nd > 22 && !torp.items[0].on;
			if (ok !== G.torpOK) {
				G.torpOK = ok;
				tpBtn.hidden = !(ok && touch);
				if (ok) toast(COPY.fire[touch ? 1 : 0], 2);
			}
			if ((beepT -= h) < 0) ((beepT = clamp(nd / 420, 0.08, 0.7)), sfx.beep());
			if (nd < 4 && !torp.items[0].on) miss();
		} else if (G.phase === 1 && G.ph1 !== 1) {
			G.ph1 = 1;
			toast(COPY.phases[1]);
			say(COPY.phases[1]);
		}
		const t = torp.items[0];
		if (t.on) {
			t.z += t.vz * h;
			// a little autocomplete pulls a close shot home
			const dx = -t.x,
				dy = NY - t.y;
			if (Math.hypot(dx, dy) < 3.4) ((t.x += dx * h * 2.2), (t.y += dy * h * 2.2));
			t.rz += h * 9;
			if (t.z <= G.out) {
				t.on = false;
				if (Math.hypot(t.x, t.y - NY) < 3) win();
				else (burst(t.x, t.y, t.z, 20, 18), sfx.boom(), miss());
			}
		}
	}

	function loop(now) {
		raf = 0;
		if (G.mode === "pause" || G.mode === "gone") return;
		const fdt = Math.min(0.1, (now - last) / 1000);
		last = now;
		adapt(fdt);
		pollPad();
		let dt = Math.min(0.05, fdt) * G.slow;
		G.slow = mix(G.slow, 1, Math.min(1, fdt * 0.9));
		// hit-stop: a few frames of stillness on a kill
		if (G.stop > 0) ((G.stop -= fdt), (dt = 0));
		const n = Math.ceil(dt * 60);
		for (let i = 0; i < n; i++) step(dt / n);
		if (G.mode === "won") {
			G.boom += fdt;
			// the network goes to sleep in a wave rolling out of the node, then the big print
			const reach = G.out + G.boom * 150;
			for (const q of neurons.items) if (q.on && q.c && q.z < reach) ((q.c = 0), (neurons.dirty = true));
			if (G.boom > 3.4) end(true);
		}
		render(fdt, now);
		raf = requestAnimationFrame(loop);
	}

	let lastScore = -1,
		lastSh = -1,
		lastLayer = -1,
		lastBar = -1,
		lastRd = "";
	function render(fdt, now) {
		const zs = zS();
		// the ship banks into turns and pitches with the climb; wing tips splay open to attack
		ship.position.set(G.x, G.y, zs);
		ship.scale.setScalar(W < H ? 0.82 : 1);
		ship.rotation.set(G.pitch, 0, G.roll);
		ship.visible = !G.dead && !(G.inv > 0 && G.mode === "run" && Math.floor(G.inv * 12) % 2);
		const a = G.splay * 0.34;
		for (let i = 0; i < 4; i++) {
			const [sx, sy] = WING[i];
			WM[i + 1]
				.makeTranslation(sx * 0.72, 0, 0.1)
				.multiply(_mR.makeRotationFromEuler(_e.set(0, -sx * a, sx * sy * a * 0.3)))
				.multiply(_mT.makeTranslation(-sx * 0.72, 0, -0.1));
		}
		// the wingman is printed all in yellow: help looks like help
		const m = mates.items[0];
		if (G.mate > 0 && G.mode === "run") {
			if (!m.on) (mates.get(), (m.sx = m.sy = m.sz = 0.55), (m.c = 2));
			m.x = G.wx;
			m.y = G.wy;
			m.z = zs + 1.5;
			m.rx = G.pitch;
			m.rz = G.roll * 1.3;
		} else m.on = false;
		// camera: a beat behind, a trauma shake, a push on boost
		G.shake = Math.max(0, G.shake - fdt * 1.6);
		const sk = G.shake * G.shake * 0.9,
			bx = G.boostT > 0 ? 1 : 0;
		G.mis = mix(G.mis, bx * 0.9, Math.min(1, fdt * 3));
		const fx = W < H ? 0.92 : 0.7,
			// the establishing shot pulls the camera up and back over the trench mouth
			cb = G.cine > 0 ? Math.min(1, (3.8 - G.cine) * 1.4, G.cine * 1.1) : 0;
		camera.position.set(
			G.x * fx + R(-1, 1) * sk,
			G.y + 3.3 + cb * 10 + R(-1, 1) * sk * 0.7,
			zs + 12.5 + cb * 20 - bx * 1.5,
		);
		camera.lookAt(G.x * (fx + 0.1), G.y + 0.9 - cb * 6, zs - 26);
		camera.rotateZ(G.roll * 0.35 * (1 - cb));
		const fov = fov0() + bx * 7 + cb * 8;
		if (Math.abs(camera.fov - fov) > 0.05) {
			camera.fov = mix(camera.fov, fov, Math.min(1, fdt * 5));
			camera.updateProjectionMatrix();
		}
		U.uMis.value = G.mis + (G.mode === "won" ? 0.8 : 0);
		U.uSpd.value = mix(U.uSpd.value, bx ? 1 : 0.35, Math.min(1, fdt * 4));
		U.uT.value = now / 1000;
		U.uStar.value.set(-G.x * 3 + now * 0.004, -G.y * 3);
		U.uHit.value = G.hit = Math.max(0, G.hit - fdt * 2.2);
		if (G.boom >= 0) {
			_proj.set(0, NY, G.out).project(camera);
			const b = Math.max(0, G.boom - 1.1);
			U.uBoom.value.set(((_proj.x + 1) / 2) * U.uRes.value.x, ((_proj.y + 1) / 2) * U.uRes.value.y, b * 1.1, +(b > 0));
			U.uWave.value = G.boom < 1.3 ? G.boom * 1.4 : -1;
			U.uFlash.value = b > 0 ? Math.exp(-b * 3) : 0;
		} else U.uBoom.value.w = U.uFlash.value = 0;
		if (eng && G.mode === "run") {
			const t = A.ac.currentTime;
			eng.g.gain.setTargetAtTime(0.045, t, 0.1);
			eng.o.frequency.setTargetAtTime(46 + bx * 22, t, 0.2);
			eng.f.frequency.setTargetAtTime(240 + bx * 520, t, 0.2);
		}
		// the node wears its OUTPUT stamp; the targeting computer counts it down
		const nd = zs - G.out;
		if (G.phase === 2 && nd > 8 && G.mode === "run") {
			_proj.set(0, NY + 5, G.out).project(camera);
			outEl.style.opacity = _proj.z < 1 ? 1 : 0;
			outEl.style.translate = `${(((_proj.x + 1) / 2) * W - 40) | 0}px ${(((1 - _proj.y) / 2) * H - 24) | 0}px`;
			const r = `${COPY.out} ${String(Math.max(0, Math.round(nd))).padStart(4, "0")}`;
			if (r !== lastRd) rd.textContent = lastRd = r;
			rt0.classList.toggle("lk", G.torpOK && Math.hypot(G.x, G.y - NY) < 3);
			ln.setAttribute("transform", `translate(0 ${-Math.round(clamp(nd / 170, 0, 1) * 40)})`);
		} else outEl.style.opacity = 0;
		// the node glows from far off, long before the fog gives it up
		_proj.set(0, NY, G.out).project(camera);
		U.uNode.value.set(
			((_proj.x + 1) / 2) * U.uRes.value.x,
			((_proj.y + 1) / 2) * U.uRes.value.y,
			G.phase > 0 && G.boom < 0 && _proj.z < 1 && nd < 900
				? Math.max(26 * pr, (9 * U.uRes.value.y) / Math.max(nd, 1))
				: 0,
		);
		// HUD: touch only what changed
		if (G.score !== lastScore) scoreEl.textContent = (lastScore = G.score).toLocaleString("en");
		if (G.sh !== lastSh) winEl.style.setProperty("--n", (lastSh = G.sh));
		if (G.layer !== lastLayer) {
			layerEl.textContent = (lastLayer = G.layer) ? COPY.layer(G.layer) : "";
			you.setAttribute("cx", 6 + (G.layer / 96) * 110);
		}
		const bp = Math.round(clamp(1 - (zs - G.out) / END, 0, 1) * 200);
		if (bp !== lastBar) bar.style.setProperty("--d", `${(lastBar = bp) / 2}%`);
		if ((toastT -= fdt) < 0 && toastEl.classList.contains("on")) toastEl.classList.remove("on");
		// where the ship is on screen, for the printed feedback
		_proj.set(G.x, G.y + 1.4, zs).project(camera);
		G.sx = ((_proj.x + 1) / 2) * W;
		G.sy = ((1 - _proj.y) / 2) * H;
		// every fourth layer wears a stamp naming its block, so the network reads as an architecture
		let li = 0;
		if (G.phase > 0 || G.D > P1 - 200)
			for (const g of gates.items) {
				const dz = zs - g.z;
				if (li > 2 || !g.on || g.k % 4 !== 1 || dz < 14 || dz > 170) continue;
				_proj.set(0, 0.2, g.z).project(camera);
				const e = lls[li++],
					t = COPY.layers[(g.k >> 2) % 4];
				if (e.textContent !== t) e.textContent = t;
				e.style.translate = `${(((_proj.x + 1) / 2) * W) | 0}px ${(((1 - _proj.y) / 2) * H) | 0}px`;
				e.style.opacity = clamp((170 - dz) / 50, 0, 1);
			}
		for (; li < 3; li++) lls[li].style.opacity = 0;
		// the first time each kind shows up, a hand-note names it and says what to do (once per visit)
		if (G.lab) {
			const L = G.lab;
			if (L.it.on) {
				_proj.set(L.it.x, L.it.y + (L.it.sy > 2 ? L.it.sy : 1), L.it.z).project(camera);
				L.x = Math.min(((_proj.x + 1) / 2) * W, W - 330);
				L.y = ((1 - _proj.y) / 2) * H;
			}
			lab.style.translate = `${(L.x + 14) | 0}px ${(L.y - 54) | 0}px`;
			if ((L.t -= fdt) < 0) ((lab.className = "gm-lab"), (G.lab = null));
		} else if (G.mode === "run" && G.cine <= 0)
			for (const [P, k, pal] of KIND) {
				if (MET.has(k)) continue;
				for (const it of P.items) {
					const dz = zs - it.z;
					if (!it.on || dz < 22 || dz > 110) continue;
					_proj.set(it.x, it.y, it.z).project(camera);
					if (Math.abs(_proj.x) > 0.8 || Math.abs(_proj.y) > 0.8) continue;
					MET.add(k);
					G.lab = { it, t: 2.8, x: ((_proj.x + 1) / 2) * W, y: ((1 - _proj.y) / 2) * H };
					labT.textContent = COPY.meet[k];
					lab.className = `gm-lab on ${pal ? "pal" : "foe"}`;
					break;
				}
				if (G.lab) break;
			}
		// the tutorial crosses itself out as you go
		if (tut.style.opacity !== "0") {
			const e = G.ev;
			tutS[0].classList.toggle("ok", e.steer > 0.6);
			tutS[1].classList.toggle("ok", e.fire > 0.3);
			tutS[2].classList.toggle("ok", !!e.boost);
			if ((e.steer > 0.6 && e.fire > 0.3) || G.t > 12) tut.style.opacity = 0;
		}
		recycle();
		for (const p of pools) p.flush();
		renderer.setRenderTarget(rt);
		renderer.render(scene, camera);
		renderer.setRenderTarget(null);
		renderer.render(printScene, camera);
	}

	/* ---------- leave: dispose everything and put the page back exactly ---------- */
	function close(restore = true) {
		if (G.mode === "gone") return;
		G.mode = "gone";
		cancelAnimationFrame(raf);
		ac.abort();
		if (eng) {
			eng.g.gain.setTargetAtTime(0, A.ac.currentTime, 0.05);
			eng.o.stop(A.ac.currentTime + 0.3);
		}
		for (const p of pools) p.mesh.dispose();
		for (const x of trash) x.dispose();
		renderer?.dispose();
		if (renderer && !renderer.getContext().isContextLost()) renderer.forceContextLoss();
		if (d.open) d.close();
		d.remove();
		root.classList.remove("playing");
		scrollTo({ top: y0, behavior: "instant" });
		if (restore && opener?.isConnected) opener.focus({ preventScroll: true });
		onClose?.();
	}

	// print a first frame behind the loading card, then go
	render(0, performance.now());
	setTimeout(() => G.mode === "load" && start(), 1100);
	return G;
}
