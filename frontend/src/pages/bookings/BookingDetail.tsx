import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiResponse } from "@/lib/api";
import type { Booking } from "@/types";
import { isStaffRole } from "@/types";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function BookingDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff = isStaffRole(user?.role);

  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", id],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Booking>>(`/bookings/${id}`);
      return data.data;
    },
    enabled: !!id,
  });

  const [showCheckout, setShowCheckout] = useState(false);
  const [pm, setPm] = useState<"cash"|"card"|"upi">("cash");
  const [txn, setTxn] = useState("");

  const cancel = useMutation({
    mutationFn: async () => api.post(`/bookings/${id}/cancel`),
    onSuccess: () => { toast.success("Booking cancelled"); qc.invalidateQueries({ queryKey: ["booking", id] }); qc.invalidateQueries({ queryKey: ["bookings"] }); },
    onError: (e:any)=> toast.error(e.response?.data?.message || "Cancel failed"),
  });
  const confirm = useMutation({
    mutationFn: async () => api.patch(`/bookings/${id}`, { status: "confirmed" }),
    onSuccess: () => { toast.success("Booking confirmed"); qc.invalidateQueries({ queryKey: ["booking", id] }); },
    onError: (e:any)=> toast.error(e.response?.data?.message || "Confirm failed"),
  });
  const checkin = useMutation({
    mutationFn: async () => api.post(`/bookings/${id}/check-in`),
    onSuccess: () => { toast.success("Checked in"); qc.invalidateQueries({ queryKey: ["booking", id] }); },
    onError: (e:any)=> toast.error(e.response?.data?.message || "Check-in failed"),
  });
  const checkout = useMutation({
    mutationFn: async () => {
      const payload: any = {};
      if (pm) {
        payload.payment = { method: pm };
        if (pm !== "cash") payload.payment.transactionId = txn;
      }
      return api.post(`/bookings/${id}/check-out`, payload);
    },
    onSuccess: () => { toast.success("Checked out"); setShowCheckout(false); qc.invalidateQueries({ queryKey: ["booking", id] }); },
    onError: (e:any)=> toast.error(e.response?.data?.message || "Check-out failed"),
  });

  if (isLoading || !booking) return <div>Loading...</div>;

  const canCancel = ["pending","confirmed"].includes(booking.status);
  const canConfirm = booking.status === "pending" && isStaff;
  const canCheckIn = booking.status === "confirmed" && isStaff;
  const canCheckOut = booking.status === "checked_in" && isStaff;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-semibold">Booking {booking.bookingNumber}</h2>
          <p className="text-sm text-neutral-600 capitalize">Status: {booking.status.replace("_"," ")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canConfirm && <button onClick={()=>confirm.mutate()} disabled={confirm.isPending} className="border rounded-lg px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50">Confirm</button>}
          {canCancel && <button onClick={()=>cancel.mutate()} disabled={cancel.isPending} className="border rounded-lg px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50">Cancel</button>}
          {canCheckIn && <button onClick={()=>checkin.mutate()} disabled={checkin.isPending} className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-50">Check-in</button>}
          {canCheckOut && <button onClick={()=>setShowCheckout(true)} className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm hover:bg-blue-700">Check-out</button>}
          <button onClick={()=>navigate(-1)} className="border rounded-lg px-3 py-1.5 text-sm hover:bg-neutral-50">Back</button>
        </div>
      </div>

      {showCheckout && (
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">Checkout</h3>
            <button onClick={()=>setShowCheckout(false)} className="text-xs text-neutral-600 hover:underline">Close</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="space-y-1">
              <label className="text-xs">Payment method</label>
              <select value={pm} onChange={(e)=>setPm(e.target.value as any)} className="w-full border rounded-lg px-2 py-1.5 text-sm">
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="upi">UPI</option>
              </select>
            </div>
            {pm !== "cash" && (
              <div className="space-y-1 md:col-span-2">
                <label className="text-xs">Transaction ID</label>
                <input value={txn} onChange={(e)=>setTxn(e.target.value)} placeholder="TXN-..." className="w-full border rounded-lg px-2 py-1.5 text-sm" />
              </div>
            )}
          </div>
          <div className="flex justify-between items-center">
            <p className="text-sm">Final bill: <span className="font-medium">₹{booking.totalAmount.toFixed(2)}</span></p>
            <button onClick={()=>checkout.mutate()} disabled={checkout.isPending || (pm!=="cash" && !txn.trim())} className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-50">
              {checkout.isPending ? "Processing..." : "Complete checkout"}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white border rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-medium">Stay details</h3>
          <p className="text-sm">Check-in: {format(new Date(booking.checkIn),"dd MMM yyyy")}</p>
          <p className="text-sm">Check-out: {format(new Date(booking.checkOut),"dd MMM yyyy")}</p>
          <p className="text-sm">Nights: {booking.nights}</p>
          <p className="text-sm">Guests: {booking.numGuests}</p>
          <p className="text-sm">Total: ₹{booking.totalAmount.toFixed(2)}</p>
          {booking.specialRequests && <p className="text-sm text-neutral-600">Special requests: {booking.specialRequests}</p>}
        </div>
        <div className="bg-white border rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-medium">Guest</h3>
          <p className="text-sm">{booking.guest?.name || booking.user?.name}</p>
          {(booking.guest?.email || booking.user?.email) && <p className="text-sm text-neutral-600">{booking.guest?.email || booking.user?.email}</p>}
          {booking.guest?.phone && <p className="text-sm text-neutral-600">{booking.guest.phone}</p>}
        </div>
      </div>

      <div className="bg-white border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-medium">Rooms</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 border-b">
              <tr>
                <th className="text-left p-2">Room #</th>
                <th className="text-left p-2">Floor</th>
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Rate/night</th>
                <th className="text-left p-2">Nights</th>
                <th className="text-left p-2">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {booking.rooms.map((r,i)=>(
                <tr key={i} className="border-b">
                  <td className="p-2">{r.roomNumber}</td>
                  <td className="p-2">{r.floor ?? "-"}</td>
                  <td className="p-2 capitalize">{r.roomType ?? "-"}</td>
                  <td className="p-2">₹{r.rate.toFixed(2)}</td>
                  <td className="p-2">{r.nights}</td>
                  <td className="p-2">₹{r.subtotal.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {booking.payments.length>0 && (
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-medium">Payments</h3>
          <div className="space-y-2">
            {booking.payments.map((p)=>(
              <div key={p.id} className="flex justify-between text-sm border rounded-lg p-2">
                <span>{p.method.toUpperCase()} {p.transactionId ? `• ${p.transactionId}` : ""} • {p.status}</span>
                <span>₹{p.amount.toFixed(2)} {p.paidAt ? `• ${format(new Date(p.paidAt),"dd MMM yyyy HH:mm")}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}