import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import type { AvailabilityResult } from "@/types";
import { format, differenceInDays, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function Availability() {
  const [checkIn, setCheckIn] = useState(format(new Date(), "yyyy-MM-dd"));
  const [checkOut, setCheckOut] = useState(format(new Date(Date.now()+86400000), "yyyy-MM-dd"));
  const [guests, setGuests] = useState(1);
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const enabled = !!checkIn && !!checkOut && checkOut > checkIn;
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["availability", checkIn, checkOut, guests],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<AvailabilityResult>>("/rooms/availability", {
        params: { checkIn, checkOut, guests: guests||undefined },
      });
      return data.data;
    },
    enabled,
  });

  const nights = enabled ? differenceInDays(parseISO(checkOut), parseISO(checkIn)) : 0;

  const bookRoom = (roomId: string) => {
    if (!isAuthenticated) {
      toast.info("Login to book");
      navigate("/login", { state: { from: { pathname: "/bookings/new", search: `?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}&roomId=${roomId}` } } });
      return;
    }
    navigate(`/bookings/new?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}&roomId=${roomId}`);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border rounded-xl p-4 flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-neutral-600">Check-in</label>
          <input type="date" value={checkIn} onChange={(e)=>setCheckIn(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-600">Check-out</label>
          <input type="date" value={checkOut} onChange={(e)=>setCheckOut(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-600">Guests</label>
          <input type="number" min={1} value={guests} onChange={(e)=>setGuests(+e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm w-20" />
        </div>
        <button onClick={()=>refetch()} disabled={!enabled || isFetching} className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-50">
          {isFetching ? "Searching..." : "Search"}
        </button>
        {enabled && <p className="text-xs text-neutral-600 ml-auto">{nights} night(s)</p>}
      </div>

      {data && (
        <div className="space-y-3">
          <h2 className="text-base font-semibold">Available rooms ({data.count})</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.rooms.map((r) => (
              <div key={r.id} className="bg-white border rounded-xl p-4 flex flex-col justify-between">
                <div className="space-y-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium">Room {r.roomNumber} • Floor {r.floor}</p>
                      <p className="text-sm text-neutral-600 capitalize">{r.typeName} • sleeps {r.capacity}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">{r.status}</span>
                  </div>
                  {r.amenities?.length ? <p className="text-xs text-neutral-600">{r.amenities.join(", ")}</p> : null}
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <p className="text-xs text-neutral-600">₹{r.nightlyRate.toFixed(2)} / night</p>
                    <p className="text-sm font-medium">Total ₹{r.totalForStay.toFixed(2)}</p>
                  </div>
                  <button onClick={()=>bookRoom(r.id)} className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm hover:bg-blue-700">
                    Book this room
                  </button>
                </div>
              </div>
            ))}
          </div>
          {data.count === 0 && <p className="text-sm text-neutral-600">No rooms available for selected dates.</p>}
        </div>
      )}
    </div>
  );
}