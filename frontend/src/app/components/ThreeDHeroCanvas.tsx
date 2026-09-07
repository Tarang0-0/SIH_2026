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
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    let mouseX = 0;
    let mouseY = 0;
    let targetRotX = 0.45;
    let targetRotY = 0;
    let rotX = 0.45;
    let rotY = 0;

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseY = (e.clientY / window.innerHeight) * 2 - 1;
      targetRotY = mouseX * 0.25;
      targetRotX = 0.45 + mouseY * 0.15;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);

    // 3D Isometric Rail Track Network & Pulses
    interface TrackPoint {
      x: number;
      y: number;
      z: number;
    }

    // Generate 4 continuous 3D rail lines with gentle curves
    const tracks: TrackPoint[][] = [];
    const numTracks = 5;
    const trackLength = 28;
    const spacing = 140;

    for (let t = 0; t < numTracks; t++) {
      const line: TrackPoint[] = [];
      const offsetX = (t - (numTracks - 1) / 2) * spacing;
      for (let i = 0; i < trackLength; i++) {
        const z = (i - trackLength / 2) * 90;
        // subtle curve
        const curve = Math.sin(i * 0.25 + t) * 60;
        const elevation = Math.sin(i * 0.18 + t * 0.5) * 25;
        line.push({
          x: offsetX + curve,
          y: elevation,
          z: z,
        });
      }
      tracks.push(line);
    }

    // High speed pulses traversing the tracks
    const pulses = [
      { trackIndex: 0, progress: 0.1, speed: 0.0035, color: '#00f0ff', length: 3 },
      { trackIndex: 1, progress: 0.6, speed: 0.0042, color: '#38bdf8', length: 4 },
      { trackIndex: 2, progress: 0.3, speed: 0.0050, color: '#10b981', length: 3 },
      { trackIndex: 3, progress: 0.8, speed: 0.0038, color: '#00f0ff', length: 4 },
      { trackIndex: 4, progress: 0.4, speed: 0.0045, color: '#818cf8', length: 3 },
    ];

    // 3D Perspective Projection helper
    const focalLength = 650;
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
      const camZ = z2 + 850;
      if (camZ <= 10) return null;

      const scale = focalLength / camZ;
      return {
        x: width / 2 + x1 * scale,
        y: height / 2 + (y2 + 180) * scale,
        scale,
        depth: camZ,
      };
    };

    const render = () => {
      // Smooth camera rotation damping
      rotX += (targetRotX - rotX) * 0.05;
      rotY += (targetRotY - rotY) * 0.05;

      ctx.clearRect(0, 0, width, height);

      // Draw subtle 3D floor ties / sleeper rungs across adjacent tracks
      ctx.lineWidth = 1;
      for (let i = 0; i < trackLength; i += 2) {
        for (let t = 0; t < numTracks - 1; t++) {
          const pA = tracks[t][i];
          const pB = tracks[t + 1][i];
          const prjA = project(pA);
          const prjB = project(pB);

          if (prjA && prjB) {
            const alpha = Math.max(0.02, Math.min(0.12, 1 - prjA.depth / 1600));
            ctx.strokeStyle = `rgba(148, 163, 184, ${alpha})`;
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

        ctx.strokeStyle = tIdx === 2 ? 'rgba(0, 240, 255, 0.22)' : 'rgba(56, 189, 248, 0.12)';
        ctx.lineWidth = tIdx === 2 ? 2.2 : 1.2;
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
          // Draw glowing head
          const radius = Math.max(2.5, 5 * prj.scale);
          const grad = ctx.createRadialGradient(prj.x, prj.y, 0, prj.x, prj.y, radius * 3.5);
          grad.addColorStop(0, pulse.color);
          grad.addColorStop(0.4, pulse.color);
          grad.addColorStop(1, 'transparent');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(prj.x, prj.y, radius * 3.5, 0, Math.PI * 2);
          ctx.fill();

          // Core dot
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(prj.x, prj.y, radius * 0.9, 0, Math.PI * 2);
          ctx.fill();
        }
      });

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
      className="absolute inset-0 pointer-events-none z-0 opacity-75"
    />
  );
}
