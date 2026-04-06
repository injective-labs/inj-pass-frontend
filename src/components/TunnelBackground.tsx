/**
 * Ambient background animation
 * Replaces the previous tunnel effect with a calmer field of drifting particles
 * and low-contrast brand haze, so the motion supports the page instead of
 * competing with the content.
 */

'use client';

import { useEffect, useRef } from 'react';

type HazeOrb = {
  x: number;
  y: number;
  radius: number;
  color: string;
  alpha: number;
  driftX: number;
  driftY: number;
  phase: number;
  speed: number;
};

class AmbientParticle {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  speedX: number;
  speedY: number;
  twinkle: number;
  twinkleSpeed: number;
  mode: 'dark' | 'light';

  constructor(width: number, height: number, mode: 'dark' | 'light') {
    this.mode = mode;
    this.x = Math.random() * width;
    this.y = Math.random() * height;
    this.radius = Math.random() * 1.8 + 0.6;
    this.alpha = Math.random() * 0.26 + 0.06;
    this.speedX = (Math.random() - 0.5) * 0.12;
    this.speedY = (Math.random() - 0.5) * 0.12;
    this.twinkle = Math.random() * Math.PI * 2;
    this.twinkleSpeed = Math.random() * 0.012 + 0.004;
  }

  update(width: number, height: number) {
    this.x += this.speedX;
    this.y += this.speedY;
    this.twinkle += this.twinkleSpeed;

    if (this.x < -20) this.x = width + 20;
    if (this.x > width + 20) this.x = -20;
    if (this.y < -20) this.y = height + 20;
    if (this.y > height + 20) this.y = -20;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const opacity = this.alpha * (0.72 + Math.sin(this.twinkle) * 0.28);
    const gradient = ctx.createRadialGradient(
      this.x,
      this.y,
      0,
      this.x,
      this.y,
      this.radius * 6
    );

    gradient.addColorStop(
      0,
      this.mode === 'light'
        ? `rgba(114, 82, 184, ${opacity * 0.34})`
        : `rgba(255,255,255,${opacity})`
    );
    gradient.addColorStop(
      0.35,
      this.mode === 'light'
        ? `rgba(233, 103, 161, ${opacity * 0.16})`
        : `rgba(220,198,255,${opacity * 0.38})`
    );
    gradient.addColorStop(1, 'rgba(255,255,255,0)');

    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(this.x, this.y, this.radius * 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

export default function TunnelBackground({
  mode = 'dark',
  className = 'fixed inset-0 z-0',
}: {
  mode?: 'dark' | 'light';
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const isLightMode = mode === 'light';
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animationId = 0;
    let particles: AmbientParticle[] = [];

    const hazeOrbs: HazeOrb[] = isLightMode
      ? [
          {
            x: 0.18,
            y: 0.2,
            radius: 320,
            color: '144, 105, 255',
            alpha: 0.09,
            driftX: 18,
            driftY: -10,
            phase: 0.4,
            speed: 0.00022,
          },
          {
            x: 0.78,
            y: 0.18,
            radius: 260,
            color: '255, 124, 172',
            alpha: 0.08,
            driftX: -16,
            driftY: 12,
            phase: 1.6,
            speed: 0.0002,
          },
          {
            x: 0.56,
            y: 0.86,
            radius: 340,
            color: '119, 106, 255',
            alpha: 0.06,
            driftX: 12,
            driftY: -18,
            phase: 2.2,
            speed: 0.00016,
          },
        ]
      : [
          {
            x: 0.18,
            y: 0.22,
            radius: 320,
            color: '124, 68, 255',
            alpha: 0.12,
            driftX: 18,
            driftY: -10,
            phase: 0.4,
            speed: 0.00022,
          },
          {
            x: 0.78,
            y: 0.2,
            radius: 280,
            color: '255, 92, 156',
            alpha: 0.1,
            driftX: -16,
            driftY: 12,
            phase: 1.6,
            speed: 0.0002,
          },
          {
            x: 0.56,
            y: 0.84,
            radius: 360,
            color: '93, 76, 255',
            alpha: 0.08,
            driftX: 12,
            driftY: -18,
            phase: 2.2,
            speed: 0.00016,
          },
        ];

    const buildParticles = () => {
      const count = Math.max(28, Math.min(60, Math.floor((width * height) / 28000)));
      particles = Array.from(
        { length: count },
        () => new AmbientParticle(width, height, mode)
      );
    };

    const resizeCanvas = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildParticles();
    };

    const drawHaze = (time: number) => {
      hazeOrbs.forEach((orb) => {
        const wobble = time * orb.speed + orb.phase;
        const centerX = width * orb.x + Math.sin(wobble) * orb.driftX;
        const centerY = height * orb.y + Math.cos(wobble * 1.1) * orb.driftY;
        const radius = orb.radius + Math.sin(wobble * 0.9) * 16;
        const gradient = ctx.createRadialGradient(
          centerX,
          centerY,
          0,
          centerX,
          centerY,
          radius
        );

        gradient.addColorStop(0, `rgba(${orb.color}, ${orb.alpha})`);
        gradient.addColorStop(0.5, `rgba(${orb.color}, ${orb.alpha * 0.36})`);
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.beginPath();
        ctx.fillStyle = gradient;
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const animate = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      // Gentle dark veil keeps the background cohesive without feeling flat.
      ctx.fillStyle = isLightMode
        ? 'rgb(244, 247, 251)'
        : 'rgba(3, 3, 4, 0.18)';
      ctx.fillRect(0, 0, width, height);

      drawHaze(time);

      particles.forEach((particle) => {
        particle.update(width, height);
        particle.draw(ctx);
      });

      animationId = window.requestAnimationFrame(animate);
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    animationId = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.cancelAnimationFrame(animationId);
    };
  }, [mode]);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
