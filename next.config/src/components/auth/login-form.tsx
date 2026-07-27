"use client";

import {
  AlertCircle,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  ShieldCheck,
  User,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button, Input, Label } from "@/components/ui";
import { useAppDispatch } from "@/store/hooks";
import { loginUser, logoutUser } from "@/store/slices/authSlice";
import { showToast } from "@/utils/toast";

function formatErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const values = Object.values(error);
    const messages = values.flatMap((value) =>
      Array.isArray(value) ? value.map(String) : [String(value)],
    );

    return messages.join(" ");
  }

  return String(error);
}


export function LoginForm() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("from") || "/map-view";
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const roleOptions = [
    { value: "admin", label: "Admin" },
    { value: "operator", label: "Operator" },
  ];

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!role) {
      showToast.error("Please select a role.");
      setFormError("Please select a role.");
      return;
    }

    if (!username.trim() || !password) {
      showToast.error("invalid credentials");
      setFormError("invalid credentials");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await dispatch(
        loginUser({ username: username.trim(), password }),
      ).unwrap();

      const dbRole = result.user?.role;
      const isRoleCorrect =
        (role === "admin" && dbRole === "SUPER_ADMIN") ||
        (role === "operator" && dbRole === "FIELD_OPERATOR");

      if (!isRoleCorrect) {
        await dispatch(logoutUser());
        showToast.error("select correct role.");
        setFormError("select correct role.");
        return;
      }

      router.push(redirectTo);
      router.refresh();
    } catch (err) {
      showToast.error("invalid credentials");
      setFormError("invalid credentials");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative w-full max-w-[420px] xl:max-w-[460px]">
      {/* Glow behind the card */}
      <div className="absolute -inset-1 bg-gradient-to-b from-[#4ade80]/20 to-transparent opacity-40 blur-2xl rounded-[32px] -z-10 pointer-events-none" />

      <div className="relative w-full overflow-hidden rounded-[18px] border border-white/10 bg-[#071323] p-5 shadow-lg sm:p-6 xl:rounded-[22px] xl:p-8">
        {/* subtle top highlight */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

        <div className="mb-5 text-center xl:mb-7">
          <h2 className="text-2xl font-bold tracking-wide text-white xl:text-3xl">
            Welcome Back
          </h2>
          <p className="mt-1.5 text-[12px] font-medium text-slate-400 xl:text-[13px]">
            Sign in to access your account
          </p>
        </div>

        {/* Section Title */}
        <div className="relative mb-6 w-full border-b border-white/5 xl:mb-8">
          <div className="pb-3 text-center text-[11px] font-bold tracking-[0.2em] text-white xl:text-[12px]">
            CREDENTIAL LOGIN
          </div>
          <div className="absolute bottom-[-1px] left-0 right-0 h-[2px] bg-[#4ade80] shadow-[0_0_10px_rgba(74,222,128,0.4)]" />
        </div>
        <form
          onSubmit={onSubmit}
          autoComplete="off"
          className="space-y-3 xl:space-y-4"
        >
          <div className="space-y-1.5">
            <Label
              htmlFor="username"
              className="text-[11px] font-bold tracking-wider text-slate-400"
            >
              Username
            </Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-slate-400" />
              <Input
                id="username"
                placeholder="Enter your username"
                spellCheck="false"
                value={username}
                autoComplete="username"
                onChange={(event) => {
                  setUsername(event.target.value);
                  setFormError(null);
                }}
                className="h-10 rounded-md border-white/10 bg-[#030B14]/80 pl-10 text-sm text-white transition-colors duration-150 placeholder:text-slate-500 hover:border-white/20 focus-visible:border-[#4ade80]/50 focus-visible:ring-1 focus-visible:ring-[#4ade80]/50 xl:h-11"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="u_cred_field"
              className="text-[11px] font-bold tracking-wider text-slate-400"
            >
              Password
            </Label>
            <div className="relative">
              <div
                className="absolute opacity-0 pointer-events-none -z-10 h-0 w-0 overflow-hidden"
                aria-hidden="true"
              >
                <input type="text" name="fake_user" tabIndex={-1} />
                <input type="password" name="fake_pass" tabIndex={-1} />
              </div>
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-slate-400" />
              <Input
                id="u_cred_field"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                spellCheck="false"
                value={password}
                autoComplete="new-password"
                onChange={(event) => {
                  setPassword(event.target.value);
                  setFormError(null);
                }}
                className="h-10 rounded-md border-white/10 bg-[#030B14]/80 pl-10 pr-10 text-sm text-white transition-all placeholder:text-slate-500 hover:border-white/20 focus-visible:border-[#4ade80]/50 focus-visible:ring-1 focus-visible:ring-[#4ade80]/50 xl:h-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                {showPassword ? (
                  <Eye className="h-[15px] w-[15px]" />
                ) : (
                  <EyeOff className="h-[15px] w-[15px]" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="role"
              className="text-[11px] font-bold tracking-wider text-slate-400"
            >
              Role
            </Label>
            <div className="relative">
              <ShieldCheck className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-slate-400 z-10" />
              <button
                type="button"
                onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
                onBlur={() =>
                  setTimeout(() => setIsRoleDropdownOpen(false), 200)
                }
                className={`flex h-10 w-full items-center justify-between rounded-md border border-white/10 bg-[#030B14]/80 pl-10 pr-3.5 text-sm outline-none transition-colors duration-150 hover:border-white/20 focus:border-[#4ade80]/50 focus:ring-1 focus:ring-[#4ade80]/50 xl:h-11 ${
                  role ? "text-white" : "text-slate-400"
                }`}
              >
                <span>
                  {role
                    ? roleOptions.find((r) => r.value === role)?.label
                    : "Select your role"}
                </span>
                <ChevronDown
                  className={`h-[15px] w-[15px] text-slate-400 transition-transform duration-150 ${isRoleDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isRoleDropdownOpen && (
                <div className="absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-md border border-white/10 bg-[#071323] shadow-xl">
                  {roleOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setRole(option.value);
                        setIsRoleDropdownOpen(false);
                      }}
                      className="flex w-full items-center px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-[#4ade80]/10 hover:text-[#4ade80]"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            isLoading={isSubmitting}
            className="group relative mt-1 h-10 w-full overflow-hidden rounded-md border-none bg-[#4ade80] text-sm font-bold tracking-widest text-[#04080F] transition-colors duration-150 hover:bg-[#3fcc72] hover:shadow-[0_0_20px_rgba(74,222,128,0.4)] xl:h-11"
          >
            <span className="relative z-10 flex items-center justify-center">
              LOGIN{" "}
              <LogIn className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </span>
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-200 ease-out" />
          </Button>

          <p className="flex items-center justify-center gap-1.5 pt-3 text-[10px] font-bold tracking-widest text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-[#4ade80]" />
            ALL CONNECTIONS ARE SECURE AND ENCRYPTED
          </p>
        </form>
      </div>
    </div>
  );
}
