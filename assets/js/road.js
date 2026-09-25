// The road: a procedural career diorama; G-buffer -> one riso print pass.
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { rgb } from "./print.js";

const { Vector3: V3, Matrix4: M4 } = THREE;
const PI = Math.PI;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mix = (a, b, t) => a + (b - a) * t;
let seed = 5;
const rnd = (a = 0, b = 1) => a + (b - a) * ((seed = (seed * 16807) % 2147483647) / 2147483647);

/* ---------- parts: every piece carries its inks, an outline id and a part index ---------- */
// ink code: p / y / k = pink / yellow / ink, a digit = tenths (p4 = 40% tint);
// s = sits in shade (s3 = 30% light), l = never shaded, o = no outline,
// = = same outline id as the last part
let uid = 0;
function inks(code) {
	const v = [0, 0, 0, 1, 0, 1];
	let same = false;
	for (const [, c, n] of code.matchAll(/([pykslo=])(\d?)/g)) {
		const t = n ? +n / 10 : 1;
		if (c === "o") v[5] = 0;
		else if (c === "l") v[3] = 2;
		else if (c === "=") same = true;
		else v["pyks".indexOf(c)] = c === "s" && !n ? 0.3 : t;
	}
	if (!same) uid = (uid % 250) + 1;
	v[4] = uid / 255;
	return v;
}
let fine = 1;
const UNIT = {};
const SHAPES = {
	b: () => new RoundedBoxGeometry(1, 1, 1, fine, 0.2),
	x: () => new THREE.BoxGeometry(1, 1, 1),
	c: () => new THREE.CylinderGeometry(0.5, 0.5, 1, 14 * fine),
	k: () => new THREE.ConeGeometry(0.5, 1, 14 * fine),
	s: () => new THREE.SphereGeometry(0.5, 12 * fine, 8 * fine),
	q: () => new THREE.SphereGeometry(0.5, 6 + 3 * fine, 4 + 2 * fine),
	o: () => new THREE.TorusGeometry(0.5, 0.07, 8, 24 * fine),
	l: () => new THREE.CapsuleGeometry(0.5, 1, 4 * fine, 12 * fine),
};
const flat = (g) => (g.index ? g.toNonIndexed() : g);
const shape = (g) => (typeof g === "string" ? (UNIT[g] ||= flat(SHAPES[g]())) : flat(g));
const _m = new M4();
const _n = new THREE.Matrix3();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new V3();
const _s = new V3();
const frame = (x, y, z, ry = 0, rx = 0) =>
	new M4().makeRotationY(ry).multiply(new M4().makeRotationX(rx)).setPosition(x, y, z);
function kit(list, base = new M4(), part = 0) {
	const P = (g, code, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) => {
		g = shape(g);
		_m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz)).premultiply(base);
		list.push([
			g.attributes.position.clone().applyMatrix4(_m),
			g.attributes.normal.clone().applyNormalMatrix(_n.getNormalMatrix(_m)),
			inks(code),
			part,
		]);
	};
	P.src = (s) =>
		s
			.trim()
			.split("\n")
			.forEach((l) => {
				const [g, c, ...n] = l.trim().split(/\s+/);
				P(g, c, ...n.map(Number));
			});
	P.at = (x, y, z, ry = 0) => kit(list, base.clone().multiply(new M4().makeRotationY(ry).setPosition(x, y, z)), part);
	P.in = (m) => kit(list, base.clone().multiply(m), part);
	P.part = (i) => kit(list, new M4(), i);
	return P;
}
function geo(list) {
	const n = list.reduce((a, [p]) => a + p.count, 0);
	const pos = new Float32Array(n * 3);
	const nor = new Float32Array(n * 3);
	const ink = new Float32Array(n * 4);
	const aux = new Float32Array(n * 3);
	let o = 0;
	for (const [p, q, v, part] of list) {
		pos.set(p.array, o * 3);
		nor.set(q.array, o * 3);
		for (let i = o; i < o + p.count; i++) {
			ink.set(v.slice(0, 4), i * 4);
			aux.set([v[4], v[5], part], i * 3);
		}
		o += p.count;
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
	g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
	g.setAttribute("ink", new THREE.BufferAttribute(ink, 4));
	g.setAttribute("aux", new THREE.BufferAttribute(aux, 3));
	g.computeBoundingSphere();
	list.length = 0;
	return g;
}
let LAMP, DOME, VAULT, HALF, RIB, FENDER;
const ring = (r0, r1, h) => new THREE.CylinderGeometry(r1, r0, h, 14 * fine);
const ss = (a, b, x) => ((x = clamp((x - a) / (b - a), 0, 1)), x * x * (3 - 2 * x));
const bump = (x, a, b) => (x > a && x < b ? Math.sin((PI * (x - a)) / (b - a)) : 0);
const arc = (a, b, f, up, out) => out.lerpVectors(a, b, f).setY(out.y + Math.sin(PI * f) * up);

/* ---------- landmarks: one self-contained builder per stop ----------
   build(P) -> { h, T, fx }. P(...) adds static parts; P.part(i) is a kit for animated
   part i (1..15), authored around its own pivot. fx(t, pose) places the parts at local
   time t via pose(i, x, y, z, rx, ry, rz, scale, amount, parent). Only the current stop's
   clock runs and it always halts on a multiple of T, so fx(0) is the still pose.
   Face +z (the road), base at y = 0, inside a paper coin of radius COIN. */
const COIN = 3.7;
const PAD = `c w 0 .17 0 ${COIN * 2} .34 ${COIN * 2}
  c s7o .8 .01 -.6 ${COIN * 2 + 0.6} .02 ${COIN * 2 + 0.2}`;
function start(P) {
	P.src(`c k 0 1.8 0 .16 3.6 .16
    s y 0 3.7 0 .36
    c s4o .6 .01 -.4 1.4 .02 1.4`);
	P.part(1)("b", "p", 0.78, 0, 0, 1.5, 0.95, 0.1);
	return {
		h: 3.8,
		T: 2,
		fx: (t, pose) => pose(1, 0, 3.05, 0, 0, Math.sin(PI * t) * 0.3),
	};
}
function kiosk(P) {
	const nb = fine < 2 ? 3 : 5;
	const C = new V3(-1.55, 3.75, -1.15);
	const K = P.at(C.x, 0, C.z);
	K.src(`c w 0 1.3 0 2.2 1.9 2.2
    c p 0 2.3 0 2.3 .12 2.3
    c p= 0 2.95 0 .8 .16 .8
    c y -.78 3.37 0 .1 .8 .1
    c y= .78 3.37 0 .1 .8 .1
    c k 0 3.75 0 .05 1.7 .05 0 0 1.5708
    c y .92 3.75 0 .16 .12 .16 0 0 1.5708
    c k= 1 3.58 0 .05 .34 .05`);
	K(new THREE.CylinderGeometry(1.115, 1.115, 0.72, 10 * fine, 1, true, -0.95, 1.9), "k3", 0, 1.6, 0);
	K(new THREE.CylinderGeometry(1.3, 1.3, 0.08, 10 * fine, 1, false, -0.95, 1.9), "y", 0, 1.2, 0);
	for (let i = 0; i < 12; i++)
		K(
			new THREE.ConeGeometry(1.45, 0.62, 2 * fine, 1, true, (i * PI) / 6, PI / 6),
			i % 2 ? "w=" : i ? "p=" : "p",
			0,
			2.66,
			0,
		);
	const wire = new THREE.TorusGeometry(1, 0.045, 4, 18 * fine);
	const cage = P.part(1);
	cage(wire, "k", 0, 0, 0, 0.74, 0.74, 0.74, 0, PI / 2);
	cage(wire, "k=", 0, 0, 0, 0.74, 0.74, 0.74);
	cage(wire, "k=", 0, 0, 0, 0.74, 0.74, 0.74, PI / 2);
	for (let j = 0; j < nb; j++) P.part(2 + j)("s", ["p", "y", "w", "y", "p"][j], 0, 0, 0, 0.3);
	const TK = frame(-0.2, 1.45, 2, 0.12, -0.25).scale(new V3(1.2, 1.2, 1.2));
	P.in(TK).src(`c k -.7 -.72 -.08 .07 1 .07
    c k= .7 -.72 -.08 .07 1 .07
    b w 0 0 0 2 1.05 .05
    b p -.75 0 .03 .5 1.05 .03
    b y .45 .27 .035 .7 .24 .03
    x k5o .3 -.08 .045 .9 .05 .02
    x k5o= .3 -.26 .045 .9 .05 .02
    c p .75 -.3 .045 .24 .02 .24 1.5708`);
	const box = P.part(6);
	for (const [x, y] of [
		[-1, -1],
		[-1, 1],
		[1, -1],
		[1, 1],
	]) {
		box("x", "k", x * 1.03, y * 0.5, 0, 0.36, 0.07, 0.05);
		box("x", "k=", x * 1.17, y * 0.36, 0, 0.07, 0.34, 0.05);
	}
	const tick = (Q, r = 0.5) => {
		Q("c", "y l", 0, 0, 0, r, 0.03, r, PI / 2);
		Q("x", "k o", -0.14 * r, -0.04 * r, 0.03, 0.12 * r, 0.32 * r, 0.03, 0, 0, 0.7);
		Q("x", "k o", 0.1 * r, 0.06 * r, 0.03, 0.12 * r, 0.56 * r, 0.03, 0, 0, -0.55);
	};
	tick(P.part(7));
	P.part(8)("x", "y l", 0, 0, 0, 0.07, 1.15, 0.04);
	const PH = frame(2.3, 0.34, 0.05, -0.5);
	P.in(PH).src(`b y 0 .14 .1 1.3 .28 .9
    b k 0 1.9 0 1.7 3.2 .24
    b w 0 1.95 .13 1.46 2.74 .02
    b p 0 2.45 .145 .98 .54 .02
    b y .18 2.55 .15 .3 .12 .02
    x k5o 0 1.95 .15 .9 .05 .02
    x k5o= 0 1.78 .15 .9 .05 .02
    x k 0 3.35 .13 .4 .07 .02
    c y 0 .82 .145 .32 .02 .32 1.5708`);
	tick(P.part(10), 0.34);
	const a = new V3(0, 2.1, -0.1).applyMatrix4(PH);
	const b = new V3().setFromMatrixPosition(TK);
	P.part(9)(new THREE.ConeGeometry(1, 1, 4, 1, true).rotateY(PI / 4), "y2 o l", 0, 0, 0, 0.8, a.distanceTo(b), 0.42);
	const beam = new M4().compose(
		a.clone().lerp(b, 0.5),
		new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), a.clone().sub(b).normalize()),
		new V3(1, 1, 1),
	);
	return {
		h: 4.3,
		T: 8,
		fx(t, pose) {
			const r = (t / 8) * PI * 2;
			pose(1, C.x, C.y, C.z, r);
			for (let j = 0; j < nb; j++) {
				const f = 0.75 * Math.sin(r * (2 + (j % 3)) + j * 1.9);
				pose(2 + j, C.x + (j - (nb - 1) / 2) * 0.24, C.y - 0.38 * Math.cos(f), C.z + 0.38 * Math.sin(f));
			}
			const s = (t % 4) / 4;
			const on = s < 0.5 ? 1 - ss(0.3, 0.4, s) : ss(0.8, 0.86, s);
			pose(6, 0, 0, 0.07, 0, 0, 0, 1 + 0.35 * (s > 0.8 ? 1 - ss(0.8, 0.88, s) : 0), on, TK);
			const ck = s < 0.5 ? 1 - ss(0.3, 0.4, s) : ss(0.88, 0.94, s);
			const pop = 0.9 + 0.3 * bump(s, 0.88, 1);
			pose(7, 1.02, 0.52, 0.1, 0, 0, 0, pop, ck, TK);
			pose(10, 0.42, 2.72, 0.16, 0, 0, 0, pop, ck, PH);
			pose(8, -0.98 + 1.96 * ss(0.42, 0.78, s), 0, 0.07, 0, 0, 0, 1, s > 0.41 && s < 0.79 ? 1 : 0, TK);
			pose(9, 0, 0, 0, 0, 0, 0, 1, 0.3 + 0.7 * bump(s, 0.38, 0.82), beam);
		},
	};
}
function sorter(P) {
	const n = fine < 2 ? 3 : 5;
	P.src(`${PAD}
    b w -1.4 2.24 -1.3 2.3 3.8 2
    x k -1.4 4.17 -1.3 2.34 .06 2.04
    b p -1.4 4.38 -1.3 1.5 .36 1
    q y -1.85 4.74 -1.3 .5
    q p4 -1.4 4.8 -1.3 .46
    q y5 -.98 4.72 -1.3 .42
    b k3 -1.4 .98 -.28 .9 1.22 .06
    b y -1.4 1.72 -.2 1.3 .12 .4`);
	for (const x of [-2.15, -1.65, -1.15, -0.65]) P("b", x > -2.15 ? "k3=" : "k3", x, 2.9, -0.29, 0.3, 2.2, 0.04);
	for (const z of [-2.05, -1.55, -1.05, -0.55]) P("b", "k3=", -0.24, 2.6, z, 0.04, 2.9, 0.3);
	const B0 = new V3(-0.75, 0.95, 0);
	const B1 = new V3(1.5, 0.95, 1.15);
	const yaw = Math.atan2(B1.x - B0.x, B1.z - B0.z);
	const len = B0.distanceTo(B1);
	const mid = B0.clone().lerp(B1, 0.5);
	P.at(mid.x, 0, mid.z, yaw).src(`b w 0 .62 0 .95 .3 ${len + 0.35}
    x k 0 .79 0 .82 .06 ${len + 0.2}
    c y 0 .66 ${len / 2 + 0.12} .34 .98 .34 0 0 1.5708
    c k -.36 .34 ${0.25 - len / 2} .09 .6 .09
    c k= .36 .34 ${0.25 - len / 2} .09 .6 .09
    c k= -.36 .34 ${len / 2 - 0.05} .09 .6 .09
    c k= .36 .34 ${len / 2 - 0.05} .09 .6 .09`);
	const INK = ["p", "y", "k4"];
	for (let j = 0; j < n; j++) {
		const T = P.part(1 + j);
		T("b", "w", 0, 0.035, 0, 0.62, 0.06, 0.44);
		T("x", INK[j % 3] + "o", -0.2, 0.07, 0, 0.14, 0.02, 0.44);
		T("x", "k5o", 0.08, 0.07, 0.08, 0.3, 0.015, 0.05);
		T("x", "k5o", 0.08, 0.07, -0.06, 0.3, 0.015, 0.05);
	}
	const A = new V3(1.95, 1.15, 1.45);
	P.src(`c k 1.95 .72 1.45 .14 .8 .14`);
	const arm = P.part(9);
	arm("b", "p", 0.5, 0, 0, 1, 0.08, 0.16);
	arm("b", "p=", 0.98, 0, 0, 0.1, 0.28, 0.36);
	arm("s", "y", 0, 0, 0, 0.24);
	const S = [
		[2.75, 0.5],
		[3, 1.65],
		[2.2, 2.6],
	];
	for (let c = 0; c < 3; c++) {
		const Q = P.part(10 + c);
		for (let i = 0; i < 6; i++)
			Q(
				"x",
				i % 2 ? "w" : INK[c],
				0.03 * Math.sin(i * 2.1 + c),
				0.06 + i * 0.12,
				0,
				0.82,
				0.12,
				0.6,
				0,
				0.08 * Math.sin(i * 3.7 + c),
			);
	}
	const aim = ([x, z]) => Math.atan2(-(z - A.z), x - A.x);
	const rest = aim([B1.x, B1.z]);
	const D = 7 / n;
	const p = new V3();
	return {
		h: 4.9,
		T: 7,
		fx(t, pose) {
			const tt = (t + 2.6) % 7;
			const cnt = [0, 0, 0];
			const land = (j) => (0.9 * 7 - j * D + 7) % 7;
			for (let j = 0; j < n; j++) if (tt >= land(j)) cnt[j % 3]++;
			let ang = rest;
			for (let j = 0; j < n; j++) {
				const c = j % 3;
				const s = ((tt + j * D) % 7) / 7;
				const [sx, sz] = S[c];
				const top = 0.34 + 0.72 * (0.55 + (cnt[c] - (tt >= land(j) ? 1 : 0)) * 0.15) + 0.06;
				if (s < 0.75) pose(1 + j, ...p.lerpVectors(B0, B1, s / 0.75).toArray(), 0, yaw, 0, 1, ss(0, 0.05, s));
				else if (s < 0.9) {
					const f = (s - 0.75) / 0.15;
					arc(B1, p.set(sx, top, sz), f, 0.8, p);
					pose(1 + j, p.x, p.y, p.z, 0, yaw + f * 2.2, Math.sin(PI * f) * 0.5);
				} else pose(1 + j, 0, 0, 0, 0, 0, 0, 1, 0);
				const w = bump(s, 0.7, 0.95);
				if (w) ang = rest + Math.atan2(Math.sin(aim(S[c]) - rest), Math.cos(aim(S[c]) - rest)) * w;
			}
			pose(9, A.x, A.y, A.z, 0, ang);
			for (let c = 0; c < 3; c++)
				pose(10 + c, S[c][0], 0.34, S[c][1], 0, c * 0.5 - 0.3, 0, [1, 0.55 + cnt[c] * 0.15, 1]);
		},
	};
}
function library(P) {
	P.src(`${PAD}
    b w 0 .44 -1.5 4 .2 2.2
    b w= 0 .62 -1.55 3.6 .2 1.9
    b w= 0 .8 -1.6 3.2 .2 1.6
    b w 0 1.9 -1.95 2.7 2 1
    b k 0 1.45 -1.43 .7 1.1 .06
    b w 0 3.02 -1.65 3.3 .34 1.75
    c w 0 3.42 -1.7 2 .5 2
    s p 0 4.78 -1.7 .26
    b p 0 5.2 -1.7 .16 .56 .16
    b p= 0 5.26 -1.7 .46 .16 .16`);
	P(DOME, "p6", 0, 3.66, -1.7, 1.05);
	for (const x of [-1.2, -0.4, 0.4, 1.2])
		P.src(`c w ${x} 1.95 -1.05 .34 2 .34
      b w= ${x} 2.9 -1.05 .46 .12 .46
      b w= ${x} .95 -1.05 .44 .1 .44`);
	P.src(`b p -1.6 .96 -.75 .55 .1 .4 0 .2
    b y -1.6 1.06 -.75 .5 .1 .36 0 -.1
    b w -1.6 1.16 -.75 .46 .1 .34 0 .3
    b y 1.6 .96 -.7 .55 .1 .4 0 -.2
    b w 1.6 1.06 -.7 .5 .1 .36 0 .15`);
	const Sc = P.at(2.35, 0.34, 1.25, 0.45);
	for (const [x, y] of [
		[-0.3, 0.2],
		[0.3, 0.2],
		[0, 0.58],
	]) {
		Sc("c", "w", x, y, 0, 0.4, 1.3, 0.4, 0, 0, PI / 2);
		Sc("c", "p", x, y, 0, 0.44, 0.2, 0.44, 0, 0, PI / 2);
		Sc("c", "p l", x + 0.1, y - 0.02, 0.2, 0.16, 0.05, 0.16, PI / 2);
	}
	P.src(`b w -.3 .66 1.35 1.5 .65 .9
    c k -.3 .4 1.35 .12 .4 .12`);
	const BK = frame(-0.3, 1.06, 1.35, 0, 0.5);
	const R = [-0.5, -0.17, 0.17, 0.5];
	const book = P.in(BK);
	book.src(`b p 0 0 0 2.7 .06 1.7
    b w -.65 .06 0 1.25 .06 1.56 0 0 .05
    b w= .65 .06 0 1.25 .06 1.56 0 0 -.05`);
	for (const z of R) for (const x of [-0.65, 0.65]) book("x", "k5o", x, 0.1, z, 0.95, 0.01, 0.06);
	R.forEach((z, i) => {
		const L = P.part(1 + i);
		for (const x of [-0.65, 0.65]) L("x", "y l o", x, 0, 0, 1.02, 0.012, 0.11);
	});
	const lens = P.part(5);
	lens("o", "k", 0, 0, 0, 1.3, 1.3, 1.6);
	lens("c", "y2 o l", 0, 0, 0, 1.25, 0.015, 1.25, PI / 2);
	lens("c", "p", 0.86, -0.74, 0, 0.2, 1.1, 0.2, 0, 0, 0.72);
	return {
		h: 5.5,
		T: 7,
		fx(t, pose) {
			const a = (t / 7) * PI * 2 + 0.9;
			const z = 0.5 * Math.sin(a);
			R.forEach((r, i) => pose(1 + i, 0, 0.11, r, 0, 0, 0, 1, clamp(1 - Math.abs(z - r) / 0.28, 0, 1), BK));
			pose(5, 0.34 * Math.sin(2 * a), 1.05, z, -PI / 2 + 0.55, 0, 0.15, 1, 1, BK);
		},
	};
}
function airfield(P) {
	const nb = fine < 2 ? 2 : 3;
	P.src(`${PAD}
    b k3 0 .37 1.72 6.5 .04 1.3
    b w -1.2 .45 -.9 3.2 .2 3
    c k 2.7 1.35 .3 .08 2 .08`);
	for (let x = -2.7; x < 3; x += 0.9) P("x", x > -2.7 ? "wo=" : "wo", x, 0.4, 1.72, 0.45, 0.02, 0.09);
	P(VAULT, "p6", -1.2, 0.55, -0.9, 1.45, 1.45, 3);
	P(HALF, "w", -1.2, 0.55, 0.6, 1.45);
	P(HALF, "k3", -1.2, 0.55, 0.62, 1);
	P(HALF, "w", -1.2, 0.55, -2.4, 1.45, 1.45, 1.45, 0, PI);
	for (const z of [-2.1, -0.9, 0.3]) P(RIB, "k", -1.2, 0.55, z, 1.47, 1.47, 1);
	for (let i = 0; i < 6; i++)
		P(ring(0.3 - i * 0.03, 0.27 - i * 0.03, 0.8), i ? (i % 2 ? "w=" : "p=") : "p", 1.95, 0.8 + i * 0.8, -1.7);
	P.src(`s p 1.95 5.45 -1.7 .32
    x k 1.95 4.6 -1.7 .9 .05 .05`);
	const sock = P.part(1);
	[0.26, 0.22, 0.18].forEach((r, i) =>
		sock(ring(r, r - 0.04, 0.4), ["p", "w=", "p="][i], 0.2 + i * 0.4, 0, 0, 1, 1, 1, 0, 0, -PI / 2),
	);
	const BD = frame(1.1, 1.75, 0.35, -0.4);
	P.in(BD).src(`c k -.9 -.9 -.06 .08 1.8 .08
    c k= .9 -.9 -.06 .08 1.8 .08
    b w 0 0 0 2.35 1.35 .08
    x p -.75 .52 .05 .6 .12 .02
    x y 0 .52 .05 .6 .12 .02
    x k .75 .52 .05 .6 .12 .02
    x k5o -.375 -.08 .05 .02 1.1 .02
    x k5o= .375 -.08 .05 .02 1.1 .02`);
	const CX = [-0.75, 0, 0.75];
	for (let j = 0; j < 6; j++) {
		const Cd = P.part(2 + j);
		Cd("b", ["p4", "y5", "w"][j % 3], 0, 0, 0, 0.6, 0.3, 0.035);
		Cd("x", "k5o", -0.08, 0, 0.025, 0.34, 0.03, 0.01);
	}
	for (let b = 0; b < nb; b++) {
		const B = P.part(8 + b);
		B.src(`b ${b % 2 ? "y" : "w"} 0 0 0 .62 .42 .14
      b ${b % 2 ? "y" : "w"}= -.18 -.22 0 .14 .14 .1 0 0 .8`);
		for (const x of [-0.15, 0, 0.15]) B("s", "k o", x, 0, 0.08, 0.09);
	}
	const dr = P.part(12);
	dr.src(`l w 0 0 0 .26 .5 .26 1.5708
    b w 0 .02 .05 3.4 .05 .34
    b p 1.62 .025 .05 .26 .06 .36
    b p= -1.62 .025 .05 .26 .06 .36
    b p .2 .16 -.5 .5 .04 .22 0 0 .6
    b p= -.2 .16 -.5 .5 .04 .22 0 0 -.6
    s k 0 -.12 .32 .14`);
	P.part(13).src(`x k 0 0 0 .8 .03 .07
    c k 0 0 0 .1 .06 .1 1.5708`);
	const M = new V3(1.95, 5.5, -1.7);
	const p = new V3();
	const q = new V3();
	return {
		h: 6.5,
		T: 16,
		fx(t, pose) {
			const a = (t / 16) * PI * 2 + 2.3;
			// an ellipse in front of the hangar, clear of the sticky nav
			const D = pose(
				12,
				-0.6 + 3.2 * Math.cos(a),
				6.1 + 0.12 * Math.sin(2 * a),
				1.3 + 1.7 * Math.sin(a),
				0,
				Math.atan2(-3.2 * Math.sin(a), 1.7 * Math.cos(a)),
				-0.28,
				1.4,
			);
			pose(13, 0, 0, -0.62, 0, 0, t * 40, 1, 1, D);
			pose(1, 2.7, 2.2, 0.3, 0, -0.5 + 0.25 * Math.sin(a * 3), 0.08 * Math.sin(a * 5));
			const s = (t + 9) % 16;
			for (let j = 0; j < 6; j++) {
				const L = 3 + 2.4 * j;
				const v = s < 0.6 ? 1 - ss(0, 0.6, s) : ss(L, L + 0.25, s);
				pose(2 + j, CX[j % 3], j < 3 ? 0.14 : -0.26, 0.07, 0, 0, 0, 1 + 0.3 * bump(s, L, L + 0.4), v, BD);
			}
			for (let b = 0; b < nb; b++) {
				let shown = false;
				for (let j = b; j < 6; j += nb) {
					const f = (s - 0.8 - 2.4 * j) / 2.2;
					if (f < 0 || f > 1) continue;
					q.set(CX[j % 3], j < 3 ? 0.14 : -0.26, 0.12).applyMatrix4(BD);
					arc(M, q, ss(0, 1, f), 1.4, p);
					pose(8 + b, p.x, p.y, p.z, 0, -0.35, 0, 1.35 - 0.7 * f, ss(0, 0.1, f));
					shown = true;
				}
				if (!shown) pose(8 + b, 0, 0, 0, 0, 0, 0, 1, 0);
			}
		},
	};
}
function hq(P) {
	const nb = fine < 2 ? 2 : 3;
	P.src(`${PAD}
    b w -.4 1.64 -1.15 3.7 2.6 2.4
    b p -.4 2.72 -1.15 3.8 .4 2.5
    b k3 -.4 .98 .06 1 1.25 .06
    b y -.4 3.06 -1.2 .9 .25 .6
    c k 1.2 1.35 1.15 .12 2 .12
    c k= 2.5 1.35 1.15 .12 2 .12
    b y 1.85 2.4 1.15 1.6 .2 .22
    c w .75 .79 2.05 .64 .9 .64
    c p .75 1.28 2.05 .44 .08 .44`);
	for (const x of [-1.8, -1.25, 0.45, 1]) P("b", "y", x, 1.95, 0.06, 0.46, 0.5, 0.05);
	for (const x of [1.4, 1.85, 2.3]) P("x", "k o", x, 2.4, 1.15, 0.12, 0.21, 0.23, 0, 0, 0.6);
	P(HALF, "p", -0.4, 1.9, 0.09, 0.62, 0.5, 1);
	P(HALF, "k3o", -0.4, 1.9, 0.1, 0.1, 0.5, 1);
	P("x", "k", -0.4, 1.72, 0.1, 0.05, 0.4, 0.03);
	P(new THREE.TorusGeometry(0.1, 0.028, 4, 8, PI), "k", -0.5, 1.53, 0.1, 1, 1, 1, 0, 0, PI);
	P.in(frame(-0.4, 3.18, -1.15)).src(`b k 0 1.2 0 1.25 2.4 .18
    b w 0 1.25 .1 1.07 2.08 .02
    b p 0 1.5 .12 .6 .38 .02
    b p= -.18 1.26 .12 .14 .14 .02 0 0 .8
    c y 0 .38 .11 .22 .02 .22 1.5708`);
	P.part(1).src(`c k 0 -.25 0 .05 .5 .05
    c y 0 -.55 0 .2 .3 .2
    b p 0 -.75 0 .5 .16 .4
    b k 0 -.84 0 .46 .03 .36`);
	P.part(2).src(`c y -.35 0 0 .07 .7 .07 0 0 1.5708
    c p -.72 0 0 .24 .45 .24 1.5708`);
	const bub = (B, ink) => {
		B.src(`b ${ink} 0 0 0 .62 .42 .14
      b ${ink}= -.18 -.22 0 .14 .14 .1 0 0 .8
      b wo .02 .06 .08 .42 .05 .02
      b wo= -.04 -.06 .08 .3 .05 .02`);
	};
	for (let b = 0; b < nb; b++) {
		bub(P.part(3 + b), "p");
		const C = P.part(6 + b);
		C("c", "y l", 0, 0, 0, 0.32, 0.02, 0.32, PI / 2);
		C("x", "k o", -0.04, -0.01, 0.02, 0.04, 0.1, 0.02, 0, 0, 0.7);
		C("x", "k o", 0.03, 0.02, 0.02, 0.04, 0.18, 0.02, 0, 0, -0.55);
	}
	bub(P.part(9), "y");
	const S0 = new V3(-0.4, 4.55, -0.95);
	const G = new V3(1.85, 1.4, 1.15);
	const E = new V3(3.4, 2.7, 3);
	const p = new V3();
	return {
		h: 5.8,
		T: 12,
		fx(t, pose) {
			const s = (t + 4.5) % 12;
			let press = 0;
			for (let b = 0; b < nb; b++) {
				let shown = false;
				for (let j = b; j < 6; j += nb) {
					const f = (s - 2 * j) / 3.6;
					if (f < 0 || f > 1) continue;
					if (f < 0.5) arc(S0, G, ss(0, 1, f / 0.5), 0.8, p);
					else arc(G, E, (f - 0.5) / 0.5, 0.6, p);
					const v = ss(0, 0.06, f) * (1 - ss(0.82, 1, f));
					const B = pose(3 + b, p.x, p.y, p.z, 0, -0.2, 0, 1.35, v);
					pose(6 + b, 0.26, 0.18, 0.09, 0, 0, 0, 1, f > 0.5 ? v * ss(0.5, 0.54, f) : 0, B);
					press = Math.max(press, bump(f, 0.43, 0.57));
					shown = true;
				}
				if (!shown) (pose(3 + b, 0, 0, 0, 0, 0, 0, 1, 0), pose(6 + b, 0, 0, 0, 0, 0, 0, 1, 0));
			}
			pose(1, 1.85, 2.3 - 0.28 * press, 1.15);
			const r = (s - 7) / 3;
			if (r > 0 && r < 1) {
				arc(E, S0, ss(0, 1, r), 1.2, p);
				pose(9, p.x, p.y, p.z, 0, 0.4, 0, 1.35, ss(0, 0.1, r) * (1 - ss(0.9, 1, r)));
			} else pose(9, 0, 0, 0, 0, 0, 0, 1, 0);
			const tap = Math.max(bump(s, 1, 1.35), bump(s, 5, 5.35), bump(s, 9, 9.35));
			pose(2, 1.15, 1.38, 2.05, 0, 0, -0.6 * (1 - tap));
		},
	};
}
function coupe(P, W, G) {
	const ext = (pts, w, b = 0) =>
		new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), {
			depth: w - 2 * b,
			bevelEnabled: b > 0,
			bevelSize: b,
			bevelThickness: b,
			bevelOffset: -b,
			bevelSegments: 2,
			curveSegments: 4,
		})
			.rotateY(-PI / 2)
			.translate(w / 2 - b, 0, 0);
	const pts = (s) => s.split(" ").map((p) => p.split(",").map(Number));
	P(
		ext(
			pts("1.86,.24 1.99,.42 1.97,.55 1.82,.63 1.1,.69 .5,.71 -.9,.73 -1.72,.74 -1.96,.66 -1.99,.44 -1.86,.24"),
			1.7,
			0.06,
		),
		"p",
	);
	P(ext(pts(".52,.7 .02,1 -.46,1.03 -.82,.99 -1.7,.76 -1.62,.7"), 1.12, 0.05), "p=");
	P(ext(pts(".4,.76 .03,.96 -.44,.99 -.76,.95 -1.38,.78"), 1.18), "k4");
	const stripe = ext(
		pts(
			"2,.45 1.99,.575 1.84,.66 1.1,.72 .5,.74 .5,.69 .02,.99 .02,1.035 -.46,1.065 -.82,1.025 -.82,.98 -1.7,.75 -1.72,.77 -1.97,.69 -2,.45 -1.9,.5 1.9,.5",
		),
		0.3,
	);
	P(stripe, "yo", 0.18);
	P(stripe, "yo=", -0.18);
	P.src(`x k4 0 .867 .28 1 .03 .62 .54
    x k4 0 .894 -1.265 .95 .03 .92 -.255
    b k 0 .42 1.99 .7 .1 .04
    b w 0 .3 2 1.6 .08 .1
    b w= 0 .3 -2 1.6 .08 .1
    b y 0 .9 -1.82 1.3 .04 .26
    b k .5 .82 -1.8 .05 .14 .08
    b k= -.5 .82 -1.8 .05 .14 .08`);
	for (const x of [-1, 1]) {
		for (const z of [1.18, -1.18]) P(FENDER, "p", x * 0.86, 0.38, z, 0.3, 0.47, 0.58);
		P("c", "y l", x * 0.56, 0.54, 1.97, 0.26, 0.06, 0.26, PI / 2);
		P("b", "k", x * 0.6, 0.6, -1.99, 0.32, 0.08, 0.04);
		P("c", "k", x * 0.4, 0.3, -2.02, 0.12, 0.2, 0.12, PI / 2);
		G(LAMP, "y4 o l", x * 0.56, 0.07, 2.05, 1, 1, 1, -PI / 2);
		P("c", "w", x * 0.865, 0.5, -0.05, 0.4, 0.03, 0.4, 0, 0, PI / 2);
		const L = (z, y, w, h) => P("x", "k o", x * 0.882, 0.5 + y, -0.05 - x * z, 0.01, h, w);
		L(-0.075, 0, 0.026, 0.12);
		L(-0.013, 0, 0.026, 0.12);
		L(-0.044, -0.056, 0.074, 0.026);
		L(0.022, 0, 0.026, 0.12);
		L(0.056, 0.056, 0.074, 0.026);
		L(0.056, -0.056, 0.074, 0.026);
		L(0.082, -0.026, 0.026, 0.06);
		W("c", x < 0 ? "k" : "k=", x * 0.84, 0, 0, 0.76, 0.32, 0.76, 0, 0, PI / 2);
		W("c", "w", x * 0.84, 0, 0, 0.44, 0.34, 0.44, 0, 0, PI / 2);
		W("c", "p", x * 0.84, 0, 0, 0.16, 0.36, 0.16, 0, 0, PI / 2);
		W("x", "k o", x * 1.01, 0, 0, 0.02, 0.38, 0.05);
		W("x", "k o", x * 1.01, 0, 0, 0.02, 0.05, 0.38);
	}
	G("c", "s5o", 0, 0.045, 0, 2.3, 0.02, 4.3);
}

function tree(P, kind, s) {
	if (kind < 0.55) {
		P("c", "k", 0, 0.7 * s, 0, 0.2, 1.4 * s, 0.2);
		P("q", ["y", "w", "p4", "y5"][(kind * 7.2) | 0], 0, 2 * s, 0, 1.7 * s, 1.55 * s, 1.7 * s);
	} else if (kind < 0.8) {
		P("c", "k", 0, 0.4, 0, 0.2, 0.8, 0.2);
		P("k", kind < 0.7 ? "w" : "p4", 0, 0.8 + 1.4 * s, 0, 1.5 * s, 2.8 * s, 1.5 * s);
	} else P("q", "p4", 0, 0.45 * s, 0, 1.5 * s, 0.9 * s, 1.3 * s);
	P("c", "s6o", 0.6 * s, 0.01, -0.4 * s, 1.9 * s, 0.02, 1.7 * s);
}

const SV = `precision highp float;
uniform mat4 modelMatrix,viewMatrix,projectionMatrix,uM[16];uniform float uA[16];
in vec3 position,normal,aux;in vec4 ink;
out vec3 vN,vW,vA;out vec4 vI;
void main(){int i=int(aux.z+.5);mat4 m=modelMatrix*uM[i];vec4 w=m*vec4(position,1.);vW=w.xyz;vN=mat3(m)*normal;vI=ink;
vA=vec3(aux.xy,uA[i]);gl_Position=projectionMatrix*viewMatrix*w;}`;
const SF = `precision highp float;
uniform mat4 viewMatrix;uniform vec3 uSun;uniform vec4 uFade;
in vec3 vN,vW,vA;in vec4 vI;
layout(location=0) out vec4 oC;layout(location=1) out vec4 oN;
void main(){vec3 n=normalize(vN);
float f=(1.-smoothstep(.7,1.,length((vW.xz-uFade.xy)/uFade.zw)))*vA.z;
oC=vec4((1.-clamp(.58+.55*dot(n,uSun),0.,1.)*vI.w)*f,vI.xyz*f);
oN=vec4(normalize(mat3(viewMatrix)*n).xy*.5+.5,vA.x,vA.y*f);}`;
const PV = `in vec3 position;void main(){gl_Position=vec4(position.xy,0.,1.);}`;
const PF = `precision highp float;
uniform sampler2D tC,tN,tD;uniform vec2 uRes,uNF;uniform float uDpr,uMis;uniform vec3 uY,uP,uK,uPrint;uniform vec2 uVeil;
out vec4 o;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f*=f*(3.-2.*f);
return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
vec4 C(vec2 p){return texture(tC,p/uRes);}
float Z(vec2 p){float d=texture(tD,p/uRes).r;return uNF.x*uNF.y/(uNF.y-d*(uNF.y-uNF.x));}
float dots(vec2 f,float a,float cell,float d){mat2 R=mat2(cos(a),-sin(a),sin(a),cos(a));
vec2 c=fract(R*f/cell)-.5;float r=sqrt(d)*.62;return smoothstep(r+.08,r-.08,length(c))*step(.03,d);}
float edge(vec2 p,float r,float g){vec4 a=texture(tN,p/uRes);float za=Z(p),e=0.;
for(int i=0;i<4;i++){vec2 q=p+vec2(i==0?r:i==1?-r:0.,i==2?r:i==3?-r:0.);
vec4 b=texture(tN,q/uRes);float zb=Z(q);
float d=max(smoothstep(.012,.04,abs(za-zb)/min(za,zb)),max(smoothstep(.18,.34,distance(a.xy,b.xy)),step(.002,abs(a.z-b.z))));
e=max(e,d*step(g+.001,za<zb?a.w:b.w));}
return e;}
void main(){vec2 px=gl_FragCoord.xy,fc=px/uDpr;float n=h(floor(fc/1.5));
vec2 w=(vec2(vn(fc*.035),vn(fc*.035+19.))-.5)*2.6*uDpr;
float k=edge(px+w,uDpr*(1.+.8*vn(fc*.02+7.)),h(floor(fc/2.)+7.)*.95);
k*=step(h(floor(fc/2.)+3.),.95);
vec4 c=C(px);k=max(k,c.a>.97?1.:dots(fc,.785,3.4,c.a));
vec2 oP=(vec2(4.,-3.)+uMis*vec2(8.,5.))*uDpr,oY=(vec2(-4.,3.)+uMis*vec2(-9.,-4.))*uDpr;
vec4 cp=C(px-oP),cy=C(px-oY);
float p=max(cp.g,dots(fc,.26,5.5,clamp((cp.r-.2)*1.45,0.,1.))*.95);
float y=cy.b>.97?1.:smoothstep(cy.b*.5+.05,cy.b*.5-.05,abs(fract((fc.x+fc.y)/8.)-.5))*step(.03,cy.b);
vec3 wp=1.-smoothstep(uPrint*1.1-.1,uPrint*1.1,vec3(1.-px.y/uRes.y));
float fv=mix(1.,smoothstep(uVeil.x-.03,uVeil.x+.1,px.x/uRes.x),uVeil.y);
wp*=fv>.999?1.:dots(fc,.9,5.,fv);
y*=(.8+.2*n)*wp.x;p*=(.82+.18*n)*wp.y;k*=(.9+.1*n)*wp.z;
o=vec4(mix(vec3(1),uY,y)*mix(vec3(1),uP,p)*mix(vec3(1),uK,k),1);}`;

const PTS = "-31 6,-24 7,-17 3.5,-11 -.5,-5 .5,1 4.5,7 4,12.5 .5,18 -1.5,24 1,30 3.5,35 4";
const STOPS = [
	[0.05, start],
	[0.215, kiosk],
	[0.385, sorter],
	[0.56, library],
	[0.73, airfield],
	[0.895, hq],
];

export async function mountRoad(canvas, { light, dpr, onLost }) {
	fine = light ? 1 : 2;
	LAMP = new THREE.CircleGeometry(2.6, 8 * fine, -PI / 2 - 0.3, 0.6);
	DOME = new THREE.SphereGeometry(1, 16 * fine, 6 * fine, 0, PI * 2, 0, PI / 2);
	VAULT = new THREE.CylinderGeometry(1, 1, 1, 16 * fine, 1, true, PI / 2, PI).rotateX(PI / 2);
	HALF = new THREE.CircleGeometry(1, 16 * fine, 0, PI);
	RIB = new THREE.TorusGeometry(1, 0.03, 4, 16 * fine, PI);
	FENDER = new THREE.CylinderGeometry(1, 1, 1, 10 * fine, 1, false, 0, PI).rotateZ(PI / 2);
	const renderer = new THREE.WebGLRenderer({
		canvas,
		antialias: false,
		alpha: false,
		powerPreference: "high-performance",
	});
	renderer.setPixelRatio(dpr);
	renderer.setClearColor(0, 0);
	canvas.addEventListener("webglcontextlost", (e) => {
		e.preventDefault();
		onLost?.();
	});
	const camera = new THREE.PerspectiveCamera(30, 1, 1, 420);
	const scene = new THREE.Scene();
	const sun = new V3(-0.55, 0.75, 0.38).normalize();
	const mat = new THREE.RawShaderMaterial({
		glslVersion: THREE.GLSL3,
		vertexShader: SV,
		fragmentShader: SF,
		uniforms: {
			uSun: { value: sun },
			uFade: { value: new THREE.Vector4(2, -1, 37, 17) },
			uM: { value: Array.from({ length: 16 }, () => new M4()) },
			uA: { value: Array(16).fill(1) },
		},
	});
	const add = (g, parent = scene, m = mat) => parent.add(new THREE.Mesh(g, m)).children.at(-1);
	const moving = (g, parent) => {
		const m = add(g, parent, mat.clone());
		const M = (m.material.uniforms.uM = { value: Array.from({ length: 16 }, () => new M4()) }).value;
		const A = (m.material.uniforms.uA = { value: Array(16).fill(1) }).value;
		m.frustumCulled = false;
		m.pose = (i, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sc = 1, a = 1, parent) => {
			const k = a > 0.002 ? 1 : 0;
			const [sx, sy, sz] = sc.length ? sc : [sc, sc, sc];
			M[i].compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx * k, sy * k, sz * k));
			if (parent) M[i].premultiply(parent);
			A[i] = a;
			return M[i];
		};
		return m;
	};

	const curve = new THREE.CatmullRomCurve3(
		PTS.split(",").map((p) => ((x, z) => new V3(+x, 0, +z))(...p.split(" "))),
		false,
		"centripetal",
	);
	const S = [];
	const P = kit(S);
	{
		const NS = 260;
		const pts = curve.getSpacedPoints(NS);
		const tan = pts.map((_, i) => curve.getTangentAt(i / NS));
		const at = (i, o) => [pts[i].x - tan[i].z * o, 0.03, pts[i].z + tan[i].x * o];
		const pos = [];
		for (let i = 0; i < NS; i++)
			pos.push(
				...at(i, 1.45),
				...at(i + 1, 1.45),
				...at(i, -1.45),
				...at(i, -1.45),
				...at(i + 1, 1.45),
				...at(i + 1, -1.45),
			);
		const up = pos.map((_, i) => +(i % 3 === 1));
		S.push([
			new THREE.BufferAttribute(new Float32Array(pos), 3),
			new THREE.BufferAttribute(new Float32Array(up), 3),
			inks("w"),
		]);
		for (let i = 3; i < NS; i += 6) {
			const t = tan[i];
			P("x", i > 3 ? "y o l =" : "y o l", pts[i].x, 0.06, pts[i].z, 0.2, 0.03, 0.95, 0, Math.atan2(t.x, t.z));
		}
		for (let i = 206; i < 230; i++)
			for (const o of [-1.85, 1.85]) {
				const [x, , z] = at(i, o);
				const [x2, , z2] = at(i + 1, o);
				P(
					"x",
					i > 206 || o > 0 ? "w=" : "w",
					(x + x2) / 2,
					0.5,
					(z + z2) / 2,
					0.07,
					0.2,
					Math.hypot(x2 - x, z2 - z) + 0.02,
					0,
					Math.atan2(x2 - x, z2 - z),
				);
				if (i % 2 === 0) P("x", "k", x, 0.3, z, 0.1, 0.55, 0.1);
			}
	}

	const marks = [];
	const frames = [];
	const pick = [];
	STOPS.forEach(([u, build], k) => {
		const R = curve.getPointAt(u);
		const t = curve.getTangentAt(u);
		const nrm = new V3(t.z, 0, -t.x);
		const L = R.clone().addScaledVector(nrm, k ? 5.6 : 2.6);
		const th = Math.atan2(-nrm.x, -nrm.z) + (k % 2 ? -0.22 : 0.22) * (k ? 1 : 0);
		const pivot = new THREE.Group();
		pivot.position.copy(L);
		pivot.rotation.y = th;
		scene.add(pivot);
		const B = [];
		const { h, T, fx } = build(kit(B));
		const mesh = moving(geo(B), pivot);
		mesh.userData.k = k;
		pick.push(mesh);
		fx(0, mesh.pose);
		marks.push({ pivot, pose: mesh.pose, fx, T, t: 0, ax: [0, 0], az: [0, 0], sq: [0, 0] });
		frames.push({ u, R, L, h, t: new V3(), th, ph: 0.58, d0: 20 + h * 0.9 });
	});
	{
		const u = STOPS[0][0];
		const R = curve.getPointAt(u);
		const t = curve.getTangentAt(u);
		const Q = P.at(R.x, 0, R.z, Math.atan2(t.x, t.z));
		for (let i = 0; i < 12; i += 2) {
			const r = i < 6 ? 0 : 1;
			Q("b", i ? "k o =" : "k o", -1.25 + ((i + r) % 6) * 0.5, 0.05, r ? 0.25 : -0.25, 0.5, 0.02, 0.5);
		}
	}

	{
		const road = curve.getSpacedPoints(90);
		const free = (x, z, r) =>
			road.every((q) => Math.hypot(q.x - x, q.z - z) > 2.4 + r) &&
			marks.every(({ pivot: m }) => Math.hypot(m.position.x - x, m.position.z - z) > COIN + 2.6 + r) &&
			Math.hypot((x - 2) / 36, (z + 1) / 16) < 0.95;
		const spot = (r, u0, side, fn) => {
			for (let n = 0; n < 60; n++) {
				const u = clamp(u0 ?? rnd(0.02, 0.98), 0, 1);
				const R = curve.getPointAt(u);
				const t = curve.getTangentAt(u);
				const sd = side || (rnd() < 0.5 ? -1 : 1);
				const d = sd * rnd(sd > 0 ? 5 : 3.5, 11);
				const [x, z] = [R.x - t.z * d, R.z + t.x * d];
				if (sd > 0 && frames.some((f) => Math.abs(f.u - u) < 0.07)) continue;
				if (free(x, z, r)) return fn(x, z);
			}
		};
		for (let i = 0; i < (light ? 9 : 15); i++)
			spot(1, null, 0, (x, z) =>
				P("c", rnd() < 0.6 ? "y5 o" : "s6 o", x, 0.012, z, rnd(3, 6.5), 0.02, rnd(2, 3.6), 0, rnd(0, PI)),
			);
		for (let i = 0; i < (light ? 14 : 26); i++)
			spot(1.2, null, -1, (x, z) => tree(P.at(x, 0, z, rnd(0, 6)), rnd(), rnd(0.75, 1.15)));
		for (let i = 0; i < (light ? 5 : 9); i++)
			spot(1, null, 1, (x, z) => tree(P.at(x, 0, z, rnd(0, 6)), rnd(0.8, 1), rnd(0.7, 1)));
		for (const f of frames.slice(1))
			for (let j = 0; j < (light ? 1 : 2); j++)
				spot(1.2, f.u + rnd(-0.04, 0.04), -1, (x, z) => tree(P.at(x, 0, z, rnd(0, 6)), rnd(0, 0.79), rnd(0.8, 1.1)));
	}
	add(geo(S));

	const car = new THREE.Group();
	const susp = new THREE.Group();
	scene.add(car.add(susp));
	const CB = [];
	const CW = [];
	const CG = [];
	coupe(kit(CB), kit(CW), kit(CG));
	const body = add(geo(CB), susp);
	body.userData.k = -2;
	pick.push(body);
	add(geo(CG), car);
	const axleGeo = geo(CW);
	const axles = [1.18, -1.18].map((z) => {
		const m = add(axleGeo, car);
		m.position.set(0, 0.38, z);
		return m;
	});
	const PB = [];
	kit(PB)("q", "w o");
	const puffGeo = geo(PB);
	const puffs = [0, 1, 2, 3].map(() => {
		const m = moving(puffGeo, scene);
		m.visible = false;
		return { m, t: 9 };
	});
	const LEN = curve.getLength();
	const exhaust = new V3(0.4, 0.3, -2.1);

	const rt = new THREE.WebGLRenderTarget(1, 1, {
		count: 2,
		minFilter: THREE.NearestFilter,
		magFilter: THREE.NearestFilter,
		depthTexture: new THREE.DepthTexture(1, 1),
	});
	const cs = getComputedStyle(canvas);
	const ink = (v) => new V3(...rgb(cs.getPropertyValue(v)));
	const post = new THREE.Mesh(
		new THREE.BufferGeometry().setAttribute(
			"position",
			new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
		),
		new THREE.RawShaderMaterial({
			glslVersion: THREE.GLSL3,
			vertexShader: PV,
			fragmentShader: PF,
			depthTest: false,
			depthWrite: false,
			uniforms: {
				tC: { value: rt.textures[0] },
				tN: { value: rt.textures[1] },
				tD: { value: rt.depthTexture },
				uRes: { value: new THREE.Vector2(1, 1) },
				uNF: { value: new THREE.Vector2(camera.near, camera.far) },
				uDpr: { value: dpr },
				uMis: { value: 0 },
				uPrint: { value: new V3() },
				uVeil: { value: new THREE.Vector2(0, 0) },
				uY: { value: ink("--yellow") },
				uP: { value: ink("--pink") },
				uK: { value: ink("--ink") },
			},
		}),
	);
	post.frustumCulled = false;
	const printScene = new THREE.Scene().add(post);
	const U = post.material.uniforms;

	let W = 1;
	let H = 1;
	let last = null;
	function layout(o) {
		last = o;
		const { w, h, x = 0, y = 0, veil = -1, fy = 1 } = o;
		U.uVeil.value.x = veil;
		W = Math.max(1, Math.round(w));
		H = Math.max(1, Math.round(h));
		renderer.setSize(W, H, false);
		const pr = renderer.getPixelRatio();
		rt.setSize(Math.round(W * pr), Math.round(H * pr));
		U.uRes.value.set(Math.round(W * pr), Math.round(H * pr));
		U.uDpr.value = pr;
		camera.aspect = W / H;
		camera.setViewOffset(W, H, -x * W, -y * H, W, H);
		const tf = Math.tan((camera.fov * PI) / 360);
		const free = Math.max(0.45, 1 - 2 * Math.abs(x));
		const zf = x ? clamp(0.9 / (camera.aspect * free), 0.88, 1.1) : clamp(0.62 + camera.aspect * 0.2, 0.7, 0.78);
		for (const f of frames.slice(1)) {
			f.t
				.copy(f.R)
				.lerp(f.L, x ? 0.55 : 0.36)
				.setY(f.h * (x ? 0.42 : 0.44));
			f.d = f.d0 * (x ? zf * Math.max(1, 0.74 / fy) : zf * 1.2);
		}
		frames[0].d = Math.max((x ? 21 : 19) / (tf * camera.aspect * free), 12 / tf);
		frames[0].t.set(-2, 1, -1);
		frames[0].th = -0.72;
		frames[0].ph = 0.52;
	}

	const tgt = new V3();
	const lead = new V3();
	const ptrS = [0, 0];
	const ray = new THREE.Raycaster();
	let mis = 0;
	let born = -1;
	let slow = 0,
		fast = 0;
	let runs = 0;
	let here = -1;
	const ahead = new V3();
	const drive = {
		u: -1,
		yaw: 0,
		v: 0,
		a: 0,
		pitch: [0, 0],
		roll: [0, 0],
		cam: [0, 0],
		puff: 0,
		seen: -1e9,
	};
	const stats = { speed: 0 };
	const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
	const seg = (s) => {
		const i = Math.min(frames.length - 2, Math.floor(s));
		return [frames[i], frames[i + 1], clamp(s - i, 0, 1)];
	};
	const spring = (s, k, c, dt, goal = 0) => {
		s[1] += ((goal - s[0]) * k - s[1] * c) * dt;
		s[0] += s[1] * dt;
		return Math.abs(s[1]) > 1e-3 || Math.abs(goal - s[0]) > 1e-3;
	};
	const hop = [0, 0];
	function poke(k, f = 1) {
		const m = marks[k];
		if (k < 0) hop[1] += 5;
		if (!m) return;
		const s = rnd() < 0.5 ? -1 : 1;
		m.az[1] += s * 2.4 * f;
		m.ax[1] -= 1.2 * f;
		m.sq[1] += 1.6 * f;
	}
	let veiled = 0;
	function draw(s, vel, ptr, dt, now, card, fdt = dt) {
		const fresh = now - drive.seen > 400;
		drive.seen = now;
		let [A, B, e] = seg(s);
		const u = clamp(mix(A.u, B.u, e) - 0.02 * (1 - Math.sin(PI * e)), 0, 1);
		curve.getPointAt(u, _p);
		if (u < 0.985) curve.getPointAt(u + 0.012, ahead);
		else ahead.copy(_p).add(curve.getTangentAt(u, _s));
		const yawT = Math.atan2(ahead.x - _p.x, ahead.z - _p.z);
		if (fresh) Object.assign(drive, { u, yaw: yawT, v: 0, a: 0, cam: [s, 0] });
		const ds = (u - drive.u) * LEN;
		drive.u = u;
		const v = dt > 0 ? ds / dt : 0;
		const k8 = 1 - Math.exp(-dt * 8);
		drive.a += ((dt > 0 ? (v - drive.v) / dt : 0) - drive.a) * k8;
		drive.v += (v - drive.v) * k8;
		stats.speed = Math.abs(drive.v);
		const dy = wrap(yawT - drive.yaw) * (1 - Math.exp(-dt * 6));
		drive.yaw += dy;
		car.position.copy(_p);
		car.rotation.y = drive.yaw;
		let moving = spring(drive.pitch, 140, 13, dt, clamp(-drive.a * 0.005, -0.07, 0.07));
		moving =
			spring(drive.roll, 140, 13, dt, clamp((-dy / Math.max(dt, 1e-3)) * stats.speed * 0.012, -0.1, 0.1)) || moving;
		moving = spring(hop, 90, 7, dt) || moving;
		susp.rotation.set(drive.pitch[0] - hop[0] * 0.12, 0, drive.roll[0]);
		susp.position.y = Math.abs(hop[0]) * 0.5;
		for (const x of axles) x.rotation.x += ds / 0.38;
		drive.puff -= dt;
		if (drive.a > 2 && drive.v > 0.5 && drive.puff <= 0) {
			const p = puffs.find((q) => q.t >= 1);
			drive.puff = 0.13;
			if (p) {
				exhaust.x *= -1;
				car.localToWorld(p.m.position.copy(exhaust));
				p.t = 0;
			}
		}
		for (const p of puffs) {
			p.m.visible = p.t < 1;
			if (!p.m.visible) continue;
			p.t += dt * 1.2;
			p.m.position.y += dt * 0.7;
			p.m.scale.setScalar(0.25 + p.t * 0.8);
			p.m.material.uniforms.uA.value[0] = 1 - p.t;
			moving = true;
		}
		const c = drive.cam;
		c[1] += (17.6 * (s - c[0]) - 8.4 * c[1]) * dt;
		c[0] += c[1] * dt;
		moving ||= Math.abs(s - c[0]) > 1e-4;
		[A, B, e] = seg(c[0]);
		lead.copy(_p).setY(1.2);
		tgt.lerpVectors(A.t, B.t, e).lerp(lead, 0.38 * Math.sin(PI * e));
		for (const j of [0, 1]) ptrS[j] += (ptr[j] - ptrS[j]) * (1 - Math.exp(-dt * 4));
		const th = mix(A.th, B.th, e) + ptrS[0] * 0.07;
		const ph = mix(A.ph, B.ph, e) + ptrS[1] * 0.04;
		const d = Math.exp(mix(Math.log(A.d), Math.log(B.d), e)) * (1 + 0.1 * Math.sin(PI * e));
		camera.position.set(
			tgt.x + d * Math.cos(ph) * Math.sin(th),
			tgt.y + d * Math.sin(ph),
			tgt.z + d * Math.cos(ph) * Math.cos(th),
		);
		camera.lookAt(tgt);
		mis += (clamp(Math.abs(vel) * 0.8, 0, 1) - mis) * (1 - Math.exp(-dt * 6));
		if (born < 0) born = now;
		const pt = (now - born) / 1000;
		const ease = (t) => 1 - (1 - clamp(t, 0, 1)) ** 3;
		U.uPrint.value.set(ease(pt / 0.55), ease((pt - 0.28) / 0.6), ease((pt - 0.6) / 0.65));
		const intro = pt < 1.9;
		const vt = card && U.uVeil.value.x > 0 ? 1 : 0;
		veiled += (vt - veiled) * (1 - Math.exp(-dt * 7));
		if (Math.abs(vt - veiled) < 0.005) veiled = vt;
		U.uVeil.value.y = veiled;
		U.uMis.value = Math.max(mis, intro ? 1.4 * (1 - ease((pt - 0.4) / 1.4)) : 0);
		// resolution follows real frame times (fdt = rAF interval): down when slow, back up when fast
		if (fdt > 0 && ++runs > 30) {
			slow = slow * 0.95 + (fdt > 0.024 ? 0.05 : 0);
			fast = fdt < 0.018 ? fast + 1 : 0;
			const pr = renderer.getPixelRatio();
			const to = slow > 0.6 && pr > 1 ? Math.max(1, pr - 0.25) : fast > 300 && pr < dpr ? Math.min(dpr, pr + 0.25) : pr;
			if (to !== pr) {
				renderer.setPixelRatio(to);
				layout(last);
				slow = fast = 0;
			}
		}
		const k = Math.round(s);
		if (Math.abs(s - k) < 0.04 && k !== here) {
			here = k;
			poke(k, 0.5);
		} else if (Math.abs(s - k) > 0.3) here = -1;
		let busy =
			Math.abs(ptr[0] - ptrS[0]) + Math.abs(ptr[1] - ptrS[1]) > 0.002 || mis > 0.01 || moving || veiled !== vt || intro;
		// only the nearest stop animates; others finish a cycle and hold
		marks.forEach((m, j) => {
			let a = spring(m.ax, 70, 6, dt);
			a = spring(m.az, 70, 6, dt) || a;
			a = spring(m.sq, 120, 9, dt) || a;
			m.pivot.rotation.x = m.ax[0] * 0.14;
			m.pivot.rotation.z = m.az[0] * 0.12;
			m.pivot.scale.set(1 - m.sq[0] * 0.04, 1 + m.sq[0] * 0.08, 1 - m.sq[0] * 0.04);
			const end = Math.ceil(m.t / m.T - 1e-6) * m.T;
			const t = j === k ? m.t + dt : Math.min(end, m.t + dt);
			if (t !== m.t) {
				m.fx((m.t = t), m.pose);
				a = true;
			}
			busy ||= a;
		});
		renderer.setRenderTarget(rt);
		renderer.render(scene, camera);
		renderer.setRenderTarget(null);
		renderer.render(printScene, camera);
		return busy;
	}
	function hover(x, y) {
		const r = canvas.getBoundingClientRect();
		ray.setFromCamera(
			{
				x: ((x - r.left) / r.width) * 2 - 1,
				y: -((y - r.top) / r.height) * 2 + 1,
			},
			camera,
		);
		const hit = ray.intersectObjects(pick, false)[0];
		return hit ? hit.object.userData.k : -1;
	}
	if (renderer.extensions.has("KHR_parallel_shader_compile"))
		await Promise.all([renderer.compileAsync(scene, camera), renderer.compileAsync(printScene, camera)]);
	else (renderer.compile(scene, camera), renderer.compile(printScene, camera));
	return {
		layout,
		draw,
		hover,
		poke,
		get speed() {
			return stats.speed;
		},
	};
}
