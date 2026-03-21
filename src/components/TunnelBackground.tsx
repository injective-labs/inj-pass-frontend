/**
 * Tunnel Background Animation
 * Creates a deep, immersive tunnel effect with particles moving forward
 */

'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from '@/contexts/ThemeContext';

class Particle {
  x: number;
  y: number;
  z: number;
  prevZ: number;

  constructor() {
    this.x = Math.random() * 2 - 1;
    this.y = Math.random() * 2 - 1;
    this.z = Math.random();
    this.prevZ = this.z;
  }

  update(speed: number) {
    this.prevZ = this.z;
    this.z -= speed;

    if (this.z < 0.001) {
      this.x = Math.random() * 2 - 1;
      this.y = Math.random() * 2 - 1;
      this.z = 1;
      this.prevZ = this.z;
    }
  }

  draw(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    palette: {
      lineStart: (opacity: number) => string;
      lineEnd: (opacity: number) => string;
      dot: (opacity: number) => string;
    }
  ) {
    const scale = 1000;
    const x = (this.x / this.z) * scale + width / 2;
    const y = (this.y / this.z) * scale + height / 2;
    const prevX = (this.x / this.prevZ) * scale + width / 2;
    const prevY = (this.y / this.prevZ) * scale + height / 2;

    const size = (1 - this.z) * 3;
    const opacity = Math.min(1 - this.z, 0.8);

    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(x, y);

    const gradient = ctx.createLinearGradient(prevX, prevY, x, y);
    gradient.addColorStop(0, palette.lineStart(opacity));
    gradient.addColorStop(1, palette.lineEnd(opacity));

    ctx.strokeStyle = gradient;
    ctx.lineWidth = Math.max(size, 1);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = palette.dot(opacity);
    ctx.fill();
  }
}

export default function TunnelBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();
  const isLight = theme === 'light';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const palette = isLight
      ? {
          clear: 'rgba(244, 247, 251, 0.16)',
          lineStart: (opacity: number) => `rgba(59, 130, 246, ${opacity * 0.14})`,
          lineEnd: (opacity: number) => `rgba(148, 163, 184, ${opacity * 0.42})`,
          dot: (opacity: number) => `rgba(255, 255, 255, ${Math.min(opacity * 0.62, 0.58)})`,
        }
      : {
          clear: 'rgba(0, 0, 0, 0.15)',
          lineStart: (opacity: number) => `rgba(100, 58, 249, ${opacity * 0.3})`,
          lineEnd: (opacity: number) => `rgba(200, 180, 255, ${opacity})`,
          dot: (opacity: number) => `rgba(255, 255, 255, ${opacity})`,
        };

    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Create particles
    const particleCount = 800;
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }

    // Animation variables
    let speed = 0.003;
    let targetSpeed = 0.003;

    // Mouse interaction
    const handleMouseMove = (e: MouseEvent) => {
      const mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
      const mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
      const distance = Math.sqrt(mouseX * mouseX + mouseY * mouseY);
      targetSpeed = 0.003 + distance * 0.004;
    };
    window.addEventListener('mousemove', handleMouseMove);

    // Animation loop
    let animationId: number;
    const animate = () => {
      // Smooth speed transition
      speed += (targetSpeed - speed) * 0.05;

      // Clear canvas with fade effect for trails
      ctx.fillStyle = palette.clear;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particles.forEach(particle => {
        particle.update(speed);
        particle.draw(ctx, canvas.width, canvas.height, palette);
      });

      animationId = requestAnimationFrame(animate);
    };
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, [isLight]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0"
      style={{ background: isLight ? '#eef4fb' : 'black' }}
    />
  );
}
