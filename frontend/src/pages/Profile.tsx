import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import type { User } from "@/types";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const schema = z.object({
  name: z.string().min(2).max(120).optional(),
  phone: z.string().min(5).max(30).optional().or(z.literal("")),
  password: z.string().min(8).max(72).optional(),
  currentPassword: z.string().min(1).optional(),
}).refine((d) => {
  const keys = Object.keys(d) as (keyof typeof d)[];
  return keys.some(k => d[k] && String(d[k]).length > 0);
}, { message: "Update at least one field" });

type FormValues = z.infer<typeof schema>;

export default function Profile() {
  const { user, setAuth } = useAuth();

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: user?.name, phone: user?.phone ?? "" } });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = form;

  const update = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload: any = {};
      if (values.name) payload.name = values.name;
      if (values.phone) payload.phone = values.phone || undefined;
      if (values.password) { payload.password = values.password; payload.currentPassword = values.currentPassword; }
      const { data } = await api.patch<ApiResponse<{ user: User }>>("/auth/profile", payload);
      return data.data.user;
    },
    onSuccess: (updated) => {
      const token = localStorage.getItem("hs_token")!;
      setAuth(updated, token);
      reset({ name: updated.name, phone: updated.phone ?? "", password: "", currentPassword: "" });
      toast.success("Profile updated");
    },
    onError: (e: any) => toast.error(e.response?.data?.message || "Update failed"),
  });

  if (!user) return null;

  return (
    <div className="max-w-md">
      <h2 className="text-lg font-semibold mb-4">Profile</h2>
      <form onSubmit={handleSubmit((v)=>update.mutate(v))} className="bg-white border rounded-xl p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-sm">Name</label>
          <input {...register("name")} className="w-full border rounded-lg px-3 py-2 text-sm" />
          {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <label className="text-sm">Phone</label>
          <input {...register("phone")} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="border-t pt-4 space-y-4">
          <h3 className="text-sm font-medium">Change password</h3>
          <div className="space-y-2">
            <label className="text-sm">New password</label>
            <input type="password" {...register("password")} className="w-full border rounded-lg px-3 py-2 text-sm" />
            {errors.password && <p className="text-xs text-red-600">{errors.password.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm">Current password</label>
            <input type="password" {...register("currentPassword")} className="w-full border rounded-lg px-3 py-2 text-sm" />
            {errors.currentPassword && <p className="text-xs text-red-600">{errors.currentPassword.message}</p>}
          </div>
        </div>
        <button disabled={isSubmitting || update.isPending} className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-blue-700 disabled:opacity-50">
          {update.isPending ? "Saving..." : "Save changes"}
        </button>
      </form>
    </div>
  );
}