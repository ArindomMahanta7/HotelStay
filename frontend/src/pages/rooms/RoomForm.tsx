import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import type { Room, RoomType } from "@/types";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";

const schema = z.object({
  roomTypeId: z.string().uuid("Select a room type"),
  roomNumber: z.string().min(1).max(20),
  floor: z.coerce.number().int().min(-5).max(200),
  price: z.coerce.number().nonnegative().optional().or(z.literal("")),
  status: z.enum(["available","reserved","occupied","cleaning","maintenance"]).optional(),
});

type FormValues = z.infer<typeof schema>;

export default function RoomForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data: roomTypes } = useQuery({
    queryKey: ["room-types"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<RoomType[]>>("/room-types");
      return data.data;
    },
  });

  const { data: room } = useQuery({
    queryKey: ["room", id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Room>>(`/rooms/${id}`);
      return data.data;
    },
    enabled: isEdit,
  });

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { floor: 1, status: "available" } });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = form;

  useEffect(() => {
    if (room) {
      reset({
        roomTypeId: room.roomTypeId,
        roomNumber: room.roomNumber,
        floor: room.floor,
        price: room.price != null ? room.price : "",
        status: room.status,
      });
    }
  }, [room, reset]);

  const create = useMutation({
    mutationFn: async (v: FormValues) => {
      const payload:any = { roomTypeId: v.roomTypeId, roomNumber: v.roomNumber, floor: v.floor, status: v.status };
      if (v.price !== "" && v.price !== undefined) payload.price = Number(v.price);
      const { data } = await api.post<ApiResponse<Room>>("/rooms", payload);
      return data.data;
    },
    onSuccess: () => { toast.success("Room created"); qc.invalidateQueries({queryKey:["rooms"]}); navigate("/rooms"); },
    onError: (e:any)=> toast.error(e.response?.data?.message || "Create failed"),
  });

  const update = useMutation({
    mutationFn: async (v: FormValues) => {
      const payload:any = {};
      if (v.roomTypeId) payload.roomTypeId = v.roomTypeId;
      if (v.roomNumber) payload.roomNumber = v.roomNumber;
      if (v.floor !== undefined) payload.floor = v.floor;
      if (v.status) payload.status = v.status;
      if (v.price !== "" && v.price !== undefined) payload.price = Number(v.price);
      else if (v.price === "") payload.price = null;
      const { data } = await api.patch<ApiResponse<Room>>(`/rooms/${id}`, payload);
      return data.data;
    },
    onSuccess: () => { toast.success("Room updated"); qc.invalidateQueries({queryKey:["rooms"]}); qc.invalidateQueries({queryKey:["room",id]}); navigate("/rooms"); },
    onError: (e:any)=> toast.error(e.response?.data?.message || "Update failed"),
  });

  const remove = useMutation({
    mutationFn: async () => api.delete(`/rooms/${id}`),
    onSuccess: () => { toast.success("Room deleted"); qc.invalidateQueries({queryKey:["rooms"]}); navigate("/rooms"); },
    onError: (e:any)=> toast.error(e.response?.data?.message || "Delete failed"),
  });

  const handleDelete = () => {
    if (confirm("Delete this room? This cannot be undone.")) remove.mutate();
  };

  return (
    <div className="max-w-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">{isEdit ? "Edit room" : "Add room"}</h2>
        {isEdit && isAdmin && (
          <button onClick={handleDelete} disabled={remove.isPending} className="text-sm text-red-600 hover:underline disabled:opacity-50">
            {remove.isPending ? "Deleting..." : "Delete"}
          </button>
        )}
      </div>
      <form onSubmit={handleSubmit((v)=> isEdit ? update.mutate(v) : create.mutate(v))} className="bg-white border rounded-xl p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-sm">Room type</label>
          <select {...register("roomTypeId")} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Select...</option>
            {roomTypes?.map(rt=>(
              <option key={rt.id} value={rt.id}>{rt.name} (cap {rt.capacity}) – ₹{rt.pricePerNight}/night</option>
            ))}
          </select>
          {errors.roomTypeId && <p className="text-xs text-red-600">{errors.roomTypeId.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm">Room #</label>
            <input {...register("roomNumber")} className="w-full border rounded-lg px-3 py-2 text-sm" />
            {errors.roomNumber && <p className="text-xs text-red-600">{errors.roomNumber.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm">Floor</label>
            <input type="number" {...register("floor")} className="w-full border rounded-lg px-3 py-2 text-sm" />
            {errors.floor && <p className="text-xs text-red-600">{errors.floor.message}</p>}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm">Price override (optional)</label>
          <input type="number" step="0.01" min={0} {...register("price")} placeholder="Leave empty to use room type price" className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Status</label>
          <select {...register("status")} className="w-full border rounded-lg px-3 py-2 text-sm">
            {["available","reserved","occupied","cleaning","maintenance"].map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button disabled={isSubmitting || create.isPending || update.isPending} className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-blue-700 disabled:opacity-50">
          {isEdit ? (update.isPending?"Saving...":"Save") : (create.isPending?"Creating...":"Create")}
        </button>
      </form>
    </div>
  );
}