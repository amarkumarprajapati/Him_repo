'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/hooks';
import { Users, Search, Shield, UserCheck, UserX, Clock, UserPlus, Pencil, Trash2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { DataTable, type Column } from '@/components/ui/data-table';
import { listUsers, type UserItem, createUser, updateUser, deleteUser } from '@/api/users';
import { showToast } from '@/utils/toast';
import { ConfirmDialog } from '@/components/modal/confirm-dialog';

function formatDateTime(value: string | null) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

interface UserFormModalProps {
  open: boolean;
  userToEdit: UserItem | null;
  onClose: () => void;
  onSave: () => void;
}

function UserFormModal({ open, userToEdit, onClose, onSave }: UserFormModalProps) {
  const [mounted, setMounted] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('FIELD_OPERATOR');
  const [assignedNodeId, setAssignedNodeId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      if (userToEdit) {
        setUsername(userToEdit.username || '');
        setPassword('');
        setConfirmPassword('');
        setEmail(userToEdit.email || '');
        setRole(userToEdit.role || 'FIELD_OPERATOR');
        setAssignedNodeId(userToEdit.assigned_node_id || '');
        setIsActive(userToEdit.is_active);
      } else {
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setEmail('');
        setRole('FIELD_OPERATOR');
        setAssignedNodeId('');
        setIsActive(true);
      }
      setError(null);
    }
  }, [open, userToEdit]);

  if (!mounted || !open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setError('Username is required.');
      return;
    }
    if (!userToEdit && !password) {
      setError('Password is required on creation.');
      return;
    }
    if (!userToEdit && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        username: username.trim(),
        email: email.trim(),
        role,
        assigned_node_id: assignedNodeId.trim(),
        is_active: isActive,
      };
      if (password) {
        payload.password = password;
      }

      if (userToEdit) {
        await updateUser(userToEdit.id, payload);
        showToast.success('User updated successfully.');
      } else {
        await createUser(payload);
        showToast.success('User created successfully.');
      }
      onSave();
      onClose();
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.response?.data?.username?.[0] || err?.response?.data?.role?.[0] || err?.response?.data?.assigned_node_id?.[0] || 'An error occurred while saving user.';
      setError(errMsg);
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2 }}
          className="relative bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-md overflow-hidden"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/10">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {userToEdit ? 'Edit User' : 'Create User'}
            </h3>
            <button onClick={onClose} className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
              <div className="p-3 text-xs font-semibold text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Username</label>
              <input
                type="text"
                value={username}
                disabled={!!userToEdit}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-emerald-500 dark:focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Password {userToEdit && <span className="text-[10px] text-slate-400 font-normal">(leave blank to keep unchanged)</span>}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={userToEdit ? "Enter new password" : "Enter password"}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-emerald-500 dark:focus:ring-emerald-500"
              />
            </div>

            {!userToEdit && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Confirm Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-emerald-500 dark:focus:ring-emerald-500"
                />
                {confirmPassword && (
                  <p className={`text-xs font-semibold mt-1 ${password === confirmPassword ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {password === confirmPassword ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email address"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-emerald-500 dark:focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-emerald-500 dark:focus:ring-emerald-500"
              >
                <option value="SUPER_ADMIN">Admin</option>
                <option value="FIELD_OPERATOR">Operator</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400">Assigned Node ID</label>
              <input
                type="text"
                value={assignedNodeId}
                onChange={(e) => setAssignedNodeId(e.target.value)}
                placeholder="e.g. DF-001 (optional)"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-white/10 dark:bg-white/5 dark:text-white dark:focus:border-emerald-500 dark:focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="is_active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-white/10 dark:bg-white/5"
              />
              <label htmlFor="is_active" className="text-xs font-semibold text-slate-700 dark:text-slate-300 select-none cursor-pointer">
                Active status
              </label>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-slate-200 dark:border-white/10">
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="flex-1 h-10 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 disabled:opacity-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 h-10 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}

export default function UsersPage() {
  const router = useRouter();
  const user = useAppSelector((state) => state.auth.user);
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);

  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') {
      router.replace('/map-view');
    }
  }, [user, router]);

  const loadUsers = async () => {
    try {
      const data = await listUsers();
      setUsers(data);
    } catch {
      setUsers([]);
      showToast.error('Failed to load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateClick = () => {
    setUserToEdit(null);
    setIsModalOpen(true);
  };

  const handleEditClick = (row: UserItem) => {
    setUserToEdit(row);
    setIsModalOpen(true);
  };

  const handleDeleteClick = (row: UserItem) => {
    setUserToDelete(row);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!userToDelete) return;
    try {
      await deleteUser(userToDelete.id);
      showToast.success('User deleted successfully.');
      loadUsers();
    } catch {
      showToast.error('Failed to delete user.');
    } finally {
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
    }
  };

  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return users;

    return users.filter((user) => {
      const haystack = [
        user.username,
        user.email,
        user.first_name,
        user.last_name,
        user.role,
        user.assigned_node_id,
        String(user.id),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [searchTerm, users]);

  const columns: Column<UserItem>[] = useMemo(
    () => [
      {
        key: 'id',
        header: 'ID',
        width: '70px',
        render: (row) => (
          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
            {row.id}
          </span>
        ),
      },
      {
        key: 'username',
        header: 'Username',
        width: '140px',
        render: (row) => (
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {row.username}
            </span>
          </div>
        ),
      },
      {
        key: 'email',
        header: 'Email',
        width: '180px',
        render: (row) => (
          <span className="text-xs text-slate-600 dark:text-slate-300">{row.email || '-'}</span>
        ),
      },
      {
        key: 'role',
        header: 'Role',
        width: '120px',
        render: (row) => (
          <span className="inline-flex items-center gap-1 rounded border border-[#38bdf8] bg-[#38bdf8]/10 px-2 py-0.5 text-[10px] text-[#38bdf8]">
            <Shield className="h-3 w-3" />
            {row.role || '-'}
          </span>
        ),
      },
      {
        key: 'is_active',
        header: 'Status',
        width: '110px',
        render: (row) => (
          <span
            className={`flex w-fit items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] ${
              row.is_active
                ? 'border-[#4ade80] bg-[#4ade80]/10 text-[#4ade80]'
                : 'border-red-500 bg-red-500/10 text-red-500'
            }`}
          >
            {row.is_active ? (
              <UserCheck className="h-3 w-3" />
            ) : (
              <UserX className="h-3 w-3" />
            )}
            {row.is_active ? 'Active' : 'Inactive'}
          </span>
        ),
      },
      {
        key: 'created_at',
        header: 'Created',
        width: '160px',
        render: (row) => (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {formatDateTime(row.created_at)}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Actions',
        width: '100px',
        render: (row) => (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleEditClick(row)}
              className="p-1 rounded text-slate-500 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
              title="Edit User"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDeleteClick(row)}
              disabled={row.username === 'admin' || row.username === user?.username}
              className="p-1 rounded text-slate-500 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Delete User"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ),
      },
    ],
    [user],
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <div className="shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            User Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage system users and their roles
          </p>
        </div>
        <button
          onClick={handleCreateClick}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer"
        >
          <UserPlus className="h-4 w-4" />
          Create User
        </button>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[#4ade80]" />
          <span className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400">
            ALL USERS
          </span>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-slate-100 py-1.5 pl-8 pr-3 text-xs text-slate-900 outline-none focus:ring-1 focus:ring-[#4ade80]/50 dark:border-white/5 dark:bg-white/5 dark:text-white dark:placeholder:text-slate-400"
          />
        </div>
      </div>

      <DataTable
        data={filteredUsers}
        columns={columns}
        rowKey={(row, index) => String(row.id ?? `user-${index}`)}
        pageSize={10}
        loading={loading}
        className="min-h-0 flex-1"
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete User"
        message={`Are you sure you want to delete user "${userToDelete?.username}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirmOpen(false)}
      />

      <UserFormModal
        open={isModalOpen}
        userToEdit={userToEdit}
        onClose={() => setIsModalOpen(false)}
        onSave={loadUsers}
      />
    </div>
  );
}
