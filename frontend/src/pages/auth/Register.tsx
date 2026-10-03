import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { api, type ApiResponse } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import type { User } from "@/types";

const schema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  phone: z.string().min(5).max(30).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

export default function Register() {
  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const { setAuth } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (values: FormValues) => {
    try {
      const payload = { ...values, phone: values.phone || undefined };
      const { data } = await api.post<ApiResponse<{ user: User; token: string }>>("/auth/register", payload);
      setAuth(data.data.user, data.data.token);
      toast.success("Account created");
      navigate("/");
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Registration failed");
    }
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white border rounded-xl p-6 w-full max-w-sm space-y-4 shadow-sm">
        <h1 className="text-xl font-semibold">Create account</h1>
        <div className="space-y-2">
          <label className="text-sm">Full name</label>
          <input {...register("name")} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
        </div>
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
        <div className="space-y-2">
          <label className="text-sm">Phone (optional)</label>
          <input {...register("phone")} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {errors.phone && <p className="text-xs text-red-600">{errors.phone.message}</p>}
        </div>
        <button disabled={isSubmitting} className="w-full bg-blue-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-blue-700 disabled:opacity-50">
          {isSubmitting ? "Creating..." : "Create account"}
        </button>
        <p className="text-xs text-center text-neutral-600">
          Already have an account? <Link to="/login" className="text-blue-600 hover:underline">Login</Link>
        </p>
      </form>
    </div>
  );
}