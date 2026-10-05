import { useForm } from "react-hook-form";
import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import type { Booking, RoomType, AvailabilityResult } from "@/types";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";

const schema = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  numGuests: z.coerce.number().int().min(1).max(50),
  guestName: z.string().min(2).max(120).optional().or(z.literal("")),
  guestEmail: z.string().email().optional().or(z.literal("")),
  guestPhone: z.string().min(5).max(30).optional().or(z.literal("")),
  specialRequests: z.string().max(1000).optional(),
}).refine((d)=> d.checkOut > d.checkIn, { message: "Check-out must be after check-in", path: ["checkOut"] });

type FormValues = z.infer<typeof schema>;

export default function BookingNew() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  const presetRoomId = sp.get("roomId");
  const presetRoomTypeId = sp.get("roomTypeId");
  const [mode, setMode] = useState<"type" | "rooms">(presetRoomId ? "rooms" : "type");
  const [roomTypeId, setRoomTypeId] = useState(presetRoomTypeId ?? "");
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(presetRoomId ? [presetRoomId] : []);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      checkIn: sp.get("checkIn") || format(new Date(), "yyyy-MM-dd"),
      checkOut: sp.get("checkOut") || format(new Date(Date.now()+86400000), "yyyy-MM-dd"),
      numGuests: sp.get("guests") ? +sp.get("guests")! : 1,
      guestName: "",
      guestEmail: "",
      guestPhone: "",
      specialRequests: "",
    },
  });

  const checkIn = watch("checkIn");
  const checkOut = watch("checkOut");
  const numGuests = watch("numGuests");
  const datesValid = !!checkIn && !!checkOut && checkOut > checkIn;

  const { data: roomTypes } = useQuery({
    queryKey: ["room-types"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<RoomType[]>>("/room-types");
      return data.data;
    },
  });

  const { data: available, isFetching: fetchingRooms } = useQuery({
    queryKey: ["availability", checkIn, checkOut, numGuests],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AvailabilityResult>>("/rooms/availability", {
        params: { checkIn, checkOut, guests: numGuests || undefined },
      });
      return data.data;
    },
    enabled: mode === "rooms" && datesValid,
  });

  const toggleRoom = (id: string) => {
    setSelectedRoomIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id],
    );
  };

  const create = useMutation({
    mutationFn: async (v: FormValues) => {
      const payload: any = {
        checkIn: v.checkIn,
        checkOut: v.checkOut,
        numGuests: v.numGuests,
        specialRequests: v.specialRequests || undefined,
      };
      if (mode === "type") payload.roomTypeId = roomTypeId;
      else payload.roomIds = selectedRoomIds;
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

  const onSubmit = (v: FormValues) => {
    if (mode === "type" && !roomTypeId) {
      toast.error("Select a room type to auto-assign");
      return;
    }
    if (mode === "rooms" && selectedRoomIds.length === 0) {
      toast.error("Select at least one room");
      return;
    }
    create.mutate(v);
  };

  return (
    <div className="max-w-2xl">
      <h2 className="text-lg font-semibold mb-4">New booking</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white border rounded-xl p-4 space-y-4">
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

        <div className="border-t pt-4 space-y-3">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={mode === "type"}
                onChange={() => { setMode("type"); setSelectedRoomIds([]); }}
              />
              Auto-assign by room type
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={mode === "rooms"}
                onChange={() => { setMode("rooms"); setRoomTypeId(""); }}
              />
              Pick specific room(s)
            </label>
          </div>

          {mode === "type" && (
            <div className="space-y-2">
              <label className="text-sm">Room type</label>
              <select
                value={roomTypeId}
                onChange={(e) => setRoomTypeId(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select room type...</option>
                {roomTypes?.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name} — sleeps {rt.capacity} — ₹{Number(rt.pricePerNight).toFixed(2)}/night
                  </option>
                ))}
              </select>
              <p className="text-xs text-neutral-500">
                Best available room(s) of this type will be assigned automatically based on guest count.
              </p>
            </div>
          )}

          {mode === "rooms" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm">Available rooms</label>
                {fetchingRooms && <span className="text-xs text-neutral-500">Searching...</span>}
              </div>
              {datesValid ? (
                available?.rooms.length ? (
                  <div className="grid gap-2 md:grid-cols-2 max-h-64 overflow-auto border rounded-lg p-2">
                    {available.rooms.map((r) => (
                      <label
                        key={r.id}
                        className={`flex items-center justify-between gap-2 border rounded-lg p-2 text-sm cursor-pointer ${
                          selectedRoomIds.includes(r.id) ? "border-blue-500 bg-blue-50" : "hover:bg-neutral-50"
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedRoomIds.includes(r.id)}
                            onChange={() => toggleRoom(r.id)}
                          />
                          Room {r.roomNumber} (F{r.floor})
                        </span>
                        <span className="text-xs text-neutral-600">
                          {r.typeName} • ₹{r.totalForStay.toFixed(2)}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">No rooms available for these dates.</p>
                )
              ) : (
                <p className="text-sm text-neutral-500">Enter valid dates to search rooms.</p>
              )}
              {selectedRoomIds.length > 0 && (
                <p className="text-xs text-neutral-600">{selectedRoomIds.length} room(s) selected</p>
              )}
            </div>
          )}
        </div>

        <div className="border-t pt-4 space-y-4">
          <h3 className="text-sm font-medium">Guest details (optional if logged in)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm">Name</label>
              <input {...register("guestName")} className="w-full border rounded-lg px-3 py-2 text-sm" />
              {errors.guestName && <p className="text-xs text-red-600">{errors.guestName.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm">Email</label>
              <input type="email" {...register("guestEmail")} className="w-full border rounded-lg px-3 py-2 text-sm" />
              {errors.guestEmail && <p className="text-xs text-red-600">{errors.guestEmail.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm">Phone</label>
              <input {...register("guestPhone")} className="w-full border rounded-lg px-3 py-2 text-sm" />
              {errors.guestPhone && <p className="text-xs text-red-600">{errors.guestPhone.message}</p>}
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