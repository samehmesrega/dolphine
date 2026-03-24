import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../../../shared/services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const verifyStatus = searchParams.get('verify');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { email, password });
      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      const msg = err.response?.data?.error
        || (err.response?.status === 500 && 'خطأ في الخادم. تحقق من تشغيل الـ Backend وقاعدة البيانات.')
        || (err.code === 'ERR_NETWORK' && 'لا يمكن الاتصال بالسيرفر. تأكد أن الـ Backend يعمل على المنفذ 4000.')
        || err.message
        || 'حدث خطأ في تسجيل الدخول';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800">دولفين</h1>
          <p className="text-slate-500 mt-1">نظام إدارة الليدز والمبيعات</p>
        </div>
        {verifyStatus === 'success' && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm mb-4 text-center">
            تم تأكيد الإيميل بنجاح! حسابك في انتظار موافقة المدير.
          </div>
        )}
        {verifyStatus === 'invalid' && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm mb-4 text-center">
            رابط التأكيد غير صالح أو مستخدم مسبقاً.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              البريد الإلكتروني
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              كلمة المرور
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'جاري الدخول...' : 'تسجيل الدخول'}
          </button>
        </form>

        <div className="mt-4 space-y-2 text-center text-sm">
          <p>
            <Link to="/forgot-password" className="text-blue-600 hover:underline">نسيت كلمة المرور؟</Link>
          </p>
          <p className="text-slate-500">
            ليس لديك حساب؟{' '}
            <Link to="/register" className="text-blue-600 hover:underline font-medium">سجّل الآن</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
