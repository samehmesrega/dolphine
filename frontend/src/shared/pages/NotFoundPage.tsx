import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-ds-surface" dir="rtl">
      <div className="text-center max-w-md px-6">
        <p className="text-8xl font-bold text-ds-primary mb-4">404</p>
        <h1 className="text-2xl font-bold text-ds-on-surface mb-2 font-arabic">الصفحة غير موجودة</h1>
        <p className="text-ds-on-surface-v mb-8">الصفحة اللي بتدور عليها مش موجودة أو اتنقلت لمكان تاني.</p>
        <Link
          to="/"
          className="inline-block bg-gradient-to-br from-ds-primary to-ds-primary-c text-white font-medium px-6 py-3 rounded-xl hover:opacity-90 transition"
        >
          الرجوع للصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
}
