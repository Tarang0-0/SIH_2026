'use client';

import React, { useEffect, useRef } from 'react';

export default function ThreeDHeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = window.devicePixelRatio || 1;

    let mouseX = 0;
    let mouseY = 0;
    let targetRotX = 0.42;
    let targetRotY = 0;
    let rotX = 0.42;
    let rotY = 0;

    const handleResize = () => {
      if (!canvas) return;
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = (e.clientY / window.innerHeight) * 2 - 1;
      targetRotY = mouseX * 0.22;
      targetRotX = 0.42 + mouseY * 0.12;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    handleResize();

    // 3D Isometric Rail Track Network & Pulses
    interface TrackPoint {
      x: number;
      y: number;
      z: number;
    }

    // Generate 5 continuous 3D rail lines with gentle curves
    const tracks: TrackPoint[][] = [];
    const numTracks = 5;
    const trackLength = 32;
    const spacing = 150;

    for (let t = 0; t < numTracks; t++) {
      const line: TrackPoint[] = [];
      const offsetX = (t - (numTracks - 1) / 2) * spacing;
      for (let i = 0; i < trackLength; i++) {
        const z = (i - trackLength / 2) * 95;
        const curve = Math.sin(i * 0.22 + t * 0.8) * 70;
        const elevation = Math.sin(i * 0.15 + t * 0.4) * 30;
        line.push({
          x: offsetX + curve,
          y: elevation,
          z: z,
        });
      }
      tracks.push(line);
    }

    // High speed pulses traversing the tracks (locomotives)
    const pulses = [
      { trackIndex: 0, progress: 0.15, speed: 0.0032, color: '#0284c7' },
      { trackIndex: 1, progress: 0.65, speed: 0.0040, color: '#0ea5e9' },
      { trackIndex: 2, progress: 0.35, speed: 0.0048, color: '#2563eb' },
      { trackIndex: 3, progress: 0.82, speed: 0.0035, color: '#059669' },
      { trackIndex: 4, progress: 0.45, speed: 0.0042, color: '#6366f1' },
    ];

    // 3D Perspective Projection helper
    const focalLength = 700;
    const project = (p: TrackPoint) => {
      // Rotate around Y axis
      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const x1 = p.x * cosY + p.z * sinY;
      const z1 = -p.x * sinY + p.z * cosY;

      // Rotate around X axis (pitch)
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);
      const y2 = p.y * cosX - z1 * sinX;
      const z2 = p.y * sinX + z1 * cosX;

      // Camera distance offset
      const camZ = z2 + 900;
      if (camZ <= 10) return null;

      const scale = focalLength / camZ;
      return {
        x: width / 2 + x1 * scale,
        y: height / 2 + (y2 + 160) * scale,
        scale,
        depth: camZ,
      };
    };

    const render = () => {
      rotX += (targetRotX - rotX) * 0.05;
      rotY += (targetRotY - rotY) * 0.05;

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const isDark = document.documentElement.classList.contains('dark');

      // Draw subtle 3D floor ties / sleeper rungs across adjacent tracks
      ctx.lineWidth = 1;
      for (let i = 0; i < trackLength; i += 2) {
        for (let t = 0; t < numTracks - 1; t++) {
          const pA = tracks[t][i];
          const pB = tracks[t + 1][i];
          const prjA = project(pA);
          const prjB = project(pB);

          if (prjA && prjB) {
            const alpha = Math.max(0.02, Math.min(isDark ? 0.18 : 0.12, 1 - prjA.depth / 1800));
            ctx.strokeStyle = isDark ? `rgba(56, 189, 248, ${alpha})` : `rgba(148, 163, 184, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(prjA.x, prjA.y);
            ctx.lineTo(prjB.x, prjB.y);
            ctx.stroke();
          }
        }
      }

      // Draw 3D Rail Lines
      tracks.forEach((track, tIdx) => {
        ctx.beginPath();
        let started = false;

        for (let i = 0; i < track.length; i++) {
          const pt = track[i];
          const prj = project(pt);
          if (!prj) continue;

          if (!started) {
            ctx.moveTo(prj.x, prj.y);
            started = true;
          } else {
            ctx.lineTo(prj.x, prj.y);
          }
        }

        const isCenter = tIdx === 2;
        ctx.strokeStyle = isDark
          ? (isCenter ? 'rgba(56, 189, 248, 0.75)' : 'rgba(14, 165, 233, 0.35)')
          : (isCenter ? 'rgba(2, 132, 199, 0.45)' : 'rgba(14, 165, 233, 0.22)');
        ctx.lineWidth = isCenter ? (isDark ? 3 : 2.5) : (isDark ? 1.5 : 1.2);
        ctx.stroke();
      });

      // Draw 3D Pulses (Trains moving along tracks)
      pulses.forEach(pulse => {
        pulse.progress += pulse.speed;
        if (pulse.progress > 1) pulse.progress = 0;

        const track = tracks[pulse.trackIndex];
        const idxFloat = pulse.progress * (track.length - 1);
        const idx = Math.floor(idxFloat);
        const nextIdx = Math.min(idx + 1, track.length - 1);
        const frac = idxFloat - idx;

        const pCurrent = {
          x: track[idx].x + (track[nextIdx].x - track[idx].x) * frac,
          y: track[idx].y + (track[nextIdx].y - track[idx].y) * frac,
          z: track[idx].z + (track[nextIdx].z - track[idx].z) * frac,
        };

        const prj = project(pCurrent);
        if (prj) {
          const radius = Math.max(3, (isDark ? 7.5 : 6) * prj.scale);
          const grad = ctx.createRadialGradient(prj.x, prj.y, 0, prj.x, prj.y, radius * 4.5);
          grad.addColorStop(0, isDark ? '#ffffff' : pulse.color);
          grad.addColorStop(0.25, pulse.color);
          grad.addColorStop(0.65, pulse.color);
          grad.addColorStop(1, 'transparent');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(prj.x, prj.y, radius * 4.5, 0, Math.PI * 2);
          ctx.fill();

          // Bright Core dot
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(prj.x, prj.y, radius * 1.15, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = pulse.color;
          ctx.lineWidth = isDark ? 1.8 : 1.2;
          ctx.stroke();
        }
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-0 opacity-80"
    />
  );
}

