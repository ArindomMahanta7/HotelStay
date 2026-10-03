import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import type { RoomType } from "@/types";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useEffect } from "react";

const schema = z.object({
  name: z.enum(["single","double","deluxe","suite"]),
  description: z.string().max(2000).optional().or(z.literal("")),
  capacity: z.coerce.number().int().min(1).max(12),
  pricePerNight: z.coerce.number().nonnegative(),
  amenities: z.string().optional(),
  images: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const splitList = (value?: string) =>
  value ? value.split(",").map(s=>s.trim()).filter(Boolean) : [];

export default function RoomTypeForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: rt } = useQuery({
    queryKey: ["room-type", id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<RoomType>>(`/room-types/${id}`);
      return data.data;
    },
    enabled: isEdit,
  });

  const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "double", capacity: 2, pricePerNight: 1500 } });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = form;

  useEffect(() => {
    if (rt) {
      reset({
        name: rt.name,
        description: rt.description ?? "",
        capacity: rt.capacity,
        pricePerNight: Number(rt.pricePerNight),
        amenities: rt.amenities?.join(", ") ?? "",
        images: rt.images?.join(", ") ?? "",
      });
    }
  }, [rt, reset]);

  const create = useMutation({
    mutationFn: async (v: FormValues) => {
      const payload:any = { name: v.name, capacity: v.capacity, pricePerNight: v.pricePerNight };
      if (v.description) payload.description = v.description;
      payload.amenities = splitList(v.amenities);
      payload.images = splitList(v.images);
      const { data } = await api.post<ApiResponse<RoomType>>("/room-types", payload);
      return data.data;
    },
    onSuccess: () => { toast.success("Room type created"); qc.invalidateQueries({queryKey:["room-types"]}); navigate("/room-types"); },
    onError: (e:any)=> toast.error(e.response?.data?.message || "Create failed"),
  });

  const update = useMutation({
    mutationFn: async (v: FormValues) => {
      const payload:any = {
        name: v.name,
        capacity: v.capacity,
        pricePerNight: v.pricePerNight,
        description: v.description || null,
        amenities: splitList(v.amenities),
        images: splitList(v.images),
      };
      const { data } = await api.patch<ApiResponse<RoomType>>(`/room-types/${id}`, payload);
      return data.data;
    },
    onSuccess: () => { toast.success("Room type updated"); qc.invalidateQueries({queryKey:["room-types"]}); qc.invalidateQueries({queryKey:["room-type",id]}); navigate("/room-types"); },
    onError: (e:any)=> toast.error(e.response?.data?.message || "Update failed"),
  });

  const remove = useMutation({
    mutationFn: async () => api.delete(`/room-types/${id}`),
    onSuccess: () => { toast.success("Room type deleted"); qc.invalidateQueries({queryKey:["room-types"]}); navigate("/room-types"); },
    onError: (e:any)=> toast.error(e.response?.data?.message || "Delete failed"),
  });

  const handleDelete = () => {
    if (confirm("Delete this room type? Rooms using it may fail. Continue?")) remove.mutate();
  };

  return (
    <div className="max-w-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold">{isEdit ? "Edit room type" : "Add room type"}</h2>
        {isEdit && (
          <button onClick={handleDelete} disabled={remove.isPending} className="text-sm text-red-600 hover:underline disabled:opacity-50">
            {remove.isPending ? "Deleting..." : "Delete"}
          </button>
        )}
      </div>
      <form onSubmit={handleSubmit((v)=> isEdit ? update.mutate(v) : create.mutate(v))} className="bg-white border rounded-xl p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-sm">Name</label>
          <select {...register("name")} className="w-full border rounded-lg px-3 py-2 text-sm">
            {["single","double","deluxe","suite"].map(n=><option key={n} value={n}>{n}</option>)}
          </select>
          {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm">Capacity</label>
            <input type="number" {...register("capacity")} className="w-full border rounded-lg px-3 py-2 text-sm" />
            {errors.capacity && <p className="text-xs text-red-600">{errors.capacity.message}</p>}
          </div>
          <div className="space-y-2">
            <label className="text-sm">Price/night (₹)</label>
            <input type="number" step="0.01" {...register("pricePerNight")} className="w-full border rounded-lg px-3 py-2 text-sm" />
            {errors.pricePerNight && <p className="text-xs text-red-600">{errors.pricePerNight.message}</p>}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm">Description</label>
          <textarea rows={3} {...register("description")} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Amenities (comma separated)</label>
          <input {...register("amenities")} placeholder="WiFi, AC, TV" className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <div className="space-y-2">
          <label className="text-sm">Images (comma separated URLs)</label>
          <input {...register("images")} className="w-full border rounded-lg px-3 py-2 text-sm" />
        </div>
        <button disabled={isSubmitting || create.isPending || update.isPending} className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-blue-700 disabled:opacity-50">
          {isEdit ? (update.isPending?"Saving...":"Save") : (create.isPending?"Creating...":"Create")}
        </button>
      </form>
    </div>
  );
}