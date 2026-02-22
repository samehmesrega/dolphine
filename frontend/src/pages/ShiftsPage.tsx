import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

type User = { id: string; name: string };
type ShiftMember = { id: string; orderNum: number; user: User };
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

const DAYS = ['أحد', 'اثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

async function fetchShifts() {
  const { data } = await api.get('/shifts');
  return data.shifts as Shift[];
}

async function fetchUsers() {
  const { data } = await api.get('/users');
  return data.users as User[];
}

async function createShift(payload: { name: string; startTime: string; endTime: string; daysOfWeek?: number[]; roundRobin?: boolean }) {
  const { data } = await api.post('/shifts', { ...payload, daysOfWeek: payload.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6] });
  return data.shift as Shift;
}

async function deleteShift(id: string) {
  await api.delete(`/shifts/${id}`);
}

async function addShiftMember(shiftId: string, userId: string) {
  const { data } = await api.post(`/shifts/${shiftId}/members`, { userId, orderNum: 0 });
  return data.shiftMember as ShiftMember;
}

async function removeShiftMember(shiftId: string, userId: string) {
  await api.delete(`/shifts/${shiftId}/members/${userId}`);
}

export default function ShiftsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', startTime: '09:00', endTime: '17:00' });
  const [error, setError] = useState('');

  const { data: shifts, isLoading } = useQuery({ queryKey: ['shifts'], queryFn: fetchShifts });
  const { data: users } = useQuery({ queryKey: ['users'], queryFn: fetchUsers });

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
    mutationFn: ({ shiftId, userId }: { shiftId: string; userId: string }) => addShiftMember(shiftId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: ({ shiftId, userId }: { shiftId: string; userId: string }) => removeShiftMember(shiftId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shifts'] }),
  });

  const handleAddShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    createMutation.mutate({
      name: form.name.trim(),
      startTime: form.startTime,
      endTime: form.endTime,
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-800 mb-6">شيفتات</h1>

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

      <div className="space-y-4">
        {isLoading ? (
          <p className="text-slate-500">جاري التحميل...</p>
        ) : !shifts?.length ? (
          <p className="text-slate-500">لا توجد شيفتات.</p>
        ) : (
          shifts.map((shift) => (
            <div key={shift.id} className="bg-white rounded-xl shadow p-6">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold text-slate-800">{shift.name}</h3>
                  <p className="text-sm text-slate-500">
                    {shift.startTime} – {shift.endTime}
                    {shift.daysOfWeek?.length ? ` · ${shift.daysOfWeek.map((d) => DAYS[d]).join(', ')}` : ''}
                  </p>
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
              <div className="mt-4">
                <h4 className="text-sm font-medium text-slate-600 mb-2">الأعضاء</h4>
                <ul className="space-y-1 text-sm">
                  {shift.shiftMembers?.map((m) => (
                    <li key={m.id} className="flex justify-between items-center">
                      <span>{m.user.name}</span>
                      <button
                        type="button"
                        onClick={() => removeMemberMutation.mutate({ shiftId: shift.id, userId: m.user.id })}
                        className="text-red-500 text-xs hover:underline"
                      >
                        إزالة
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex gap-2 items-center">
                  <select
                    className="border rounded px-2 py-1 text-sm"
                    defaultValue=""
                    onChange={(e) => {
                      const uid = e.target.value;
                      if (uid) {
                        addMemberMutation.mutate({ shiftId: shift.id, userId: uid });
                        e.target.value = '';
                      }
                    }}
                  >
                    <option value="">— إضافة عضو —</option>
                    {users
                      ?.filter((u) => !shift.shiftMembers?.some((m) => m.user.id === u.id))
                      .map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                  </select>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
