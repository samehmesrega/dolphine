import { useState, useRef, useEffect, useCallback } from 'react';
// @ts-ignore – engine files are plain JS
import { buildAmbigram } from '../engine/AmbigramBuilder.js';
// @ts-ignore
import { createScene, fitCameraToObject } from '../engine/SceneManager.js';
import * as THREE from 'three';

const COLORS = [
  { name: 'Terracotta', value: '#e8735a' },
  { name: 'أسود', value: '#1a1a1a' },
  { name: 'ذهبي', value: '#d4a843' },
  { name: 'فضي', value: '#c0c0c0' },
  { name: 'أبيض', value: '#f5f5f5' },
  { name: 'خشبي', value: '#8b6914' },
  { name: 'أزرق', value: '#2563eb' },
  { name: 'وردي', value: '#ec4899' },
];

export default function DualNamePage() {
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');
  const [color, setColor] = useState('#e8735a');
  const [generating, setGenerating] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [error, setError] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const watermarkRef = useRef<HTMLDivElement>(null);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;
    const s = createScene(containerRef.current);
    s.animate();
    sceneRef.current = s;
    return () => s.dispose();
  }, []);

  // Dispose old model helper
  const clearModel = useCallback(() => {
    if (modelRef.current && sceneRef.current) {
      sceneRef.current.scene.remove(modelRef.current);
      modelRef.current.traverse((child: any) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach((m: any) => m.dispose());
          else child.material.dispose();
        }
      });
      modelRef.current = null;
    }
  }, []);

  // Apply color to model
  const applyColor = useCallback((hex: string) => {
    if (!modelRef.current) return;
    const threeColor = new THREE.Color(hex);
    modelRef.current.traverse((child: any) => {
      if (child.isMesh && child.material) {
        child.material.color.set(threeColor);
      }
    });
  }, []);

  // When color changes, apply it
  useEffect(() => {
    applyColor(color);
  }, [color, applyColor]);

  const handleGenerate = async () => {
    if (!textA.trim() || !textB.trim()) return;
    setGenerating(true);
    setError('');
    clearModel();

    try {
      const group = await buildAmbigram({
        textA: textA.trim(),
        textB: textB.trim(),
        fontUrl: '/fonts/OverpassMono-Bold.ttf',
        fontSize: 72,
        cornerRadius: 5,
        baseThickness: 2,
      });

      if (group.children.length === 0) {
        setError('لم يتم إنشاء أي شكل. جرّب حروف مختلفة.');
        setGenerating(false);
        return;
      }

      // Apply selected color
      const threeColor = new THREE.Color(color);
      group.traverse((child: any) => {
        if (child.isMesh && child.material) {
          child.material.color.set(threeColor);
        }
      });

      sceneRef.current.scene.add(group);
      fitCameraToObject(sceneRef.current.camera, group, sceneRef.current.controls);
      modelRef.current = group;
    } catch (err: any) {
      setError(err.message || 'خطأ في إنشاء المجسم');
    } finally {
      setGenerating(false);
    }
  };

  const handleRecord = () => {
    if (!sceneRef.current || !modelRef.current || recording) return;
    const canvas = sceneRef.current.renderer.domElement as HTMLCanvasElement;

    // Create a composite canvas with watermark
    const compositeCanvas = document.createElement('canvas');
    compositeCanvas.width = canvas.width;
    compositeCanvas.height = canvas.height;
    const ctx = compositeCanvas.getContext('2d')!;

    const stream = compositeCanvas.captureStream(30);
    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm',
    });

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      cancelAnimationFrame(drawFrame);
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DualName_${textA.trim()}_${textB.trim()}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      sceneRef.current.controls.autoRotate = false;
      setRecording(false);
      setRecordProgress(0);
    };

    // Draw frame: 3D canvas + watermark text
    let drawFrame = 0;
    const drawComposite = () => {
      ctx.drawImage(canvas, 0, 0);

      // Watermark background
      const wmHeight = 56;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, compositeCanvas.height - wmHeight, compositeCanvas.width, wmHeight);

      // Watermark text
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';

      ctx.font = '500 13px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(
        'هذا الفيديو لمجسم تصويري خاص بيك وليس فيديو للمنتج النهائي',
        compositeCanvas.width / 2,
        compositeCanvas.height - 32,
      );

      ctx.font = '600 14px "Segoe UI", system-ui, sans-serif';
      ctx.fillStyle = '#f0c040';
      ctx.fillText(
        'تم التصميم بواسطة Print IN',
        compositeCanvas.width / 2,
        compositeCanvas.height - 12,
      );

      drawFrame = requestAnimationFrame(drawComposite);
    };

    // Enable auto-rotate during recording
    sceneRef.current.controls.autoRotate = true;
    sceneRef.current.controls.autoRotateSpeed = 4;
    setRecording(true);
    setRecordProgress(0);
    recorder.start();
    drawComposite();

    // Update progress every second
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += 1;
      setRecordProgress(elapsed);
      if (elapsed >= 5) clearInterval(timer);
    }, 1000);

    // Stop after 5 seconds
    setTimeout(() => {
      clearInterval(timer);
      recorder.stop();
      stream.getTracks().forEach((t) => t.stop());
    }, 5000);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Dual Name Illusion</h1>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-slate-500 mb-1">الاسم الأول (Side A)</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="SAMEH"
              maxLength={15}
              value={textA}
              onChange={(e) => setTextA(e.target.value.toUpperCase())}
            />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-slate-500 mb-1">الاسم الثاني (Side B)</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="NABIL"
              maxLength={15}
              value={textB}
              onChange={(e) => setTextB(e.target.value.toUpperCase())}
            />
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-slate-500 mb-1">اللون</label>
            <select
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {COLORS.map((c) => (
                <option key={c.value} value={c.value}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={handleGenerate}
              disabled={generating || !textA.trim() || !textB.trim()}
              className="flex-1 sm:flex-none bg-blue-600 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 min-h-[44px]"
            >
              {generating ? 'جاري الإنشاء...' : 'إنشاء'}
            </button>
            <button
              onClick={handleRecord}
              disabled={!modelRef.current || recording || generating}
              className="flex-1 sm:flex-none bg-red-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 min-h-[44px]"
              title="تصوير فيديو 5 ثواني"
            >
              {recording ? `${5 - recordProgress}s` : 'تصوير'}
            </button>
          </div>
        </div>
        {error && <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
      </div>

      {/* 3D Preview */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden relative min-h-[400px]">
        <div ref={containerRef} className="w-full h-full" />
        <div ref={watermarkRef} />
        {generating && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="bg-white rounded-xl px-6 py-4 shadow-lg text-sm text-slate-700">
              جاري إنشاء المجسم...
            </div>
          </div>
        )}
        {recording && (
          <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-600 text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-lg">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            REC {5 - recordProgress}s
          </div>
        )}
        {!modelRef.current && !generating && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-slate-400 text-sm">أدخل اسمين واضغط "إنشاء" لرؤية المجسم ثلاثي الأبعاد</p>
          </div>
        )}
      </div>
    </div>
  );
}
