import { Routes, Route } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/RequireAuth";
import HomeRedirect from "@/pages/HomeRedirect";
import Availability from "@/pages/Availability";
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import Profile from "@/pages/Profile";
import Dashboard from "@/pages/Dashboard";
import BookingsList from "@/pages/bookings/BookingsList";
import BookingNew from "@/pages/bookings/BookingNew";
import BookingDetail from "@/pages/bookings/BookingDetail";
import RoomsList from "@/pages/rooms/RoomsList";
import RoomForm from "@/pages/rooms/RoomForm";
import RoomBulkCreate from "@/pages/rooms/RoomBulkCreate";
import RoomTypesList from "@/pages/room-types/RoomTypesList";
import RoomTypeForm from "@/pages/room-types/RoomTypeForm";
import GuestsList from "@/pages/guests/GuestsList";
import NotFound from "@/pages/NotFound";

const STAFF: ("admin" | "receptionist")[] = ["admin", "receptionist"];
const ADMIN: "admin"[] = ["admin"];

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomeRedirect />} />
        <Route path="/availability" element={<Availability />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<RequireAuth />}>
          <Route path="/profile" element={<Profile />} />
          <Route path="/bookings" element={<BookingsList />} />
          <Route path="/bookings/new" element={<BookingNew />} />
          <Route path="/bookings/:id" element={<BookingDetail />} />
        </Route>

        <Route element={<RequireAuth roles={STAFF} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/rooms" element={<RoomsList />} />
          <Route path="/rooms/:id/edit" element={<RoomForm />} />
          <Route path="/room-types" element={<RoomTypesList />} />
          <Route path="/guests" element={<GuestsList />} />
        </Route>

        <Route element={<RequireAuth roles={ADMIN} />}>
          <Route path="/rooms/new" element={<RoomForm />} />
          <Route path="/rooms/new-bulk" element={<RoomBulkCreate />} />
          <Route path="/room-types/new" element={<RoomTypeForm />} />
          <Route path="/room-types/:id/edit" element={<RoomTypeForm />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}