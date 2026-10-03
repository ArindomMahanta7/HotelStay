import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import type { Room, RoomType } from "@/types";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const rowSchema = z.object({
  roomNumber: z.string().min(1).max(20),
  floor: z.coerce.number().int().min(-5).max(200),
  price: z.coerce.number().nonnegative().optional().or(z.literal("")),
});

const schema = z.object({
  roomTypeId: z.string().uuid("Select a room type"),
  floor: z.coerce.number().int().min(-5).max(200).optional(),
  rooms: z.array(rowSchema).min(1).max(200),
});

type FormValues = z.infer<typeof schema>;

export default function RoomBulkCreate() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: roomTypes } = useQuery({
    queryKey: ["room-types"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<RoomType[]>>("/room-types");
      return data.data;
    },
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      roomTypeId: "",
      rooms: [{ roomNumber: "", floor: 1, price: "" }],
    },
  });
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "rooms" });

  const create = useMutation({
    mutationFn: async (v: FormValues) => {
      const payload: any = {
        roomTypeId: v.roomTypeId,
        rooms: v.rooms.map((r) => ({
          roomNumber: r.roomNumber,
          floor: r.floor,
          ...(r.price !== "" && r.price !== undefined ? { price: Number(r.price) } : {}),
        })),
      };
      if (v.floor !== undefined && v.floor !== null) payload.floor = v.floor;
      const { data } = await api.post<ApiResponse<Room[]>>("/rooms/bulk", payload);
      return data.data;
    },
    onSuccess: (created) => {
      toast.success(`${created.length} room(s) created`);
      qc.invalidateQueries({ queryKey: ["rooms"] });
      navigate("/rooms");
    },
    onError: (e:any)=> toast.error(e.response?.data?.message || "Bulk create failed"),
  });

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold mb-4">Bulk add rooms</h2>
      <form onSubmit={handleSubmit((v)=>create.mutate(v))} className="bg-white border rounded-xl p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-sm">Room type (applies to all)</label>
          <select {...register("roomTypeId")} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">Select...</option>
            {roomTypes?.map(rt=>(
              <option key={rt.id} value={rt.id}>{rt.name} (cap {rt.capacity}) – ₹{rt.pricePerNight}/night</option>
            ))}
          </select>
          {errors.roomTypeId && <p className="text-xs text-red-600">{errors.roomTypeId.message}</p>}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Rooms ({fields.length})</h3>
            <button
              type="button"
              onClick={()=>append({ roomNumber: "", floor: 1, price: "" })}
              className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              <Plus size={14} /> Add row
            </button>
          </div>
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-12 gap-2 items-start border rounded-lg p-2">
              <div className="col-span-5 space-y-1">
                <label className="text-xs text-neutral-600">Room #</label>
                <input {...register(`rooms.${index}.roomNumber`)} placeholder="101" className="w-full border rounded-lg px-2 py-1.5 text-sm" />
                {errors.rooms?.[index]?.roomNumber && <p className="text-xs text-red-600">{errors.rooms[index]?.roomNumber?.message}</p>}
              </div>
              <div className="col-span-3 space-y-1">
                <label className="text-xs text-neutral-600">Floor</label>
                <input type="number" {...register(`rooms.${index}.floor`)} className="w-full border rounded-lg px-2 py-1.5 text-sm" />
              </div>
              <div className="col-span-3 space-y-1">
                <label className="text-xs text-neutral-600">Price (opt.)</label>
                <input type="number" step="0.01" min={0} {...register(`rooms.${index}.price`)} placeholder="type price" className="w-full border rounded-lg px-2 py-1.5 text-sm" />
              </div>
              <div className="col-span-1 flex items-end justify-center pb-1.5">
                <button
                  type="button"
                  onClick={()=>remove(index)}
                  disabled={fields.length === 1}
                  className="p-1.5 text-neutral-500 hover:text-red-600 disabled:opacity-30"
                  title="Remove"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          {errors.rooms && !errors.rooms.length && (errors.rooms as any).message && (
            <p className="text-xs text-red-600">{(errors.rooms as any).message}</p>
          )}
        </div>

        <div className="flex gap-2">
          <button disabled={isSubmitting || create.isPending} className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-blue-700 disabled:opacity-50">
            {create.isPending ? "Creating..." : `Create ${fields.length} room(s)`}
          </button>
          <button type="button" onClick={()=>navigate("/rooms")} className="border rounded-lg px-3 py-2 text-sm hover:bg-neutral-50">Cancel</button>
        </div>
      </form>
    </div>
  );
}