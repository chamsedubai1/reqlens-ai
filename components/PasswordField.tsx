"use client";

import { useState } from "react";
import { LockIcon, EyeIcon, EyeOffIcon } from "@/components/icons";

// Password input with a show/hide toggle. Client island so the toggle works; the
// surrounding <form> stays a Server Component posting to the server action.
export function PasswordField({
  name = "password",
  placeholder = "Enter your password",
  autoComplete = "current-password",
}: {
  name?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-slate-400">
        <LockIcon className="h-5 w-5" />
      </span>
      <input
        name={name}
        type={show ? "text" : "password"}
        required
        minLength={8}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-11 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand focus:ring-4 focus:ring-brand/10"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-3 flex items-center text-slate-400 transition hover:text-slate-600"
      >
        {show ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
      </button>
    </div>
  );
}
