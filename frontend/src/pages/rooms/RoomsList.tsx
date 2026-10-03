import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import type { Room, RoomStatus } from "@/types";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const statuses: (RoomStatus | "")[] = ["","available","reserved","occupied","cleaning","maintenance"];

export default function RoomsList() {
  const [status, setStatus] = useState<RoomStatus | "">("");
  const [q, setQ] = useState("");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data, isLoading } = useQuery({
    queryKey: ["rooms", status, q],
    queryFn: async () => {
      const params:any={}; if(status) params.status=status; if(q) params.q=q; params.limit=200;
      const { data } = await api.get<ApiResponse<Room[]>>("/rooms", { params });
      return data.data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Rooms</h2>
        <div className="flex gap-2">
          {isAdmin && (
            <Link to="/rooms/new-bulk" className="border rounded-lg px-3 py-1.5 text-sm hover:bg-neutral-50">Bulk add</Link>
          )}
          {isAdmin && (
            <Link to="/rooms/new" className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm hover:bg-blue-700">Add room</Link>
          )}
        </div>
      </div>
      <div className="bg-white border rounded-xl p-3 flex gap-3 items-end flex-wrap">
        <div className="space-y-1">
          <label className="text-xs text-neutral-600">Status</label>
          <select value={status} onChange={(e)=>setStatus(e.target.value as any)} className="border rounded-lg px-2 py-1.5 text-sm">
            {statuses.map(s=><option key={s||"all"} value={s}>{s||"All"}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-600">Room #</label>
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Search" className="border rounded-lg px-2 py-1.5 text-sm w-40" />
        </div>
      </div>
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b">
            <tr>
              <th className="text-left p-2">Room #</th>
              <th className="text-left p-2">Floor</th>
              <th className="text-left p-2">Type</th>
              <th className="text-left p-2">Capacity</th>
              <th className="text-left p-2">Price (override)</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="p-4 text-center text-neutral-500">Loading...</td></tr> : data?.length ? data.map((r)=>(
              <tr key={r.id} className="border-b hover:bg-neutral-50/50">
                <td className="p-2">{r.roomNumber}</td>
                <td className="p-2">{r.floor}</td>
                <td className="p-2 capitalize">{(r.roomType as any)?.name || r.typeName || "-"}</td>
                <td className="p-2">{(r.roomType as any)?.capacity ?? r.capacity ?? "-"}</td>
                <td className="p-2">{r.price!=null ? `₹${Number(r.price).toFixed(2)}` : "-"}</td>
                <td className="p-2 capitalize">{r.status.replace("_"," ")}</td>
                <td className="p-2 text-right"><Link to={`/rooms/${r.id}/edit`} className="text-blue-600 hover:underline text-xs">Edit</Link></td>
              </tr>
            )) : <tr><td colSpan={7} className="p-4 text-center text-neutral-500">No rooms</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}