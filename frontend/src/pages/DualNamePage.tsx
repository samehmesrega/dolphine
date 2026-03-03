import { useState, useRef, useEffect, useCallback } from 'react';
// @ts-ignore – engine files are plain JS
import { buildAmbigram } from '../engine/AmbigramBuilder.js';
// @ts-ignore
import { createScene, fitCameraToObject } from '../engine/SceneManager.js';

export default function DualNamePage() {
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<any>(null);
  const modelRef = useRef<any>(null);

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

  const handleGenerate = async () => {
    if (!textA.trim() || !textB.trim()) return;
    setGenerating(true);
    setError('');
    clearModel();

    try {
      const group = await buildAmbigram({
        textA: textA.trim(),
        textB: textB.trim(),
        fontUrl: '/fonts/Kanit-Bold.ttf',
        fontSize: 72,
      });

      if (group.children.length === 0) {
        setError('لم يتم إنشاء أي شكل. جرّب حروف مختلفة أو خط آخر.');
        setGenerating(false);
        return;
      }

      sceneRef.current.scene.add(group);
      fitCameraToObject(sceneRef.current.camera, group, sceneRef.current.controls);
      modelRef.current = group;
    } catch (err: any) {
      setError(err.message || 'خطأ في إنشاء المجسم');
    } finally {
      setGenerating(false);
    }
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
              maxLength={10}
              value={textA}
              onChange={(e) => setTextA(e.target.value.toUpperCase())}
            />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-slate-500 mb-1">الاسم الثاني (Side B)</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="NABIL"
              maxLength={10}
              value={textB}
              onChange={(e) => setTextB(e.target.value.toUpperCase())}
            />
          </div>
          <div className="w-full sm:w-auto">
            <button
              onClick={handleGenerate}
              disabled={generating || !textA.trim() || !textB.trim()}
              className="w-full bg-blue-600 text-white rounded-lg px-6 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 min-h-[44px]"
            >
              {generating ? 'جاري الإنشاء...' : 'إنشاء'}
            </button>
          </div>
        </div>
        {error && <div className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded">{error}</div>}
      </div>

      {/* 3D Preview */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden relative min-h-[400px]">
        <div ref={containerRef} className="w-full h-full" />
        {generating && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="bg-white rounded-xl px-6 py-4 shadow-lg text-sm text-slate-700">
              جاري إنشاء المجسم...
            </div>
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
