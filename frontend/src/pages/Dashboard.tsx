import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { api, type ApiResponse } from "@/lib/api";

type RecentBooking = {
  id: string;
  bookingNumber: string;
  status: string;
  checkIn: string;
  checkOut: string;
  numGuests: number;
  totalAmount: number;
  createdAt: string;
  guestName: string | null;
};

type UpcomingBooking = {
  id: string;
  bookingNumber: string;
  status: string;
  checkIn: string;
  checkOut: string;
  numGuests: number;
  guestName: string | null;
  roomNumbers: string;
};

type Dashboard = {
  hotel: { id: string; name: string; city: string } | null;
  date: string;
  rooms: {
    total: number;
    available: number;
    occupied: number;
    reserved: number;
    cleaning: number;
    maintenance: number;
  };
  occupancyRate: number;
  today: { checkIns: number; checkOuts: number; revenue: number };
  recentBookings: RecentBooking[];
  upcomingCheckIns: UpcomingBooking[];
  upcomingCheckOuts: UpcomingBooking[];
};

const statusLabel = (s: string) => s.replace("_", " ");

export default function Dashboard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Dashboard>>("/dashboard");
      return data.data;
    },
  });

  if (isLoading) return <p className="text-sm text-neutral-500">Loading...</p>;
  if (isError || !data) return <p className="text-sm text-red-600">Failed to load dashboard.</p>;

  const { rooms, today, occupancyRate } = data;

  const stats: { label: string; value: string | number }[] = [
    { label: "Total rooms", value: rooms.total },
    { label: "Available", value: rooms.available },
    { label: "Occupied", value: rooms.occupied },
    { label: "Reserved", value: rooms.reserved },
    { label: "Cleaning", value: rooms.cleaning },
    { label: "Maintenance", value: rooms.maintenance },
    { label: "Occupancy", value: `${occupancyRate}%` },
    { label: "Today's check-ins", value: today.checkIns },
    { label: "Today's check-outs", value: today.checkOuts },
    { label: "Today's revenue", value: `₹${Number(today.revenue).toFixed(2)}` },
  ];

  const renderUpcoming = (rows: UpcomingBooking[], emptyMsg: string) =>
    rows.length ? (
      rows.map((b) => (
        <Link
          key={b.id}
          to={`/bookings/${b.id}`}
          className="flex justify-between gap-2 border rounded-lg p-2 hover:bg-neutral-50"
        >
          <span className="truncate">
            {b.bookingNumber} • {b.guestName || "-"}
            {b.roomNumbers ? ` • Rm ${b.roomNumbers}` : ""}
          </span>
          <span className="text-xs text-neutral-600 whitespace-nowrap">
            {format(parseISO(b.checkIn), "dd MMM")} – {format(parseISO(b.checkOut), "dd MMM")} • {b.numGuests}p
          </span>
        </Link>
      ))
    ) : (
      <p className="text-sm text-neutral-500">{emptyMsg}</p>
    );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Dashboard</h2>
          {data.hotel && (
            <p className="text-sm text-neutral-600">
              {data.hotel.name} • {data.hotel.city}
            </p>
          )}
        </div>
        <p className="text-sm text-neutral-600">{format(parseISO(data.date), "EEEE, dd MMM yyyy")}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border rounded-xl p-3">
            <p className="text-xs text-neutral-600">{s.label}</p>
            <p className="text-lg font-semibold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-white border rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-medium">Recent bookings</h3>
          <div className="space-y-2">
            {data.recentBookings.length ? (
              data.recentBookings.map((b) => (
                <Link
                  key={b.id}
                  to={`/bookings/${b.id}`}
                  className="flex justify-between gap-2 border rounded-lg p-2 text-sm hover:bg-neutral-50"
                >
                  <span className="truncate">
                    {b.bookingNumber} • {b.guestName || "-"}
                  </span>
                  <span className="text-xs whitespace-nowrap">
                    <span className="capitalize">{statusLabel(b.status)}</span> • ₹{b.totalAmount.toFixed(2)}
                  </span>
                </Link>
              ))
            ) : (
              <p className="text-sm text-neutral-500">No bookings yet</p>
            )}
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-medium">Upcoming check-ins (7 days)</h3>
          <div className="space-y-2">{renderUpcoming(data.upcomingCheckIns, "No upcoming check-ins")}</div>
        </div>

        <div className="bg-white border rounded-xl p-4 space-y-2">
          <h3 className="text-sm font-medium">Upcoming check-outs (7 days)</h3>
          <div className="space-y-2">{renderUpcoming(data.upcomingCheckOuts, "No upcoming check-outs")}</div>
        </div>
      </div>
    </div>
  );
}