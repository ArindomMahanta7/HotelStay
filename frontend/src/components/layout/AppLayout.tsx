import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { LogOut, Hotel, LayoutDashboard, Bed, DoorOpen, Users, CalendarCheck, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { isStaffRole } from "@/types";

function NavItem({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-neutral-100 transition-colors"
      )}
    >
      <Icon size={18} />
      {label}
    </Link>
  );
}

export default function AppLayout() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r bg-white flex flex-col">
        <div className="p-4 border-b flex items-center gap-2">
          <Hotel className="text-blue-600" />
          <span className="font-semibold text-lg">HotelStay</span>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavItem to="/" icon={DoorOpen} label="Availability" />
          {isAuthenticated && (
            <>
              {isStaffRole(user?.role) && (
                <>
                  <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
                  <NavItem to="/rooms" icon={Bed} label="Rooms" />
                  <NavItem to="/room-types" icon={Hotel} label="Room Types" />
                  <NavItem to="/guests" icon={Users} label="Guests" />
                </>
              )}
              <NavItem to="/bookings" icon={CalendarCheck} label="Bookings" />
              <NavItem to="/profile" icon={User} label="Profile" />
            </>
          )}
        </nav>
        <div className="p-3 border-t">
          {isAuthenticated ? (
            <div className="flex items-center justify-between">
              <div className="text-sm truncate">
                <p className="font-medium truncate">{user?.name}</p>
                <p className="text-xs text-neutral-500 truncate">{user?.email} • {user?.role}</p>
              </div>
              <button onClick={handleLogout} className="p-2 hover:bg-neutral-100 rounded-lg" title="Logout">
                <LogOut size={18} />
              </button>
            </div>
          ) : (
            <Link to="/login" className="text-sm text-blue-600 hover:underline">Login / Register</Link>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="h-14 border-b bg-white flex items-center px-6 justify-between">
          <h1 className="font-medium">Hotel Management</h1>
        </header>
        <div className="flex-1 p-6 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}