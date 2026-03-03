import { useState, useRef, useEffect, useCallback } from 'react';
// @ts-ignore – engine files are plain JS
import { buildAmbigram } from '../engine/AmbigramBuilder.js';
// @ts-ignore
import { createScene, fitCameraToObject } from '../engine/SceneManager.js';
// @ts-ignore
import { exportToSTL } from '../engine/STLExporter.js';
// @ts-ignore
import { CURATED_FONTS, DEFAULT_FONT } from '../engine/curated-fonts.js';

type FontEntry = { name: string; file: string; category: string };

export default function DualNamePage() {
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');
  const [fontFile, setFontFile] = useState(DEFAULT_FONT.file);
  const [fontSize, setFontSize] = useState(72);
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
        fontUrl: `/fonts/${fontFile}`,
        fontSize,
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

  const handleDownload = () => {
    if (!modelRef.current) return;
    const filename = `DualName_${textA.trim()}_${textB.trim()}.stl`;
    exportToSTL(modelRef.current, filename);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Dual Name Illusion</h1>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">الاسم الأول (Side A)</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="SAMEH"
              maxLength={10}
              value={textA}
              onChange={(e) => setTextA(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">الاسم الثاني (Side B)</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="NABIL"
              maxLength={10}
              value={textB}
              onChange={(e) => setTextB(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">الخط</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              value={fontFile}
              onChange={(e) => setFontFile(e.target.value)}
            >
              {(CURATED_FONTS as FontEntry[]).map((f) => (
                <option key={f.file} value={f.file}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">الحجم: {fontSize}</label>
            <input
              type="range"
              min={36}
              max={144}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating || !textA.trim() || !textB.trim()}
              className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 min-h-[44px]"
            >
              {generating ? 'جاري الإنشاء...' : 'إنشاء'}
            </button>
            <button
              onClick={handleDownload}
              disabled={!modelRef.current}
              className="bg-slate-700 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-slate-800 disabled:opacity-50 min-h-[44px]"
              title="تحميل STL"
            >
              STL
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
