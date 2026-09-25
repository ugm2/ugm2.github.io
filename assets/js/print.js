// The portrait re-printed live as three riso plates (raw WebGL2, on demand).

const VS = `#version 300 es
in vec2 p;out vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0,1);}`;

const FS = `#version 300 es
precision highp float;
uniform sampler2D uImg,uMask,uDepth;
uniform vec2 uLook;
uniform vec3 uY,uP,uK;
uniform vec4 uPrint;
uniform float uPx,uDpr;
in vec2 v;out vec4 o;
// baked relief: 0 paper, H0 the outline and shoulders, 1 the nose
const float H0=.5;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float lum(vec4 c){return mix(1.,dot(c.rgb,vec3(.299,.587,.114)),c.a);}
float L(vec2 q,float b){return lum(textureLod(uImg,q,b));}
float D(vec2 q){return textureLod(uDepth,q,0.).r;}
vec2 eye(vec2 q,vec2 c,vec2 r,vec2 l){float f=smoothstep(1.,.15,length((q-c)/r));return q-l*f*r*.32;}
vec2 eyes(vec2 q){
  vec2 l=uLook*vec2(1,.8);
  q=eye(q,vec2(.548,.537),vec2(.045,.028),l);
  return eye(q,vec2(.691,.633),vec2(.036,.024),l);}
// steep parallax from the nose down to the outline; the first surface met wins
vec2 turn(vec2 q,vec2 s){
  vec2 a=q-s*(1.-H0);float da=D(a)-1.;
  if(da>=0.)return a;
  for(int i=1;i<=12;i++){
    float t=1.-(1.-H0)*float(i)/12.;
    vec2 b=q-s*(t-H0);float db=D(b)-t;
    if(db>=0.)return mix(a,b,da/(da-db));
    a=b;da=db;}
  return q;}
float ink(vec2 q){
  float px=.9/900.,m=L(q,0.);
  m=min(m,L(q+vec2(px,0),0.));
  m=min(m,L(q+vec2(0,px),0.));
  float e=L(q,.6)-L(q,2.6);
  return max(1.-smoothstep(.14,.36,m),smoothstep(-.03,-.09,e));}
float dots(vec2 f,float a,float cell,float d){
  mat2 R=mat2(cos(a),-sin(a),sin(a),cos(a));
  vec2 c=fract(R*f/cell)-.5;
  float r=sqrt(d)*.62;
  return smoothstep(r+.08,r-.08,length(c));}
float wipe(float t){return 1.-smoothstep(t*1.1-.1,t*1.1,1.-v.y);}
void main(){
  vec2 vb=vec2(v.x*1500.,(1.-v.y)*900.);
  vec2 q=(vb-vec2(600.,0.))/900.;
  vec2 fc=gl_FragCoord.xy/uDpr;
  float n=h(floor(fc/1.5)),mis=1.-uPrint.w;
  // ~±11° yaw, ±6° pitch
  vec2 s=uLook*vec2(.08,.045);
  vec2 th=turn(q,s);
  // plate depths: yellow deepest, ink on top
  vec2 oY=vec2(-7.,-5.)/900.+vec2(-40.,10.)/900.*mis;
  vec2 oP=vec2(8.,6.)/900.+vec2(30.,-25.)/900.*mis;
  vec2 qk=eyes(th),qp=eyes(th+s*.04-oP),qy=eyes(th+s*.09-oY);
  vec4 mp=texture(uMask,qp),my=texture(uMask,qy);
  // the hatch is paper-deep: it slides the other way under a halftone shadow
  vec2 qb=q+s*H0*.35;
  vec2 hb=vb+uLook*vec2(-4.,-3.);
  float inH=step(60.,hb.x)*step(hb.x,1470.)*step(220.,hb.y)*step(hb.y,510.);
  float halo=textureLod(uMask,qb,3.2).g;
  float hat=inH*(1.-smoothstep(.02,.1,halo))*(1.-texture(uMask,qk).g);
  float sh=smoothstep(.05,.4,textureLod(uMask,qb-vec2(.028,.02)-s*.5,3.4).g)*.7;
  float y=hat*smoothstep(.3-.12*sh,.2-.12*sh,abs(fract((hb.x-hb.y)*uPx/8.)-.5));
  float fd=1.-smoothstep(.36,.5,length(q-.5))*smoothstep(.5,.72,q.y);
  float fh=mix(dots(fc,.9,5.,fd),1.,step(.999,fd));
  y=max(y,my.g*(1.-my.r)*.95*fh);
  // light only as halftone density
  vec2 g=vec2(D(qp+vec2(.004,0))-D(qp-vec2(.004,0)),D(qp+vec2(0,.004))-D(qp-vec2(0,.004)));
  float dark=1.-L(qp,2.5)+clamp(dot(g,uLook)*1.6,-.07,.07)*mp.g;
  float ht=dots(fc,.26,5.5,clamp((dark-.12)*1.3,0.,1.))*mp.g*(1.-.35*mp.g*(1.-mp.r));
  float p=max(mp.r*.36,ht*.95)*(1.-mp.b)*fh;
  float k=ink(qk)*smoothstep(.1,.5,textureLod(uMask,qk,2.).g);
  k*=step(h(floor(fc/2.)+7.),fd*1.15);
  y*=wipe(uPrint.x)*(.8+.2*n);
  p*=wipe(uPrint.y)*(.82+.18*n);
  k*=wipe(uPrint.z)*(.9+.1*n);
  o=vec4(mix(vec3(1),uY,y)*mix(vec3(1),uP,p)*mix(vec3(1),uK,k),1);}`;

const EYES = [
	[500, 489, 37, 14],
	[630, 574, 28, 11],
];

export function rgb(css) {
	const x = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
	x.fillStyle = css;
	x.fillRect(0, 0, 1, 1);
	const d = x.getImageData(0, 0, 1, 1).data;
	return [d[0] / 255, d[1] / 255, d[2] / 255];
}

function masks(n, fig, skin) {
	const c = document.createElement("canvas");
	c.width = c.height = n;
	const x = c.getContext("2d");
	x.scale(n / 900, n / 900);
	x.globalCompositeOperation = "lighter";
	x.filter = "blur(1px)";
	x.fillStyle = "#f00";
	x.fill(new Path2D(skin));
	x.fillStyle = "#0f0";
	x.fill(new Path2D(fig));
	x.fillStyle = "#00f";
	for (const [cx, cy, rx, ry] of EYES) {
		x.beginPath();
		x.ellipse(cx, cy, rx, ry, 0.5, 0, 7);
		x.fill();
	}
	return c;
}

export async function mountPrint(canvas, { src, depth, fig, skin, dpr, onLost }) {
	const gl = canvas.getContext("webgl2", {
		alpha: false,
		antialias: false,
		powerPreference: "low-power",
	});
	if (!gl) throw new Error("webgl2");
	const load = (u) => {
		const i = new Image();
		i.src = u;
		return i.decode().then(() => i);
	};
	// no relief: a flat map at the pivot depth keeps the head still
	const flat = () => {
		const c = document.createElement("canvas");
		c.width = c.height = 1;
		const x = c.getContext("2d");
		x.fillStyle = "rgb(128,128,128)";
		x.fillRect(0, 0, 1, 1);
		return c;
	};
	const [img, rel] = await Promise.all([load(src), depth ? load(depth).catch(flat) : flat()]);
	const pr = gl.createProgram();
	for (const [t, s] of [
		[gl.VERTEX_SHADER, VS],
		[gl.FRAGMENT_SHADER, FS],
	]) {
		const o = gl.createShader(t);
		gl.shaderSource(o, s);
		gl.compileShader(o);
		gl.attachShader(pr, o);
	}
	gl.bindAttribLocation(pr, 0, "p");
	gl.linkProgram(pr);
	if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
	gl.useProgram(pr);
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	gl.enableVertexAttribArray(0);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
	[img, masks(512, fig, skin), rel].forEach((source, u) => {
		gl.activeTexture(gl.TEXTURE0 + u);
		gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	});
	const U = {};
	for (const n of ["uImg", "uMask", "uDepth", "uLook", "uY", "uP", "uK", "uPrint", "uPx", "uDpr"])
		U[n] = gl.getUniformLocation(pr, n);
	gl.uniform1i(U.uImg, 0);
	gl.uniform1i(U.uMask, 1);
	gl.uniform1i(U.uDepth, 2);
	const cs = getComputedStyle(canvas);
	gl.uniform3fv(U.uY, rgb(cs.getPropertyValue("--yellow")));
	gl.uniform3fv(U.uP, rgb(cs.getPropertyValue("--pink")));
	gl.uniform3fv(U.uK, rgb(cs.getPropertyValue("--ink")));
	canvas.addEventListener("webglcontextlost", (e) => {
		e.preventDefault();
		onLost && onLost();
	});
	const state = { look: [0, 0], print: [1, 1, 1, 1] };
	const draw = () => {
		const w = Math.round(canvas.clientWidth * dpr),
			h = Math.round(canvas.clientHeight * dpr);
		if (!w || !h || gl.isContextLost()) return;
		if (canvas.width !== w || canvas.height !== h) {
			canvas.width = w;
			canvas.height = h;
			gl.viewport(0, 0, w, h);
		}
		gl.uniform1f(U.uPx, w / dpr / 1500);
		gl.uniform1f(U.uDpr, dpr);
		gl.uniform2f(U.uLook, state.look[0], state.look[1]);
		gl.uniform4fv(U.uPrint, state.print);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	};
	return { state, draw };
}
