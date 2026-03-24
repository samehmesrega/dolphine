import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const status = searchParams.get('verify');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (status === 'success') setMessage('تم تأكيد الإيميل بنجاح! يمكنك الآن الانتظار حتى يوافق المدير على حسابك.');
    else if (status === 'invalid') setMessage('رابط التأكيد غير صالح أو مستخدم مسبقاً.');
    else setMessage('حدث خطأ في تأكيد الإيميل.');
  }, [status]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${status === 'success' ? 'bg-green-100' : 'bg-red-100'}`}>
          <svg className={`w-8 h-8 ${status === 'success' ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={status === 'success' ? 'M5 13l4 4L19 7' : 'M6 18L18 6M6 6l12 12'} />
          </svg>
        </div>
        <p className="text-slate-600 mb-4">{message}</p>
        <Link to="/login" className="text-blue-600 hover:underline text-sm font-medium">تسجيل الدخول</Link>
      </div>
    </div>
  );
}
