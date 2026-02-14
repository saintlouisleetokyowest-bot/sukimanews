import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import {
  ArrowLeft,
  Search,
  Lock,
  UserCheck,
  UserX,
  Trash2,
  KeyRound,
  ChevronRight,
  Shield,
} from "lucide-react";
import { FluidBackground } from "../components/fluid-background";
import { useAuth } from "../components/auth-provider";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  isDisabled: boolean;
  createdAt: number;
  lastLoginAt: number | null;
  lastSeenAt: number | null;
  usageTotal: number;
  usageLastCallAt: number | null;
};

export function AdminUsersScreen() {
  const navigate = useNavigate();
  const { user, loading, authFetch } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [deleteUser, setDeleteUser] = useState<AdminUser | null>(null);

  const loadUsers = async () => {
    const res = await authFetch("/api/admin/users");
    if (!res.ok) {
      throw new Error((await res.json())?.error || "Failed to load users");
    }
    return res.json();
  };

  const refresh = async () => {
    setError(null);
    try {
      const data = await loadUsers();
      setUsers(data.users || []);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError("Failed to load users");
    }
  };

  useEffect(() => {
    if (!loading && user?.isAdmin) {
      refresh();
    }
  }, [loading, user?.isAdmin]);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(needle) ||
        u.email.toLowerCase().includes(needle)
    );
  }, [users, query]);

  const updateUser = async (id: string, payload: Record<string, unknown>) => {
    setError(null);
    try {
      const res = await authFetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "Update failed");
      }
      await refresh();
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError("Update failed");
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      const res = await authFetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error || "Delete failed");
      }
      await refresh();
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError("Delete failed");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Please sign in to continue.</p>
          <button
            onClick={() => navigate("/auth")}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-xl"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!user.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">You do not have access to this page.</p>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-xl"
          >
            Back Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <FluidBackground />

      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", damping: 25 }}
        className="relative glass-strong px-5 py-4 flex items-center justify-between shadow-lg border-b border-white/40"
      >
        <motion.button
          whileHover={{ scale: 1.1, x: -5 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate("/admin")}
          className="p-2.5 glass rounded-full transition-all duration-200 hover:shadow-md"
        >
          <ArrowLeft className="w-5 h-5 text-primary" strokeWidth={1.5} />
        </motion.button>
        <h1 className="text-lg font-semibold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
          Manage Users
        </h1>
        <div className="w-11" />
      </motion.header>

      <main className="relative flex-1 overflow-auto pb-16 px-4">
        <div className="max-w-6xl mx-auto py-6 space-y-8">
          {error && (
            <div className="glass-strong border border-red-500/30 text-red-600 rounded-2xl px-4 py-3">
              {error}
            </div>
          )}

          <section className="glass-strong rounded-3xl p-6 border border-white/30 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-primary">Users</h2>
                <p className="text-xs text-muted-foreground">Manage users and access</p>
              </div>
              <div className="relative w-full md:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search name or email"
                  className="w-full pl-9 pr-3 py-2 rounded-2xl glass border border-white/30 text-sm outline-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div
                className="hidden md:grid items-center gap-4 px-4 py-2 text-xs text-muted-foreground border-b border-white/10"
                style={{ gridTemplateColumns: "1fr 80px 112px 152px 24px" }}
              >
                <div className="min-w-0">User</div>
                <div className="text-right">API Calls</div>
                <div />
                <div />
                <div />
              </div>
              {filteredUsers.map((u) => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                  onClick={() => navigate(`/admin/users/${u.id}`)}
                  className="flex flex-col gap-3 px-4 py-3 glass rounded-2xl border border-white/30 cursor-pointer hover:border-primary/40 transition-colors md:grid md:grid-cols-[1fr_80px_112px_152px_24px] md:gap-4"
                >
                  {/* 狭幅：1行目 = ユーザー+API+状態；広幅：5列グリッド */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 md:contents">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-primary truncate">{u.name || "Unnamed"}</div>
                      <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    </div>
                    <div className="text-sm font-semibold text-primary md:text-right">{u.usageTotal}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {u.isAdmin && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary border border-primary/30">
                          Admin
                        </span>
                      )}
                      {u.isDisabled ? (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-600 border border-red-500/30">
                          Disabled
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                          Active
                        </span>
                      )}
                    </div>
                  </div>
                  <div
                    className="flex items-center justify-end gap-1.5 md:contents"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-1.5">
                      <button
                        className="p-2 rounded-lg glass border border-white/30 hover:border-primary/40 text-primary"
                        onClick={(e) => { e.stopPropagation(); updateUser(u.id, { isDisabled: !u.isDisabled }); }}
                        title={u.isDisabled ? "Enable user" : "Disable user"}
                      >
                        {u.isDisabled ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                      </button>
                      <button
                        className="p-2 rounded-lg glass border border-white/30 hover:border-primary/40 text-primary"
                        onClick={(e) => { e.stopPropagation(); updateUser(u.id, { isAdmin: !u.isAdmin }); }}
                        title={u.isAdmin ? "Revoke admin" : "Make admin"}
                      >
                        <Shield className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 rounded-lg glass border border-white/30 hover:border-primary/40 text-primary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setResetUser(u);
                          setResetPassword("");
                        }}
                        title="Reset password"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        className="p-2 rounded-lg glass border border-white/30 hover:border-red-500/40 text-red-600"
                        onClick={(e) => { e.stopPropagation(); setDeleteUser(u); }}
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-primary shrink-0 justify-self-end" strokeWidth={1.5} />
                </motion.div>
              ))}
              {filteredUsers.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  No users found.
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setResetUser(null)} />
          <div className="relative glass-strong border border-white/30 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-primary">Reset Password</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Set a new password for {resetUser.email}
            </p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center gap-2 glass rounded-2xl px-4 py-3 border border-white/30">
                <Lock className="w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(event) => setResetPassword(event.target.value)}
                  placeholder="New password (min 6 chars)"
                  className="w-full bg-transparent outline-none text-sm"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  className="px-4 py-2 rounded-xl glass border border-white/30"
                  onClick={() => setResetUser(null)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground"
                  onClick={async () => {
                    if (!resetUser) return;
                    await updateUser(resetUser.id, { resetPassword });
                    setResetUser(null);
                  }}
                  disabled={resetPassword.length < 6}
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDeleteUser(null)} />
          <div className="relative glass-strong border border-white/30 rounded-3xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-semibold text-primary">Delete User</h3>
            <p className="text-sm text-muted-foreground mt-2">
              This will permanently remove {deleteUser.email} and all related data.
            </p>
            <div className="mt-5 flex gap-2 justify-end">
              <button
                className="px-4 py-2 rounded-xl glass border border-white/30"
                onClick={() => setDeleteUser(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-red-500 text-white"
                onClick={async () => {
                  if (!deleteUser) return;
                  await handleDelete(deleteUser.id);
                  setDeleteUser(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
