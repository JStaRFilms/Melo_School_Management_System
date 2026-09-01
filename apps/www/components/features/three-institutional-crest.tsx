"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function ThreeInstitutionalCrest() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let renderer: THREE.WebGLRenderer | null = null;
    let animId: number | null = null;

    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      renderer = null;
    }

    if (!renderer) {
      // Graceful Canvas 2D Fallback
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      ctx.scale(dpr, dpr);

      const w = container.clientWidth;
      const h = container.clientHeight;
      ctx.strokeStyle = "#D97706";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 70, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#1C1917";
      ctx.font = 'bold 36px "Instrument Serif", Georgia, serif';
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("M", w / 2, h / 2);
      return;
    }

    // 1. Scene & Camera
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 6.2);

    const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(dpr);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    // 2. Studio Lighting
    const keyLight = new THREE.DirectionalLight(0xfff3d6, 2.8);
    keyLight.position.set(5, 6, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x93c5fd, 1.2);
    fillLight.position.set(-5, -2, -3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xf59e0b, 2.0);
    rimLight.position.set(0, 5, -5);
    scene.add(rimLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    // 3. Detailed Institutional Golden Medal & Crest
    const crestMaster = new THREE.Group();

    const goldMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#D97706"),
      metalness: 0.9,
      roughness: 0.18,
    });

    const darkGoldMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#92400E"),
      metalness: 0.85,
      roughness: 0.35,
    });

    const platinumMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#E2E8F0"),
      metalness: 0.95,
      roughness: 0.12,
    });

    // 1) Main Medal Coin Disc
    const medalGeo = new THREE.CylinderGeometry(1.6, 1.6, 0.18, 64);
    const medalMesh = new THREE.Mesh(medalGeo, goldMat);
    medalMesh.rotation.x = Math.PI / 2;
    crestMaster.add(medalMesh);

    // 2) Beveled Outer Coin Rim
    const outerRimGeo = new THREE.TorusGeometry(1.65, 0.08, 24, 64);
    const outerRimMesh = new THREE.Mesh(outerRimGeo, goldMat);
    crestMaster.add(outerRimMesh);

    // 3) Inner Recessed Medallion Disc
    const innerDiscGeo = new THREE.CylinderGeometry(1.35, 1.35, 0.22, 64);
    const innerDiscMesh = new THREE.Mesh(innerDiscGeo, darkGoldMat);
    innerDiscMesh.rotation.x = Math.PI / 2;
    crestMaster.add(innerDiscMesh);

    // 4) Concentric Platinum Guilloché Ring
    const guillocheGeo = new THREE.TorusGeometry(1.15, 0.04, 16, 64);
    const guillocheMesh = new THREE.Mesh(guillocheGeo, platinumMat);
    crestMaster.add(guillocheMesh);

    // 5) Embossed Central Shield
    const shieldShape = new THREE.Shape();
    shieldShape.moveTo(0, 0.65);
    shieldShape.lineTo(0.5, 0.35);
    shieldShape.lineTo(0.4, -0.4);
    shieldShape.lineTo(0, -0.7);
    shieldShape.lineTo(-0.4, -0.4);
    shieldShape.lineTo(-0.5, 0.35);
    shieldShape.closePath();

    const extrudeSettings = {
      depth: 0.15,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.04,
    };

    const shieldGeo = new THREE.ExtrudeGeometry(shieldShape, extrudeSettings);
    shieldGeo.center();
    const shieldMesh = new THREE.Mesh(shieldGeo, goldMat);
    shieldMesh.position.z = 0.12;
    crestMaster.add(shieldMesh);

    // 6) Outer Ribbed Teeth
    const teethCount = 32;
    for (let i = 0; i < teethCount; i++) {
      const angle = (i / teethCount) * Math.PI * 2;
      const toothGeo = new THREE.BoxGeometry(0.06, 0.12, 0.18);
      const toothMesh = new THREE.Mesh(toothGeo, goldMat);
      toothMesh.position.x = Math.cos(angle) * 1.68;
      toothMesh.position.y = Math.sin(angle) * 1.68;
      toothMesh.rotation.z = angle;
      crestMaster.add(toothMesh);
    }

    // 7) Floating Outer Gyro Ring
    const gyroRingGeo = new THREE.TorusGeometry(2.1, 0.03, 16, 80);
    const gyroRing = new THREE.Mesh(gyroRingGeo, platinumMat);
    crestMaster.add(gyroRing);

    scene.add(crestMaster);

    // 4. ScrollTrigger Sync
    const yAxis = new THREE.Vector3(0, 1, 0);
    const xAxis = new THREE.Vector3(1, 0, 0);
    let lastRot = 0;

    const st = ScrollTrigger.create({
      trigger: container,
      start: "top bottom",
      end: "bottom top",
      scrub: 1,
      onUpdate: (self) => {
        const target = self.progress * Math.PI * 2 * 1.5;
        const delta = target - lastRot;
        crestMaster.rotateOnAxis(yAxis, delta);
        crestMaster.rotateOnAxis(xAxis, delta * 0.15);
        lastRot = target;
      },
    });

    // 5. Pointer Parallax
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 0.8;
      targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 0.8;
    };

    window.addEventListener("mousemove", handleMouseMove);

    // 6. RAF Loop
    const render = () => {
      if (!renderer) return;
      mouseX += (targetX - mouseX) * 0.05;
      mouseY += (targetY - mouseY) * 0.05;

      crestMaster.rotation.y += 0.004;
      crestMaster.rotation.x = mouseY * 0.6;
      crestMaster.rotation.z = -mouseX * 0.4;
      gyroRing.rotation.z += 0.008;

      renderer.render(scene, camera);
      animId = requestAnimationFrame(render);
    };

    render();

    const handleResize = () => {
      if (!container || !renderer) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2.0));
    };

    window.addEventListener("resize", handleResize);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      st.kill();
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);

      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[320px] sm:h-[380px] flex items-center justify-center pointer-events-none select-none my-2"
    >
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
