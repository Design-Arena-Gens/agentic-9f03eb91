"use client";

import React, { useEffect, useRef, useState } from "react";
import { createAudioEngine } from "../lib/audio";

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

export function CctvScene() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [running, setRunning] = useState(true);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const audioRef = useRef<ReturnType<typeof createAudioEngine> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
    if (!ctx) return;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let raf = 0;
    let last = performance.now();
    let filmGrainSeed = Math.random() * 1e6;

    function hash(x: number) {
      return Math.sin(x * 127.1) * 43758.5453 % 1;
    }

    function noise(nx: number, ny: number) {
      const i = Math.floor(nx), j = Math.floor(ny);
      const fx = nx - i, fy = ny - j;
      const a = hash(i * 12.9898 + j * 78.233 + filmGrainSeed);
      const b = hash((i + 1) * 12.9898 + j * 78.233 + filmGrainSeed);
      const c = hash(i * 12.9898 + (j + 1) * 78.233 + filmGrainSeed);
      const d = hash((i + 1) * 12.9898 + (j + 1) * 78.233 + filmGrainSeed);
      const u = fx * fx * (3 - 2 * fx);
      const v = fy * fy * (3 - 2 * fy);
      return lerp(lerp(a, b, u), lerp(c, d, u), v);
    }

    function drawScene(t: number) {
      const w = canvas.width, h = canvas.height;
      // base background
      ctx.fillStyle = "#0b0e0b";
      ctx.fillRect(0, 0, w, h);

      // perspective road (low angle)
      const horizonY = Math.floor(h * 0.35);
      const vpX = Math.floor(w * 0.5 + Math.sin(t * 0.0002) * w * 0.02);
      ctx.fillStyle = "#1a1a1a";
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(w, h);
      ctx.lineTo(Math.floor(w * 0.65), horizonY);
      ctx.lineTo(Math.floor(w * 0.35), horizonY);
      ctx.closePath();
      ctx.fill();

      // center lane markers
      ctx.strokeStyle = "#4c4c4c";
      ctx.lineWidth = Math.max(1, w * 0.002);
      ctx.setLineDash([w * 0.015, w * 0.02]);
      ctx.beginPath();
      ctx.moveTo(vpX, horizonY);
      ctx.lineTo(vpX, h);
      ctx.stroke();
      ctx.setLineDash([]);

      // harsh overhead streetlights pools
      const pools = [
        { x: w * 0.28, y: h * 0.52 },
        { x: w * 0.72, y: h * 0.58 },
        { x: w * 0.50, y: h * 0.68 }
      ];
      pools.forEach((p, i) => {
        const r = w * (0.08 + i * 0.015);
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        g.addColorStop(0, "rgba(200, 200, 180, 0.45)");
        g.addColorStop(0.6, "rgba(150, 150, 130, 0.18)");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      });

      // animal silhouettes positions (standoff)
      const tigerPos = { x: w * 0.42, y: h * 0.68 };
      const dogPos = { x: w * 0.58, y: h * 0.70 };

      // shadows (long, strong)
      function drawShadow(x: number, y: number, dirX: number) {
        ctx.fillStyle = "rgba(0,0,0,0.9)";
        const len = h * 0.18;
        ctx.beginPath();
        ctx.moveTo(x - 14, y);
        ctx.lineTo(x + 14, y);
        ctx.lineTo(x + 14 + dirX * len, y + len);
        ctx.lineTo(x - 14 + dirX * len, y + len);
        ctx.closePath();
        ctx.fill();
      }
      drawShadow(tigerPos.x, tigerPos.y, -0.25);
      drawShadow(dogPos.x, dogPos.y, 0.25);

      // tiger silhouette
      function drawTiger(x: number, y: number, scale: number) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.fillStyle = "#0f0f0f";
        ctx.strokeStyle = "#141414";
        ctx.lineWidth = 2;
        ctx.beginPath();
        // body
        ctx.ellipse(0, -24, 36, 18, 0, 0, Math.PI * 2);
        ctx.fill();
        // head
        ctx.beginPath();
        ctx.arc(36, -28, 12, 0, Math.PI * 2);
        ctx.fill();
        // ears
        ctx.beginPath();
        ctx.moveTo(43, -38); ctx.lineTo(46, -32); ctx.lineTo(40, -32); ctx.closePath();
        ctx.moveTo(31, -40); ctx.lineTo(28, -33); ctx.lineTo(34, -33); ctx.closePath();
        ctx.fill();
        // legs
        for (let i = -1; i <= 1; i += 2) {
          ctx.beginPath();
          ctx.roundRect(-18 + i * 12, -8, 10, 32, 3);
          ctx.fill();
        }
        // tail
        ctx.beginPath();
        ctx.moveTo(-36, -26);
        ctx.quadraticCurveTo(-56, -40, -64, -30);
        ctx.quadraticCurveTo(-48, -22, -40, -18);
        ctx.stroke();
        ctx.restore();
      }

      // dog silhouette
      function drawDog(x: number, y: number, scale: number) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(scale, scale);
        ctx.fillStyle = "#0f0f0f";
        ctx.beginPath();
        // body
        ctx.ellipse(0, -18, 28, 14, 0, 0, Math.PI * 2);
        ctx.fill();
        // head with snout
        ctx.beginPath();
        ctx.ellipse(26, -24, 10, 9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(34, -24); ctx.lineTo(42, -22); ctx.lineTo(34, -18); ctx.closePath();
        ctx.fill();
        // ears
        ctx.beginPath();
        ctx.moveTo(20, -34); ctx.lineTo(24, -26); ctx.lineTo(16, -26); ctx.closePath();
        ctx.moveTo(30, -36); ctx.lineTo(34, -28); ctx.lineTo(26, -28); ctx.closePath();
        ctx.fill();
        // legs
        for (let i = -1; i <= 1; i += 2) {
          ctx.beginPath();
          ctx.roundRect(-10 + i * 10, -6, 8, 26, 3);
          ctx.fill();
        }
        // tail
        ctx.beginPath();
        ctx.moveTo(-26, -20);
        ctx.quadraticCurveTo(-36, -30, -30, -14);
        ctx.strokeStyle = "#141414";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }

      // subtle idle motion to add tension
      const breathe = Math.sin(t * 0.003) * 0.5;
      drawTiger(tigerPos.x, tigerPos.y + breathe, dpr);
      drawDog(dogPos.x, dogPos.y - breathe, dpr * 0.95);

      // vignette and desaturation grade via overlay
      const grd = ctx.createRadialGradient(w * 0.5, h * 0.6, Math.min(w, h) * 0.1, w * 0.5, h * 0.6, Math.max(w, h) * 0.7);
      grd.addColorStop(0, "rgba(60, 70, 60, 0)");
      grd.addColorStop(1, "rgba(0, 0, 0, 0.55)");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, w, h);

      // scanlines and chroma shift
      const lineH = 2 * dpr;
      for (let y = 0; y < h; y += lineH * 2) {
        ctx.fillStyle = "rgba(0,0,0,0.08)";
        ctx.fillRect(0, y, w, lineH);
      }
      // digital noise
      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;
      const nIntensity = 18; // noise strength
      for (let i = 0; i < data.length; i += 4) {
        const nx = ((i / 4) % w) * 0.6;
        const ny = Math.floor(i / 4 / w) * 0.6;
        const n = (noise(nx, ny) - 0.5) * nIntensity;
        // desaturate and tint green
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const gray = r * 0.3 + g * 0.59 + b * 0.11;
        data[i] = Math.min(255, gray * 0.9 + n * 0.6);
        data[i + 1] = Math.min(255, gray + 6 + n);
        data[i + 2] = Math.min(255, gray * 0.9 + n * 0.4);
        data[i + 3] = 255;
      }
      ctx.putImageData(imgData, 0, 0);

      // occasional glitch bars
      if (Math.random() < 0.02) {
        const gy = Math.floor(Math.random() * h);
        const gh = Math.floor(h * (0.01 + Math.random() * 0.03));
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = "rgba(80,100,80,0.25)";
        ctx.fillRect(0, gy, w, gh);
        ctx.globalCompositeOperation = "source-over";
      }

      // HUD overlay
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 0, w, 28 * dpr);
      ctx.fillRect(0, h - 24 * dpr, w, 24 * dpr);
      ctx.fillStyle = "#8daa8d";
      ctx.font = `${12 * dpr}px Courier New`;
      ctx.textBaseline = "middle";
      ctx.fillText("CAM 03", 10 * dpr, 14 * dpr);
      const recBlink = Math.floor(t / 400) % 2 === 0;
      ctx.fillStyle = recBlink ? "#e04444" : "#502222";
      ctx.beginPath();
      ctx.arc(w - 70 * dpr, 14 * dpr, 5 * dpr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#8daa8d";
      ctx.fillText("REC", w - 50 * dpr, 14 * dpr);
      const now = new Date();
      const stamp = now.toISOString().replace("T", " ").slice(0, 19);
      ctx.textAlign = "center";
      ctx.fillText(stamp, w * 0.5, h - 12 * dpr);
      ctx.textAlign = "left";

      // cut to black after 10 seconds from start
      if (startedAt) {
        const elapsed = t - startedAt;
        if (elapsed >= 10_000) {
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, w, h);
        }
      }
    }

    function loop(now: number) {
      const dt = now - last;
      last = now;
      filmGrainSeed += dt * 0.0002;
      drawScene(now);
      if (running) raf = requestAnimationFrame(loop);
    }

    setStartedAt(performance.now());
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [running]);

  useEffect(() => {
    const engine = createAudioEngine();
    audioRef.current = engine;
    setAudioReady(true);
    return () => {
      engine.dispose();
    };
  }, []);

  function handleEnableAudio() {
    audioRef.current?.start();
    setAudioEnabled(true);
    setAudioReady(false);
  }

  useEffect(() => {
    if (!startedAt) return;
    const id = window.setTimeout(() => {
      setRunning(false);
      audioRef.current?.stop();
    }, 10_000);
    return () => window.clearTimeout(id);
  }, [startedAt]);

  return (
    <>
      <canvas ref={canvasRef} />
      {running && (
        <div className="hud">
          <div className="hudInner">
            <div>CH: 03 | CCTV</div>
            <div className="rec">● REC</div>
          </div>
          <div className="bottomBar">WIDE FOV | 24FPS</div>
        </div>
      )}
      {audioReady && !audioEnabled && (
        <div className="overlay" aria-hidden>
          <button className="btn" onClick={handleEnableAudio}>Enable Audio</button>
        </div>
      )}
    </>
  );
}
