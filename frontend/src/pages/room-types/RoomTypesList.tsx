import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import type { RoomType } from "@/types";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function RoomTypesList() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["room-types"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<RoomType[]>>("/room-types");
      return data.data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Room types</h2>
        {isAdmin && (
          <Link to="/room-types/new" className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm hover:bg-blue-700">
            Add room type
          </Link>
        )}
      </div>

      {isLoading && <p className="text-sm text-neutral-500">Loading...</p>}
      {isError && <p className="text-sm text-red-600">Failed to load room types.</p>}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((rt) => (
          <div key={rt.id} className="bg-white border rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-start">
              <h3 className="font-medium capitalize">{rt.name}</h3>
              {isAdmin && (
                <Link to={`/room-types/${rt.id}/edit`} className="text-xs text-blue-600 hover:underline">
                  Edit
                </Link>
              )}
            </div>
            <p className="text-sm text-neutral-600">
              Capacity: {rt.capacity} • ₹{Number(rt.pricePerNight).toFixed(2)}/night
              {"roomCount" in rt ? ` • ${(rt as any).roomCount} room(s)` : ""}
            </p>
            {rt.amenities?.length ? <p className="text-xs text-neutral-600">{rt.amenities.join(", ")}</p> : null}
            {rt.description && <p className="text-xs text-neutral-500 line-clamp-2">{rt.description}</p>}
          </div>
        ))}
        {data?.length === 0 && <p className="text-sm text-neutral-500">No room types yet.</p>}
      </div>
    </div>
  );
}