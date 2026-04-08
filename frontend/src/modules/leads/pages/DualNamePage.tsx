import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
// @ts-ignore – engine files are plain JS
import { buildAmbigram } from '../engine/AmbigramBuilder.js';
// @ts-ignore
import { createScene, fitCameraToObject } from '../engine/SceneManager.js';
// @ts-ignore
import { Color } from 'three';
import api from '../../../shared/services/api';

// Apply 3D print layer lines via shader — realistic FDM look
function applyLayerLines(material: any, layerHeight = 0.2) {
  material.onBeforeCompile = (shader: any) => {
    shader.uniforms.layerHeight = { value: layerHeight };
    // Pass world Y + world normal to fragment
    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      `varying float vWorldY;
       varying vec3 vWorldNormal;
       void main() {`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
       vec4 wPos = modelMatrix * vec4(transformed, 1.0);
       vWorldY = wPos.y;
       vWorldNormal = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `varying float vWorldY;
       varying vec3 vWorldNormal;
       uniform float layerHeight;
       void main() {`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
       // How vertical is the surface (1.0 = vertical wall, 0.0 = flat top)
       float verticalness = 1.0 - abs(vWorldNormal.y);

       // Position within current layer (0.0 = bottom edge, 1.0 = top edge)
       float layerPos = mod(vWorldY, layerHeight) / layerHeight;

       // Rounded bead profile: bright center, dark edges (like a half-cylinder)
       float bead = sin(layerPos * 3.14159);

       // Shadow at layer boundary (bottom of each layer)
       float shadow = smoothstep(0.0, 0.2, layerPos);

       // Highlight at top of each bead
       float highlight = pow(bead, 2.0) * 0.15;

       // Combine: shadow at edges + highlight on bead + scale by verticalness
       float effect = mix(1.0, (0.85 + 0.15 * bead) * shadow + highlight, verticalness * 0.7);

       gl_FragColor.rgb *= effect;`
    );
  };
  material.customProgramCacheKey = () => 'layerLines_v3';
  material.needsUpdate = true;
}

const DEFAULT_COLORS = [
  { name: 'Terracotta', hex: '#e8735a' },
  { name: 'أسود', hex: '#1a1a1a' },
  { name: 'ذهبي', hex: '#d4a843' },
  { name: 'فضي', hex: '#c0c0c0' },
  { name: 'أبيض', hex: '#f5f5f5' },
  { name: 'خشبي', hex: '#8b6914' },
  { name: 'أزرق', hex: '#2563eb' },
  { name: 'وردي', hex: '#ec4899' },
];

const DEFAULT_WATERMARK = {
  line1: 'هذا الفيديو لمجسم تصويري خاص بيك وليس فيديو للمنتج النهائي',
  line2: 'تم التصميم بواسطة Print IN',
};

export default function DualNamePage() {
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');
  const { data: colorsFromSettings } = useQuery({
    queryKey: ['setting', 'dual_name_colors'],
    queryFn: async () => {
      const { data } = await api.get('/integrations/setting/dual_name_colors');
      return data.value ? JSON.parse(data.value) as { name: string; hex: string }[] : null;
    },
  });
  const { data: watermarkFromSettings } = useQuery({
    queryKey: ['setting', 'dual_name_watermark'],
    queryFn: async () => {
      const { data } = await api.get('/integrations/setting/dual_name_watermark');
      return data.value ? JSON.parse(data.value) as { line1: string; line2: string } : null;
    },
  });
  const COLORS = colorsFromSettings || DEFAULT_COLORS;
  const watermark = watermarkFromSettings || DEFAULT_WATERMARK;
  const [color, setColor] = useState('#e8735a');
  const [generating, setGenerating] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const [error, setError] = useState('');
  const [heartCopied, setHeartCopied] = useState(false);
  const lastFocusedRef = useRef<'a' | 'b'>('a');

  const insertHeart = () => {
    if (lastFocusedRef.current === 'a') {
      setTextA((prev) => prev + '♥');
    } else {
      setTextB((prev) => prev + '♥');
    }
    setHeartCopied(true);
    setTimeout(() => setHeartCopied(false), 800);
  };

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

  // Apply color + 3D-printed material look
  const applyColor = useCallback((hex: string) => {
    if (!modelRef.current) return;
    const threeColor = new Color(hex);
    modelRef.current.traverse((child: any) => {
      if (child.isMesh && child.material) {
        child.material.color.set(threeColor);
        child.material.roughness = 0.8;
        child.material.metalness = 0.05;
        child.material.envMapIntensity = 0.3;
        applyLayerLines(child.material, 0.2);
        child.material.needsUpdate = true;
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

      // Apply selected color + 3D-printed material look
      const threeColor = new Color(color);
      group.traverse((child: any) => {
        if (child.isMesh && child.material) {
          child.material.color.set(threeColor);
          child.material.roughness = 0.8;
          child.material.metalness = 0.05;
          child.material.envMapIntensity = 0.3;
          child.material.needsUpdate = true;
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
      // Restore camera position
      cam.position.copy(savedPos);
      ctrl.target.copy(savedTarget);
      ctrl.update();
      setRecording(false);
      setRecordProgress(0);
    };

    // Zoom camera closer to model before recording
    const cam = sceneRef.current.camera;
    const ctrl = sceneRef.current.controls;
    const savedPos = cam.position.clone();
    const savedTarget = ctrl.target.clone();
    // Move camera closer (60% of current distance)
    const dir = cam.position.clone().sub(ctrl.target).normalize();
    const dist = cam.position.distanceTo(ctrl.target) * 0.6;
    cam.position.copy(ctrl.target.clone().add(dir.multiplyScalar(dist)));
    ctrl.update();

    // Draw frame: 3D canvas + watermark text
    let drawFrame = 0;
    const w = compositeCanvas.width;
    const h = compositeCanvas.height;
    const scale = w / 800; // scale text relative to canvas size

    const drawComposite = () => {
      ctx.drawImage(canvas, 0, 0);

      // Watermark background
      const wmHeight = Math.round(80 * scale);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, h - wmHeight, w, wmHeight);

      // Watermark text — clear and readable
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Line 1
      ctx.font = `500 ${Math.round(18 * scale)}px "Segoe UI", "Arial", sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText(
        watermark.line1,
        w / 2,
        h - wmHeight * 0.6,
      );

      // Line 2
      ctx.font = `700 ${Math.round(20 * scale)}px "Segoe UI", "Arial", sans-serif`;
      ctx.fillStyle = '#f0c040';
      ctx.fillText(
        watermark.line2,
        w / 2,
        h - wmHeight * 0.25,
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
              onFocus={() => { lastFocusedRef.current = 'a'; }}
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
              onFocus={() => { lastFocusedRef.current = 'b'; }}
              onChange={(e) => setTextB(e.target.value.toUpperCase())}
            />
          </div>
          <div className="w-auto">
            <label className="block text-xs font-medium text-slate-500 mb-1 opacity-0 select-none">copy</label>
            <button
              type="button"
              onClick={insertHeart}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm hover:bg-pink-50 hover:border-pink-300 transition-colors min-h-[44px]"
              title="نسخ قلب ❤ للصق في الاسم"
            >
              {heartCopied ? '✓ تم' : '❤ إضافة قلب'}
            </button>
          </div>
          <div className="w-full sm:w-auto">
            <label className="block text-xs font-medium text-slate-500 mb-1">اللون</label>
            <select
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {COLORS.map((c) => (
                <option key={c.hex} value={c.hex}>{c.name}</option>
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
