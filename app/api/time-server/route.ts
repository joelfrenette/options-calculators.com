export async function GET() {
  try {
    // Fetch from WorldTimeAPI for accurate current time
    const response = await fetch("http://worldtimeapi.org/api/timezone/America/New_York", {
      cache: "no-store",
    })

    if (!response.ok) {
      throw new Error("Failed to fetch time")
    }

    const data = await response.json()

    return Response.json({
      datetime: data.datetime,
      timezone: data.timezone,
      day_of_week: data.day_of_week, // 0=Sunday, 1=Monday, ..., 5=Friday
      date: data.datetime.split("T")[0], // YYYY-MM-DD
      utc_datetime: data.utc_datetime,
    })
  } catch (error) {
    // Fallback to server time if API fails
    const now = new Date()
    return Response.json({
      datetime: now.toISOString(),
      timezone: "America/New_York",
      day_of_week: now.getDay(), // 0=Sunday, 5=Friday
      date: now.toISOString().split("T")[0],
      utc_datetime: now.toISOString(),
      fallback: true,
    })
  }
}
