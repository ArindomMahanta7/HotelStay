import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import type { Guest, Booking } from "@/types";
import { useState } from "react";
import { format, parseISO } from "date-fns";
import { X } from "lucide-react";

type GuestDetail = Guest & {
  bookingHistory: (Partial<Booking> & {
    totalAmount: number;
    roomNumber: string;
    roomType: string;
  })[];
};

export default function GuestsList() {
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["guests", q],
    queryFn: async () => {
      const params:any={ limit: 100 };
      if(q) params.q=q;
      const { data } = await api.get<ApiResponse<Guest[]>>("/guests", { params });
      return data.data;
    },
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["guest", selectedId],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<GuestDetail>>(`/guests/${selectedId}`);
      return data.data;
    },
    enabled: !!selectedId,
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Guests</h2>
      <div className="bg-white border rounded-xl p-3 flex gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-neutral-600">Search</label>
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Name, email, phone or ID" className="border rounded-lg px-2 py-1.5 text-sm w-64" />
        </div>
      </div>

      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b">
            <tr>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Email</th>
              <th className="text-left p-2">Phone</th>
              <th className="text-left p-2">ID</th>
              <th className="text-left p-2">Created</th>
              <th className="text-left p-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="p-4 text-center text-neutral-500">Loading...</td></tr>
            ) : isError ? (
              <tr><td colSpan={6} className="p-4 text-center text-red-600">Failed to load guests.</td></tr>
            ) : data?.length ? data.map(g=>(
              <tr key={g.id} className="border-b hover:bg-neutral-50/50">
                <td className="p-2">{g.name}</td>
                <td className="p-2">{g.email || "-"}</td>
                <td className="p-2">{g.phone || "-"}</td>
                <td className="p-2">{g.idType ? `${g.idType.replace("_"," ")}${g.idNumber?` • ${g.idNumber}`:''}` : "-"}</td>
                <td className="p-2">{g.createdAt ? format(parseISO(g.createdAt), "dd MMM yyyy") : "-"}</td>
                <td className="p-2 text-right">
                  <button onClick={()=>setSelectedId(g.id)} className="text-blue-600 hover:underline text-xs">History</button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={6} className="p-4 text-center text-neutral-500">No guests found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50" onClick={()=>setSelectedId(null)}>
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-auto p-5 space-y-4" onClick={(e)=>e.stopPropagation()}>
            <div className="flex justify-between items-start">
              {detailLoading || !detail ? (
                <p className="text-sm text-neutral-500">Loading...</p>
              ) : (
                <div>
                  <h3 className="text-lg font-semibold">{detail.name}</h3>
                  <p className="text-sm text-neutral-600">
                    {[detail.email, detail.phone].filter(Boolean).join(" • ") || "No contact info"}
                  </p>
                  {detail.address && <p className="text-sm text-neutral-600">{detail.address}</p>}
                  {detail.idType && (
                    <p className="text-sm text-neutral-600 capitalize">
                      {detail.idType.replace("_"," ")}: {detail.idNumber || "—"}
                    </p>
                  )}
                </div>
              )}
              <button onClick={()=>setSelectedId(null)} className="p-1 hover:bg-neutral-100 rounded" title="Close">
                <X size={18} />
              </button>
            </div>

            {detail && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Booking history ({detail.bookingHistory.length})</h4>
                {detail.bookingHistory.length ? (
                  <table className="w-full text-sm">
                    <thead className="bg-neutral-50 border-b">
                      <tr>
                        <th className="text-left p-2">Booking #</th>
                        <th className="text-left p-2">Dates</th>
                        <th className="text-left p-2">Room(s)</th>
                        <th className="text-left p-2">Status</th>
                        <th className="text-left p-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.bookingHistory.map((b:any)=>(
                        <tr key={b.id} className="border-b">
                          <td className="p-2 font-mono">{b.bookingNumber}</td>
                          <td className="p-2">
                            {format(parseISO(b.checkIn), "dd MMM")} – {format(parseISO(b.checkOut), "dd MMM yyyy")}
                          </td>
                          <td className="p-2">
                            {b.roomNumber || "-"}
                            {b.roomType ? <span className="text-neutral-500"> ({b.roomType})</span> : null}
                          </td>
                          <td className="p-2 capitalize">{b.status?.replace("_"," ")}</td>
                          <td className="p-2">₹{Number(b.totalAmount).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm text-neutral-500">No bookings for this guest.</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}