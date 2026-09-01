"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec2 uMouse;
  uniform float uSpeed;
  uniform vec2 uResolution;
  varying vec2 vUv;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 uv) {
    float val = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for(int i = 0; i < 4; i++) {
      val += amp * snoise(uv * freq);
      uv *= 2.0;
      amp *= 0.5;
    }
    return val;
  }

  void main() {
    vec2 uv = vUv;
    vec2 center = vec2(0.5);
    float distToCenter = length(uv - center);
    
    float sealMask = smoothstep(0.48, 0.46, distToCenter);
    if (sealMask <= 0.001) {
      discard;
    }

    float distToMouse = distance(uv, uMouse);
    float mouseForce = smoothstep(0.4, 0.0, distToMouse);

    float n = fbm(uv * 3.0 + uTime * 0.15);
    float angle = atan(uv.y - 0.5, uv.x - 0.5);
    float rainbow = sin(angle * 3.0 + distToCenter * 15.0 - uTime * 0.8 + n * 2.0);

    vec3 goldBase = vec3(0.85, 0.55, 0.1);
    vec3 emeraldBase = vec3(0.02, 0.6, 0.35);
    vec3 iridescence = 0.5 + 0.5 * cos(uTime * 0.5 + uv.xyx + vec3(0.0, 2.0, 4.0) + rainbow * 0.5);

    vec3 finalColor = mix(goldBase, emeraldBase, sin(angle * 2.0 + uTime) * 0.5 + 0.5);
    finalColor = mix(finalColor, iridescence, 0.35 + mouseForce * 0.25);

    float edgeGlow = smoothstep(0.44, 0.47, distToCenter);
    finalColor += vec3(edgeGlow * 0.3);

    gl_FragColor = vec4(finalColor, sealMask * 0.85);
  }
`;

export function HolographicSecuritySeal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let animId: number | null = null;
    let clock = new THREE.Clock();

    // Check if WebGL context can be created safely
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      // If WebGL context is not available, render Canvas 2D fallback
      renderer = null;
    }

    if (!renderer) {
      // Canvas 2D Fallback
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      ctx.scale(dpr, dpr);

      let t = 0;
      const render2d = () => {
        t += 0.02;
        const w = container.clientWidth;
        const h = container.clientHeight;
        ctx.clearRect(0, 0, w, h);

        const grad = ctx.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w / 2);
        grad.addColorStop(0, `hsl(${(t * 40) % 360}, 75%, 65%)`);
        grad.addColorStop(0.5, "#D97706");
        grad.addColorStop(1, "#059669");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(w / 2, h / 2, w / 2 - 4, 0, Math.PI * 2);
        ctx.fill();

        animId = requestAnimationFrame(render2d);
      };
      render2d();

      return () => {
        if (animId) cancelAnimationFrame(animId);
      };
    }

    // WebGL Execution
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(dpr);

    const uniforms = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uSpeed: { value: 0 },
      uResolution: { value: new THREE.Vector2(container.clientWidth, container.clientHeight) },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms,
      transparent: true,
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    let prevMouse = { x: 0.5, y: 0.5 };
    let currentMouse = { x: 0.5, y: 0.5 };
    let speed = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height;

      const dx = x - prevMouse.x;
      const dy = y - prevMouse.y;
      speed = Math.hypot(dx, dy) * 40.0;
      prevMouse = { x, y };
      currentMouse = { x, y };
    };

    container.addEventListener("mousemove", handleMouseMove);

    const render = () => {
      if (!renderer) return;
      const elapsedTime = clock.getElapsedTime();
      speed *= 0.92;

      uniforms.uTime.value = elapsedTime;
      uniforms.uMouse.value.set(currentMouse.x, currentMouse.y);
      uniforms.uSpeed.value = speed;

      renderer.render(scene, camera);
      animId = requestAnimationFrame(render);
    };

    render();

    const handleResize = () => {
      if (!container || !renderer) return;
      renderer.setSize(container.clientWidth, container.clientHeight);
      uniforms.uResolution.value.set(container.clientWidth, container.clientHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      container.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      geometry.dispose();
      material.dispose();
      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden shadow-xl border-2 border-amber-300/60 bg-amber-50/20 cursor-pointer flex items-center justify-center select-none"
    >
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
        <span className="text-[9px] font-mono uppercase tracking-widest text-stone-900 font-extrabold bg-white/70 px-2 py-0.5 rounded backdrop-blur-sm border border-stone-300">
          SEAL OF TRUST
        </span>
        <span className="text-[8px] font-mono text-stone-800 mt-0.5 font-bold">
          WAEC CERTIFIED
        </span>
      </div>
    </div>
  );
}
