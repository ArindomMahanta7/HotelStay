import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import type { Booking } from "@/types";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";

const schema = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  numGuests: z.coerce.number().int().min(1).max(50),
  roomIds: z.string().optional(),
  roomTypeId: z.string().uuid().optional(),
  guestName: z.string().min(2).max(120).optional(),
  guestEmail: z.string().email().optional().or(z.literal("")),
  guestPhone: z.string().min(5).max(30).optional().or(z.literal("")),
  specialRequests: z.string().max(1000).optional(),
}).refine((d)=> d.roomIds || d.roomTypeId, { message: "Pick a room or a room type", path: ["roomIds"] })
 .refine((d)=> d.checkOut > d.checkIn, { message: "Check-out must be after check-in", path: ["checkOut"] });

type FormValues = z.infer<typeof schema>;

export default function BookingNew() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const defaults: Partial<FormValues> = {
    checkIn: sp.get("checkIn") || format(new Date(), "yyyy-MM-dd"),
    checkOut: sp.get("checkOut") || format(new Date(Date.now()+86400000), "yyyy-MM-dd"),
    numGuests: sp.get("guests") ? +sp.get("guests")! : 1,
    roomIds: sp.get("roomId") || undefined,
    roomTypeId: sp.get("roomTypeId") || undefined,
  };

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });

  const create = useMutation({
    mutationFn: async (v: FormValues) => {
      const payload: any = {
        checkIn: v.checkIn,
        checkOut: v.checkOut,
        numGuests: v.numGuests,
        specialRequests: v.specialRequests || undefined,
      };
      if (v.roomIds) payload.roomIds = v.roomIds.split(",").map(s=>s.trim()).filter(Boolean);
      if (v.roomTypeId) payload.roomTypeId = v.roomTypeId;
      if (v.guestName) {
        payload.guest = {
          name: v.guestName,
          email: v.guestEmail || undefined,
          phone: v.guestPhone || undefined,
        };
      }
      const { data } = await api.post<ApiResponse<Booking>>("/bookings", payload);
      return data.data;
    },
    onSuccess: (b) => { toast.success("Booking created"); navigate(`/bookings/${b.id}`); },
    onError: (e:any)=> toast.error(e.response?.data?.message || "Failed to create booking"),
  });

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold mb-4">New booking</h2>
      <form onSubmit={handleSubmit((v)=>create.mutate(v))} className="bg-white border rounded-xl p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm">Check-in</label>
            <input type="date" {...register("checkIn")} className="w-full border rounded-lg px-3 py-2 text-sm" />
            {errors.checkIn && <p className="text-xs text-red-600">{errors.checkIn.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm">Check-out</label>
            <input type="date" {...register("checkOut")} className="w-full border rounded-lg px-3 py-2 text-sm" />
            {errors.checkOut && <p className="text-xs text-red-600">{errors.checkOut.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm">Guests</label>
            <input type="number" min={1} {...register("numGuests")} className="w-full border rounded-lg px-3 py-2 text-sm" />
            {errors.numGuests && <p className="text-xs text-red-600">{errors.numGuests.message}</p>}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm">Room IDs (comma separated)</label>
            <input {...register("roomIds")} placeholder="e.g. uuid1, uuid2" className="w-full border rounded-lg px-3 py-2 text-sm" />
            {errors.roomIds && <p className="text-xs text-red-600">{errors.roomIds.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm">Or Room Type ID (auto-assign)</label>
            <input {...register("roomTypeId")} placeholder="uuid" className="w-full border rounded-lg px-3 py-2 text-sm" />
            {errors.roomTypeId && <p className="text-xs text-red-600">{errors.roomTypeId.message}</p>}
          </div>
        </div>
        <div className="border-t pt-4 space-y-4">
          <h3 className="text-sm font-medium">Guest details (optional if logged in)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2 md:col-span-1">
              <label className="text-sm">Name</label>
              <input {...register("guestName")} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-sm">Email</label>
              <input type="email" {...register("guestEmail")} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-sm">Phone</label>
              <input {...register("guestPhone")} className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm">Special requests</label>
          <textarea rows={3} {...register("specialRequests")} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <button disabled={isSubmitting || create.isPending} className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-blue-700 disabled:opacity-50">
          {create.isPending ? "Creating..." : "Create booking"}
        </button>
      </form>
    </div>
  );
}