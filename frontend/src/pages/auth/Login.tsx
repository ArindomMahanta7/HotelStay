import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, type ApiResponse } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { User } from "@/types";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

type FormValues = z.infer<typeof schema>;

export default function Login() {
  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const { setAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation() as any;
  const from = location.state?.from?.pathname || "/";

  const onSubmit = async (values: FormValues) => {
    try {
      const { data } = await api.post<ApiResponse<{ user: User; token: string }>>("/auth/login", values);
      setAuth(data.data.user, data.data.token);
      toast.success("Logged in");
      navigate(from, { replace: true });
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Login failed");
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white border rounded-xl p-6 w-full max-w-sm space-y-4 shadow-sm">
        <h1 className="text-xl font-semibold">Login</h1>
        <div className="space-y-2">
          <label className="text-sm">Email</label>
          <input type="email" {...register("email")} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {errors.email && <p className="text-xs text-red-600">{errors.email.message}</p>}
        </div>
        <div className="space-y-2">
          <label className="text-sm">Password</label>
          <input type="password" {...register("password")} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
        </div>
        <button disabled={isSubmitting} className="w-full bg-blue-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-blue-700 disabled:opacity-50">
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
        <p className="text-xs text-center text-neutral-600">
          No account? <Link to="/register" className="text-blue-600 hover:underline">Register</Link>
        </p>
      </form>
    </div>
  );
}