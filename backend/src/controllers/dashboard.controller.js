import { getDashboard } from "../services/dashboard.service.js";

export async function dashboard(req, res) {
  const data = await getDashboard();
  res.json({ success: true, data });
}
