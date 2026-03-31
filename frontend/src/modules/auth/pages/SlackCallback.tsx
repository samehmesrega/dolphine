import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../../../shared/services/api';

export default function SlackCallback() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'pending' | 'error'>('loading');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setStatus('error');
      setError('لم يتم استلام رمز التفويض من Slack');
      return;
    }

    api.post('/auth/slack/callback', { code })
      .then(({ data }) => {
        if (data.pending) {
          setStatus('pending');
        } else {
          login(data.token, data.user);
          navigate('/');
        }
      })
      .catch((err) => {
        setStatus('error');
        setError(err.response?.data?.error || 'فشل تسجيل الدخول بـ Slack');
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl text-center">
        {status === 'loading' && (
          <>
            <div className="w-10 h-10 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-600">جاري تسجيل الدخول بـ Slack...</p>
          </>
        )}
        {status === 'pending' && (
          <>
            <div className="text-4xl mb-4">⏳</div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">تم التسجيل بنجاح</h2>
            <p className="text-slate-500">حسابك في انتظار موافقة المدير. ستتمكن من الدخول بعد الموافقة.</p>
            <button onClick={() => navigate('/login')} className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              العودة لتسجيل الدخول
            </button>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="text-4xl mb-4">❌</div>
            <h2 className="text-xl font-bold text-slate-800 mb-2">خطأ</h2>
            <p className="text-red-600 text-sm">{error}</p>
            <button onClick={() => navigate('/login')} className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              حاول مرة أخرى
            </button>
          </>
        )}
      </div>
    </div>
  );
}
