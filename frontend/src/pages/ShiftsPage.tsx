import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

type User = { id: string; name: string; role: { slug: string } };
type ShiftMember = { id: string; dayOfWeek: number; orderNum: number; user: User };
type Shift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  daysOfWeek: number[];
  roundRobin: boolean;
  isActive: boolean;
  shiftMembers: ShiftMember[];
};

// 0=أحد, 1=اثنين, ..., 6=سبت — نعرضها بدءاً من السبت
const DAYS: { index: number; name: string }[] = [
  { index: 6, name: 'السبت' },
  { index: 0, name: 'الأحد' },
  { index: 1, name: 'الاثنين' },
  { index: 2, name: 'الثلاثاء' },
  { index: 3, name: 'الأربعاء' },
  { index: 4, name: 'الخميس' },
  { index: 5, name: 'الجمعة' },
];

async function fetchShifts() {
  const { data } = await api.get('/shifts');
  return data.shifts as Shift[];
}

async function fetchUsers() {
  const { data } = await api.get('/users');
  return data.users as User[];
}

async function createShift(payload: { name: string; startTime: string; endTime: string }) {
  const { data } = await api.post('/shifts', { ...payload, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
  return data.shift as Shift;
}

async function deleteShift(id: string) {
  await api.delete(`/shifts/${id}`);
}

async function addShiftMember(shiftId: string, userId: string, dayOfWeek: number) {
  const { data } = await api.post(`/shifts/${shiftId}/members`, { userId, dayOfWeek, orderNum: 0 });
  return data.shiftMember as ShiftMember;
}

async function removeShiftMember(shiftId: string, memberId: string) {
  await api.delete(`/shifts/${shiftId}/members/${memberId}`);
}

export default function ShiftsPage() {
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const canManageMembers = hasPermission('shifts.manage');
  const [form, setForm] = useState({ name: '', startTime: '09:00', endTime: '17:00' });
  const [error, setError] = useState('');

  const { data: shifts, isLoading } = useQuery({ queryKey: ['shifts'], queryFn: fetchShifts });
  const { data: allUsers } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const users = allUsers?.filter((u) => u.role.slug === 'sales');

  const createMutation = useMutation({
    mutationFn: createShift,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] });
      setForm({ name: '', startTime: '09:00', endTime: '17:00' });
      setError('');
    },
    onError: (err: any) => setError(err.response?.data?.error || 'فشل إنشاء الشيفت'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteShift,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });

  const addMemberMutation = useMutation({
    mutationFn: ({ shiftId, userId, dayOfWeek }: { shiftId: string; userId: string; dayOfWeek: number }) =>
      addShiftMember(shiftId, userId, dayOfWeek),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ shiftId, memberId }: { shiftId: string; memberId: string }) =>
      removeShiftMember(shiftId, memberId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });

  const handleAddShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    createMutation.mutate({ name: form.name.trim(), startTime: form.startTime, endTime: form.endTime });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">شيفتات</h1>

      {/* Create shift form */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h2 className="font-semibold text-slate-700 mb-4">إضافة شيفت</h2>
        <form onSubmit={handleAddShift} className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-500 mb-1">اسم الشيفت</label>
            <input
              className="border rounded-lg px-3 py-2 min-w-[180px]"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="مثال: شيفت الصباح"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">من</label>
            <input
              type="time"
              className="border rounded-lg px-3 py-2"
              value={form.startTime}
              onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">إلى</label>
            <input
              type="time"
              className="border rounded-lg px-3 py-2"
              value={form.endTime}
              onChange={(e) => setForm((p) => ({ ...p, endTime: e.target.value }))}
            />
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? 'جاري...' : 'إضافة'}
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {/* Shifts list */}
      <div className="space-y-6">
        {isLoading ? (
          <p className="text-slate-500">جاري التحميل...</p>
        ) : !shifts?.length ? (
          <p className="text-slate-500">لا توجد شيفتات.</p>
        ) : (
          shifts.map((shift) => (
            <div key={shift.id} className="bg-white rounded-xl shadow overflow-hidden">
              {/* Shift header */}
              <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100">
                <div>
                  <h3 className="font-semibold text-slate-800">{shift.name}</h3>
                  <p className="text-sm text-slate-500">{shift.startTime} – {shift.endTime}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(shift.id)}
                  disabled={deleteMutation.isPending}
                  className="text-red-600 text-sm hover:underline"
                >
                  حذف الشيفت
                </button>
              </div>

              {/* Weekly calendar table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="py-2 px-4 text-right font-medium text-slate-600 w-28">اليوم</th>
                      <th className="py-2 px-4 text-right font-medium text-slate-600">الأعضاء</th>
                      {canManageMembers && (
                        <th className="py-2 px-4 text-right font-medium text-slate-600 w-44">إضافة</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {DAYS.map(({ index: dayIndex, name: dayName }) => {
                      const dayMembers = shift.shiftMembers?.filter((m) => m.dayOfWeek === dayIndex) ?? [];
                      const availableUsers =
                        users?.filter((u) => !dayMembers.some((m) => m.user.id === u.id)) ?? [];

                      return (
                        <tr key={dayIndex} className="hover:bg-slate-50/60">
                          <td className="py-3 px-4 font-medium text-slate-700 whitespace-nowrap">
                            {dayName}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1.5">
                              {dayMembers.length === 0 ? (
                                <span className="text-xs text-slate-300">—</span>
                              ) : (
                                dayMembers.map((m) => (
                                  <span
                                    key={m.id}
                                    className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 text-xs rounded-full px-2.5 py-0.5 border border-amber-100"
                                  >
                                    {m.user.name}
                                    {canManageMembers && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeMemberMutation.mutate({
                                            shiftId: shift.id,
                                            memberId: m.id,
                                          })
                                        }
                                        className="text-amber-400 hover:text-red-500 leading-none font-bold"
                                        title="إزالة"
                                      >
                                        ×
                                      </button>
                                    )}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                          {canManageMembers && (
                            <td className="py-2 px-4">
                              <select
                                className="border rounded-lg px-2 py-1 text-xs text-slate-600 w-full bg-white"
                                defaultValue=""
                                onChange={(e) => {
                                  const uid = e.target.value;
                                  if (uid) {
                                    addMemberMutation.mutate({
                                      shiftId: shift.id,
                                      userId: uid,
                                      dayOfWeek: dayIndex,
                                    });
                                    e.target.value = '';
                                  }
                                }}
                              >
                                <option value="">+ إضافة سيلز</option>
                                {availableUsers.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
