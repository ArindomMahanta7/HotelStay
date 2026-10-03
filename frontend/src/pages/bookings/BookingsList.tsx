import { useQuery } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import type { Booking, BookingStatus } from "@/types";
import { Link } from "react-router-dom";
import { useState } from "react";
import { format } from "date-fns";

const statuses: (BookingStatus | "")[] = ["", "pending", "confirmed", "checked_in", "checked_out", "cancelled"];

export default function BookingsList() {
  const [status, setStatus] = useState<BookingStatus | "">("");
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["bookings", status, q],
    queryFn: async () => {
      const params: any = {};
      if (status) params.status = status;
      if (q) params.q = q;
      const { data } = await api.get<ApiResponse<Booking[]>>("/bookings", { params });
      return data.data;
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Bookings</h2>
        <Link to="/bookings/new" className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm hover:bg-blue-700">New booking</Link>
      </div>
      <div className="bg-white border rounded-xl p-3 flex gap-3 items-end flex-wrap">
        <div className="space-y-1">
          <label className="text-xs text-neutral-600">Status</label>
          <select value={status} onChange={(e)=>setStatus(e.target.value as any)} className="border rounded-lg px-2 py-1.5 text-sm">
            {statuses.map(s => <option key={s||"all"} value={s}>{s||"All"}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-neutral-600">Search (booking # or guest)</label>
          <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="HS-XXXX or name" className="border rounded-lg px-2 py-1.5 text-sm w-56" />
        </div>
      </div>
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 border-b">
            <tr>
              <th className="text-left p-2">Booking #</th>
              <th className="text-left p-2">Guest</th>
              <th className="text-left p-2">Dates</th>
              <th className="text-left p-2">Nights</th>
              <th className="text-left p-2">Guests</th>
              <th className="text-left p-2">Total</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Created</th>
              <th className="text-left p-2"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="p-4 text-center text-neutral-500">Loading...</td></tr>
            ) : data?.length ? data.map((b) => (
              <tr key={b.id} className="border-b hover:bg-neutral-50/50">
                <td className="p-2 font-mono">{b.bookingNumber}</td>
                <td className="p-2">{b.guest?.name || b.user?.name}</td>
                <td className="p-2">{format(new Date(b.checkIn),"dd MMM")} – {format(new Date(b.checkOut),"dd MMM yyyy")}</td>
                <td className="p-2">{b.nights}</td>
                <td className="p-2">{b.numGuests}</td>
                <td className="p-2">₹{b.totalAmount.toFixed(2)}</td>
                <td className="p-2 capitalize">{b.status.replace("_"," ")}</td>
                <td className="p-2">{format(new Date(b.createdAt),"dd MMM yyyy HH:mm")}</td>
                <td className="p-2 text-right">
                  <Link to={`/bookings/${b.id}`} className="text-blue-600 hover:underline text-xs">View</Link>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={9} className="p-4 text-center text-neutral-500">No bookings found</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}