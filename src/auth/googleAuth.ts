import pkceChallenge from "pkce-challenge";
import { AUTH_URL, TOKEN_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI, SCOPE } from "./googleConfig";
import { CalendarEvent } from "../features/calendar/Calendar";

export async function loginWithGoogle() {
  const pkce = await pkceChallenge();

  sessionStorage.setItem("pkce_code_verifier", pkce.code_verifier);

  const authUrl = new URL(AUTH_URL);
  authUrl.searchParams.append("client_id", GOOGLE_CLIENT_ID);
  authUrl.searchParams.append("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.append("response_type", "code");
  authUrl.searchParams.append("scope", SCOPE);
  authUrl.searchParams.append("code_challenge", pkce.code_challenge);
  authUrl.searchParams.append("code_challenge_method", "S256");

  window.location.href = authUrl.toString();
}

export async function handleGoogleRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");

  if (!code) return null;

  const codeVerifier = sessionStorage.getItem("pkce_code_verifier");
  if (!codeVerifier) {
    console.error("Missing code verifier — login flow restarted?");
    return null;
  }

  const body = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json();

  sessionStorage.removeItem("pkce_code_verifier");
  localStorage.setItem("google_token", JSON.stringify(data));

  return data;
}

export async function fetchGoogleCalendarEvents() {
  const raw = localStorage.getItem("google_token");
  if (!raw) return [];

  const token = JSON.parse(raw);
  const accessToken = token.access_token;
  const now = new Date().toISOString();

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${now}&maxResults=100&singleEvents=true&orderBy=startTime`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const data = await res.json();
  if (!data.items) return [];

  return data.items.map((item: any) => ({
    id: item.id,
    googleEventId: item.id,
    title: item.summary || "Untitled",
    date: (item.start.dateTime || item.start.date).slice(0, 10),
    time: item.start.dateTime
      ? new Date(item.start.dateTime).toTimeString().slice(0, 5)
      : undefined,
    tag: "other",
    description: item.description || "",
  }));
}

const getAccessToken = () => {
  const raw = localStorage.getItem("google_token");
  if (!raw) return null;
  return JSON.parse(raw).access_token;
};

const buildGoogleTimePayload = (event: CalendarEvent) => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (event.time) {
    const startIso = `${event.date}T${event.time}:00`;
    const startDate = new Date(startIso);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

    const pad = (num: number) => String(num).padStart(2, "0");
    const endIso = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`;

    return {
      start: { dateTime: startIso, timeZone },
      end: { dateTime: endIso, timeZone },
    };
  } else {
    const startDate = new Date(event.date);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 1);
    
    const endLabel = endDate.toISOString().slice(0, 10);

    return {
      start: { date: event.date },
      end: { date: endLabel },
    };
  }
};

export async function createGoogleCalendarEvent(event: CalendarEvent) {
  const accessToken = getAccessToken();
  if (!accessToken) return;

  const timePayload = buildGoogleTimePayload(event);
  const body: any = {
    summary: event.title,
    description: event.description || "",
    ...timePayload,
  };

  if (event.repeatEnabled && event.repeatPattern) {
    const rruleMap: Record<string, string> = {
      daily: "RRULE:FREQ=DAILY",
      weekly: "RRULE:FREQ=WEEKLY",
      monthly: "RRULE:FREQ=MONTHLY",
    };
    body.recurrence = [rruleMap[event.repeatPattern]];
  }

  const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error("Google Calendar Create Error:", await res.json());
    return;
  }

  const data = await res.json();
  return data.id;
}

export async function updateGoogleCalendarEvent(googleEventId: string, event: CalendarEvent) {
  const accessToken = getAccessToken();
  if (!accessToken) return;

  const timePayload = buildGoogleTimePayload(event);
  const body: any = {
    summary: event.title,
    description: event.description || "",
    ...timePayload,
  };

  if (event.repeatEnabled && event.repeatPattern) {
    const rruleMap: Record<string, string> = {
      daily: "RRULE:FREQ=DAILY",
      weekly: "RRULE:FREQ=WEEKLY",
      monthly: "RRULE:FREQ=MONTHLY",
    };
    body.recurrence = [rruleMap[event.repeatPattern]];
  }

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    console.error("Google Calendar Update Error:", await res.json());
  }
}

export async function deleteGoogleCalendarEvent(googleEventId: string) {
  const accessToken = getAccessToken();
  if (!accessToken) return;

  await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
}