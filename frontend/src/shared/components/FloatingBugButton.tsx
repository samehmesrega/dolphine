import { useState, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import api from '../services/api';

type TicketType = 'bug' | 'improvement' | 'suggestion';

const TYPE_OPTIONS: { value: TicketType; label: string; emoji: string; color: string; bgColor: string }[] = [
  { value: 'bug', label: 'مشكلة', emoji: '\uD83D\uDD34', color: 'text-red-600', bgColor: 'bg-red-50 border-red-300 hover:bg-red-100' },
  { value: 'improvement', label: 'تحسين', emoji: '\uD83D\uDFE1', color: 'text-yellow-600', bgColor: 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100' },
  { value: 'suggestion', label: 'اقتراح', emoji: '\uD83D\uDFE2', color: 'text-green-600', bgColor: 'bg-green-50 border-green-300 hover:bg-green-100' },
];

export default function FloatingBugButton() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TicketType | null>(null);
  const [description, setDescription] = useState('');
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [capturingScreenshot, setCapturingScreenshot] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Check if user is logged in
  const token = localStorage.getItem('dolphin_token');
  if (!token) return null;

  const captureScreenshot = async () => {
    setCapturingScreenshot(true);
    try {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        scale: 0.5, // reduce size
        logging: false,
        ignoreElements: (el) => {
          // Ignore the floating button itself and the modal
          return el.id === 'floating-bug-button' || el.id === 'floating-bug-modal';
        },
      });
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      setScreenshot(dataUrl);
      setScreenshotPreview(dataUrl);
    } catch (err) {
      console.error('Screenshot capture failed:', err);
    } finally {
      setCapturingScreenshot(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    setType(null);
    setDescription('');
    setScreenshot(null);
    setScreenshotPreview(null);
    setSuccess(false);
    // Capture screenshot when modal opens
    setTimeout(() => captureScreenshot(), 100);
  };

  const handleClose = () => {
    setOpen(false);
    setType(null);
    setDescription('');
    setScreenshot(null);
    setScreenshotPreview(null);
    setSuccess(false);
  };

  const handleSubmit = async () => {
    if (!type || !description.trim()) return;

    setLoading(true);
    try {
      await api.post('/tickets', {
        type,
        description: description.trim(),
        screenshot,
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
      });
      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err) {
      console.error('Failed to submit ticket:', err);
      alert('حدث خطأ أثناء إرسال البلاغ');
    } finally {
      setLoading(false);
    }
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        const btn = document.getElementById('floating-bug-button');
        if (btn && btn.contains(e.target as Node)) return;
        handleClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <>
      {/* Floating Button */}
      <button
        id="floating-bug-button"
        onClick={open ? handleClose : handleOpen}
        className="fixed bottom-5 left-5 z-[998] w-12 h-12 rounded-full bg-slate-700 text-white shadow-lg hover:bg-slate-600 transition-all hover:scale-110 flex items-center justify-center text-xl"
        title="بلّغ عن مشكلة"
      >
        {open ? '\u2715' : '\uD83D\uDC1B'}
      </button>

      {/* Modal */}
      {open && (
        <div
          id="floating-bug-modal"
          ref={modalRef}
          className="fixed bottom-20 left-5 z-[999] w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          dir="rtl"
        >
          {success ? (
            <div className="p-8 text-center">
              <div className="text-4xl mb-3">{'\u2705'}</div>
              <p className="text-lg font-semibold text-green-600">
                تم التسجيل {'\u2713'} — شكراً!
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <h3 className="font-semibold text-slate-700 text-sm">بلّغ عن مشكلة</h3>
              </div>

              <div className="p-4 space-y-3">
                {/* Type Selection */}
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">النوع</label>
                  <div className="flex gap-2">
                    {TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setType(opt.value)}
                        className={`flex-1 py-2 px-2 rounded-lg border text-xs font-medium transition-all ${
                          type === opt.value
                            ? `${opt.bgColor} border-2 ring-1 ring-offset-1 ${opt.color}`
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="block text-base mb-0.5">{opt.emoji}</span>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">الوصف *</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="وصف المشكلة أو الاقتراح..."
                    rows={3}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none"
                  />
                </div>

                {/* Screenshot Preview */}
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block flex items-center gap-1">
                    {'\uD83D\uDCF8'} صورة الشاشة (تلقائي)
                    {capturingScreenshot && (
                      <span className="text-blue-500 animate-pulse">جاري الالتقاط...</span>
                    )}
                    {screenshotPreview && !capturingScreenshot && (
                      <span className="text-green-500">{'\u2713'}</span>
                    )}
                  </label>
                  {screenshotPreview && (
                    <div>
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <img
                          src={screenshotPreview}
                          alt="Screenshot preview"
                          className="w-full h-24 object-cover object-top"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          // 1. أخفي المودال
                          setOpen(false);
                          setScreenshot(null);
                          setScreenshotPreview(null);
                          // 2. بعد ما المودال يختفي — التقط صورة جديدة
                          setTimeout(() => {
                            html2canvas(document.body, {
                              useCORS: true, allowTaint: true, scale: 0.5, logging: false,
                              ignoreElements: (el) => el.id === 'floating-bug-button' || el.id === 'floating-bug-modal',
                            }).then((canvas) => {
                              const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
                              // 3. حدّث الصورة وافتح المودال
                              setScreenshot(dataUrl);
                              setScreenshotPreview(dataUrl);
                              setOpen(true);
                            }).catch(() => {
                              setOpen(true);
                            });
                          }, 800);
                        }}
                        className="w-full mt-2 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition text-center"
                      >
                        📸 إعادة التقاط صورة الشاشة
                      </button>
                    </div>
                  )}
                  {!screenshotPreview && !capturingScreenshot && (
                    <button
                      type="button"
                      onClick={captureScreenshot}
                      className="w-full py-2 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500 hover:bg-slate-50 transition"
                    >
                      📸 التقاط صورة الشاشة
                    </button>
                  )}
                </div>

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={!type || !description.trim() || loading}
                  className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'جاري الإرسال...' : 'إرسال'}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
